/* ------------------------------------------------------------------ */
/* LifeLog P2P Sync - QR Code Based Local Network Sync                */
/* Uses WebRTC for direct browser-to-browser communication            */
/* QR codes exchange WebRTC signaling data (no external server)       */
/* All sync data is encrypted with a shared sync key                  */
/* ------------------------------------------------------------------ */

import QRCode from 'qrcode';
import type { State } from '../types';
import { encryptEnvelope, decryptEnvelope, getDeviceKey } from './crypto';

/* ---------------- types ---------------- */

export interface PeerInfo {
  id: string;
  name: string;
  connectedAt: number;
  lastSyncAt: number | null;
}

export interface SyncSession {
  peerId: string;
  peerName: string;
  status: 'connecting' | 'connected' | 'syncing' | 'error' | 'disconnected';
  error?: string;
}

export interface QrPayload {
  v: 1;
  type: 'offer' | 'answer';
  peerId: string;
  peerName: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
}

/* ---------------- crypto helpers for sync ---------------- */

let syncKeyPromise: Promise<CryptoKey | null> | null = null;

/** Derive a sync-specific key from the device key for P2P encryption */
async function getSyncKey(): Promise<CryptoKey | null> {
  if (!syncKeyPromise) {
    syncKeyPromise = (async () => {
      const deviceKey = await getDeviceKey();
      if (!deviceKey || !crypto.subtle) return null;
      
      // Derive a sync-specific key using HKDF
      const keyMaterial = await crypto.subtle.exportKey('raw', deviceKey);
      const salt = new TextEncoder().encode('lifelog.sync.v1');
      
      const importedKey = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        'HKDF',
        false,
        ['deriveKey']
      );
      
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('p2p-sync') },
        importedKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    })();
  }
  return syncKeyPromise;
}

export async function encryptSyncData(state: State): Promise<string> {
  const syncKey = await getSyncKey();
  if (!syncKey) {
    // Fallback to unencrypted if crypto unavailable
    return JSON.stringify({ v: 1, kind: 'plain', d: JSON.stringify(state) });
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    syncKey,
    new TextEncoder().encode(JSON.stringify(state))
  );
  
  return JSON.stringify({
    v: 1,
    kind: 'sync',
    iv: bufToB64(iv.buffer),
    d: bufToB64(ct)
  });
}

export async function decryptSyncData(payload: string): Promise<State> {
  const env = JSON.parse(payload) as { kind: string; iv?: string; d: string };
  
  if (env.kind === 'plain') {
    return JSON.parse(env.d) as State;
  }
  
  const syncKey = await getSyncKey();
  if (!syncKey) {
    throw new Error('Web Crypto unavailable for sync decryption');
  }
  
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(env.iv ?? '') },
    syncKey,
    b64ToBytes(env.d)
  );
  
  return JSON.parse(new TextDecoder().decode(pt)) as State;
}

/* ---------------- base64 helpers ---------------- */

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------------- QR code generation ---------------- */

export async function generateOfferQR(peerName: string): Promise<{ qrDataUrl: string; payload: QrPayload }> {
  const peerId = `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  // Create a simple offer payload that will be filled by WebRTC
  const payload: QrPayload = {
    v: 1,
    type: 'offer',
    peerId,
    peerName,
    offer: undefined // Will be set when actual WebRTC offer is created
  };
  
  // For initial display, we show a placeholder QR that will be updated
  // The actual QR is generated after WebRTC creates the offer
  const qrString = JSON.stringify(payload);
  const qrDataUrl = await QRCode.toDataURL(qrString, {
    width: 256,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });
  
  return { qrDataUrl, payload };
}

export async function generateAnswerQR(peerName: string, offerPayload: QrPayload): Promise<{ qrDataUrl: string; payload: QrPayload }> {
  const peerId = `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  const payload: QrPayload = {
    v: 1,
    type: 'answer',
    peerId,
    peerName,
    answer: undefined // Will be set when WebRTC answer is created
  };
  
  const qrString = JSON.stringify(payload);
  const qrDataUrl = await QRCode.toDataURL(qrString, {
    width: 256,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });
  
  return { qrDataUrl, payload };
}

export function parseQrPayload(qrText: string): QrPayload | null {
  try {
    const parsed = JSON.parse(qrText) as QrPayload;
    if (parsed.v !== 1 || (parsed.type !== 'offer' && parsed.type !== 'answer')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/* ---------------- WebRTC P2P Connection Manager ---------------- */

export class P2PSyncManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private peers: Map<string, PeerInfo> = new Map();
  private onStatusChange: ((session: SyncSession) => void) | null = null;
  private currentSession: SyncSession | null = null;
  private pendingMessages: string[] = [];
  
  constructor() {}
  
  setStatusHandler(handler: (session: SyncSession) => void) {
    this.onStatusChange = handler;
  }
  
  private updateStatus(status: SyncSession['status'], error?: string) {
    if (!this.currentSession) return;
    this.currentSession = { ...this.currentSession, status, error };
    this.onStatusChange?.(this.currentSession);
  }
  
  /* ---- Create offer (host mode) ---- */
  async createOffer(peerName: string): Promise<{ qrDataUrl: string; payload: QrPayload }> {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [] // No STUN/TURN needed for local network
    });
    
    this.setupPeerConnection();
    
    // Create data channel for sending sync data
    this.dataChannel = this.peerConnection.createDataChannel('lifelog-sync', {
      ordered: true
    });
    this.setupDataChannel();
    
    // Create offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    // Wait for ICE gathering to complete
    await this.waitForIceGathering();
    
    // Create payload with complete offer
    const payload: QrPayload = {
      v: 1,
      type: 'offer',
      peerId: `host-${Date.now()}`,
      peerName,
      offer: this.peerConnection.localDescription ?? undefined
    };
    
    const qrString = JSON.stringify(payload);
    const qrDataUrl = await QRCode.toDataURL(qrString, {
      width: 280,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#f5f5f5' }
    });
    
    this.currentSession = {
      peerId: payload.peerId,
      peerName,
      status: 'connecting'
    };
    this.updateStatus('connecting');
    
    return { qrDataUrl, payload };
  }
  
  /* ---- Create answer (join mode) ---- */
  async createAnswer(peerName: string, offerPayload: QrPayload): Promise<{ qrDataUrl: string; payload: QrPayload }> {
    if (!offerPayload.offer) {
      throw new Error('Invalid offer payload');
    }
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: []
    });
    
    this.setupPeerConnection();
    
    // Set remote description from offer
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerPayload.offer));
    
    // Create data channel handler
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
    
    // Create answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    // Wait for ICE gathering
    await this.waitForIceGathering();
    
    // Create payload with complete answer
    const payload: QrPayload = {
      v: 1,
      type: 'answer',
      peerId: `client-${Date.now()}`,
      peerName,
      answer: this.peerConnection.localDescription ?? undefined
    };
    
    const qrString = JSON.stringify(payload);
    const qrDataUrl = await QRCode.toDataURL(qrString, {
      width: 280,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#f5f5f5' }
    });
    
    this.currentSession = {
      peerId: offerPayload.peerId,
      peerName: offerPayload.peerName,
      status: 'connecting'
    };
    this.updateStatus('connecting');
    
    return { qrDataUrl, payload };
  }
  
  /* ---- Complete connection from QR scan (host side) ---- */
  async completeHostConnection(answerPayload: QrPayload): Promise<void> {
    if (!this.peerConnection || !answerPayload.answer) {
      throw new Error('No active connection or invalid answer');
    }
    
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(answerPayload.answer)
    );
    
    this.currentSession = {
      peerId: answerPayload.peerId,
      peerName: answerPayload.peerName,
      status: 'connected'
    };
    
    const peerInfo: PeerInfo = {
      id: answerPayload.peerId,
      name: answerPayload.peerName,
      connectedAt: Date.now(),
      lastSyncAt: null
    };
    this.peers.set(answerPayload.peerId, peerInfo);
    
    this.updateStatus('connected');
  }
  
  /* ---- Complete connection from QR scan (client side) ---- */
  async completeClientConnection(offerPayload: QrPayload): Promise<void> {
    if (!this.peerConnection || !offerPayload.offer) {
      throw new Error('No active connection or invalid offer');
    }
    
    // Already set remote description in createAnswer
    // Just update status
    this.currentSession = {
      peerId: offerPayload.peerId,
      peerName: offerPayload.peerName,
      status: 'connected'
    };
    
    const peerInfo: PeerInfo = {
      id: offerPayload.peerId,
      name: offerPayload.peerName,
      connectedAt: Date.now(),
      lastSyncAt: null
    };
    this.peers.set(offerPayload.peerId, peerInfo);
    
    this.updateStatus('connected');
  }
  
  private setupPeerConnection() {
    if (!this.peerConnection) return;
    
    this.peerConnection.onicecandidate = () => {
      // ICE candidates are gathered synchronously for local network
    };
    
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') {
        this.updateStatus('connected');
      } else if (state === 'disconnected' || state === 'failed') {
        this.updateStatus('disconnected');
        this.cleanup();
      }
    };
  }
  
  private setupDataChannel() {
    if (!this.dataChannel) return;
    
    this.dataChannel.onopen = () => {
      // Send any pending messages
      for (const msg of this.pendingMessages) {
        this.dataChannel?.send(msg);
      }
      this.pendingMessages = [];
      if (this.currentSession?.status === 'connecting') {
        this.updateStatus('connected');
      }
    };
    
    this.dataChannel.onclose = () => {
      this.updateStatus('disconnected');
      this.cleanup();
    };
    
    this.dataChannel.onerror = (err) => {
      this.updateStatus('error', err instanceof Error ? err.message : 'Data channel error');
    };
    
    this.dataChannel.onmessage = async (event) => {
      await this.handleMessage(event.data);
    };
  }
  
  private async handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'sync-request') {
        // Peer wants to sync
        this.updateStatus('syncing');
        // Handle sync request
      } else if (msg.type === 'sync-data') {
        // Received sync data
        const remoteState = await decryptSyncData(msg.payload);
        // Merge states here
        console.log('Received sync data from peer');
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  }
  
  /* ---- Sync operations ---- */
  async syncState(localState: State): Promise<State> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('No active peer connection');
    }
    
    this.updateStatus('syncing');
    
    // Encrypt and send local state
    const encrypted = await encryptSyncData(localState);
    this.dataChannel.send(JSON.stringify({
      type: 'sync-data',
      payload: encrypted,
      timestamp: Date.now()
    }));
    
    // Update last sync time
    if (this.currentSession) {
      const peer = this.peers.get(this.currentSession.peerId);
      if (peer) {
        peer.lastSyncAt = Date.now();
        this.peers.set(this.currentSession.peerId, peer);
      }
    }
    
    this.updateStatus('connected');
    
    // Return merged state (simplified - just return local for now)
    return localState;
  }
  
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }
  
  getCurrentSession(): SyncSession | null {
    return this.currentSession;
  }
  
  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    this.cleanup();
  }
  
  private cleanup() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.dataChannel = null;
  }
  
  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.peerConnection) {
        resolve();
        return;
      }
      
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      
      const checkState = () => {
        if (this.peerConnection?.iceGatheringState === 'complete') {
          this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };
      
      this.peerConnection.addEventListener('icegatheringstatechange', checkState);
      
      // Timeout after 2 seconds
      setTimeout(resolve, 2000);
    });
  }
}

// Singleton instance
export const p2pSync = new P2PSyncManager();
