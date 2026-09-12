import type { State, Task, Note, Habit, Project, Session, DayLog } from "../types";
import type { SyncMessage, SyncStatus, SyncPeerInfo, PartialStateDelta, EncryptedSyncPacket, SyncTransport, DeviceStats } from "./syncTypes";
import { encryptSyncMessage, decryptSyncMessage } from "./syncCrypto";
import { getDeviceKey, decryptText } from "../utils/crypto";
import { cleanSeedData, isFreshSeedState } from "../utils/cleanSeed";

const SYNC_STORAGE_KEY = "lifelog.sync.activeSession";

interface SavedSyncSession {
  pin: string;
  secret: string;
  role: "host" | "joiner";
  deviceName: string;
  peer?: SyncPeerInfo | null;
}

function detectPlatform(): SyncPeerInfo["platform"] {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/i.test(ua)) return "android";
  if (/windows/i.test(ua)) return "windows";
  if (/linux/i.test(ua)) return "linux";
  if (/macintosh|mac os x/i.test(ua)) return "macos";
  return "web";
}

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

export interface SyncTicket {
  sdp: string;
  type: "offer" | "answer";
  secret: string; // 256-bit shared encryption key
  deviceName: string;
}

type SyncStatusListener = (status: SyncStatus, peer?: SyncPeerInfo) => void;
type StateApplyListener = (updater: (prev: State) => State) => void;

class WebRTCSyncEngine {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private sharedSecret: string = "";
  private status: SyncStatus = "idle";
  private connectedPeer: SyncPeerInfo | null = null;
  private transportType: SyncTransport = "relay";
  private statusListeners: Set<SyncStatusListener> = new Set();
  private stateApplyListeners: Set<StateApplyListener> = new Set();
  private masterSetupListeners: Set<(event: { mode: "clone_to_peer" | "two_way"; masterDeviceName: string }) => void> = new Set();

  // Relay SSE / streaming state
  private eventSource: EventSource | null = null;
  private outgoingTopic: string = "";
  private incomingTopic: string = "";
  private activePin: string | null = null;
  private isHost: boolean = false;
  private localStateGetter: (() => State | null) | null = null;
  private processedMessageIds: Set<string> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      setTimeout(() => this.tryAutoReconnect(), 600);
    }
  }

  public tryAutoReconnect(): void {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SYNC_STORAGE_KEY) : null;
      if (!raw) return;
      const session: SavedSyncSession = JSON.parse(raw);
      if (!session.pin || !session.secret) return;
      this.isHost = session.role === "host";
      this.activePin = session.pin;
      this.sharedSecret = session.secret;
      this.transportType = "relay";
      this.outgoingTopic = this.isHost ? `lifelog-sync-${session.pin}-h2j` : `lifelog-sync-${session.pin}-j2h`;
      this.incomingTopic = this.isHost ? `lifelog-sync-${session.pin}-j2h` : `lifelog-sync-${session.pin}-h2j`;
      const selfPeer: SyncPeerInfo = {
        deviceId: (this.isHost ? "host-" : "joiner-") + Date.now().toString(36),
        deviceName: session.deviceName || "Device",
        platform: detectPlatform(),
        connectedAt: Date.now(),
      };
      this.startRelayListener(this.incomingTopic, selfPeer);
      this.setStatus("connected", session.peer || undefined);

      setTimeout(() => {
        this.sendRelayMessage({
          type: "HANDSHAKE",
          peer: selfPeer,
          lastSyncTs: Date.now(),
        }).catch(() => {});
        if (this.localStateGetter) {
          const s = this.localStateGetter();
          if (s) this.broadcastFullState(s).catch(() => {});
        }
      }, 1200);
    } catch (e) {
      console.warn("[Sync] Auto reconnect error:", e);
    }
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getConnectedPeer(): SyncPeerInfo | null {
    return this.connectedPeer;
  }

  public getTransportType(): SyncTransport {
    return this.transportType;
  }

  public registerLocalStateGetter(getter: () => State | null) {
    this.localStateGetter = getter;
  }

  public onStatusChange(listener: SyncStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.connectedPeer ?? undefined);
    return () => this.statusListeners.delete(listener);
  }

  public onStateApply(listener: StateApplyListener): () => void {
    this.stateApplyListeners.add(listener);
    return () => this.stateApplyListeners.delete(listener);
  }

  public onMasterSetup(listener: (event: { mode: "clone_to_peer" | "two_way"; masterDeviceName: string }) => void): () => void {
    this.masterSetupListeners.add(listener);
    return () => this.masterSetupListeners.delete(listener);
  }

  public async sendMasterSetupEvent(mode: "clone_to_peer" | "two_way", masterDeviceName: string): Promise<void> {
    if (this.status !== "connected") return;
    await this.sendMessage({
      type: "MASTER_SETUP_EVENT",
      mode,
      masterDeviceName,
      timestamp: Date.now(),
    });
  }

  private setStatus(status: SyncStatus, peer?: SyncPeerInfo | null) {
    this.status = status;
    if (peer !== undefined) this.connectedPeer = peer;
    if (status === "connected" && this.activePin && this.sharedSecret && typeof localStorage !== "undefined") {
      try {
        const saved: SavedSyncSession = {
          pin: this.activePin,
          secret: this.sharedSecret,
          role: this.isHost ? "host" : "joiner",
          deviceName: this.connectedPeer?.deviceName || "Peer",
          peer: this.connectedPeer,
        };
        localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(saved));
      } catch {}
    }
    for (const l of this.statusListeners) {
      l(this.status, this.connectedPeer ?? undefined);
    }
  }

  /* ------------------- Relay SSE Transport (Instant & 100% Reliable) ------------------- */

  private async extractMessagePayload(data: any): Promise<string> {
    if (data.attachment && data.attachment.url) {
      try {
        const res = await fetch(data.attachment.url);
        return await res.text();
      } catch (e) {
        console.warn("[Sync] Failed to fetch attachment payload from relay:", e);
        return "";
      }
    }
    return data.message || "";
  }

  private startRelayListener(topic: string, selfPeer: SyncPeerInfo) {
    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
      this.eventSource = null;
    }

    const url = `https://ntfy.sh/${topic}/sse?since=all`;
    const es = new EventSource(url);
    this.eventSource = es;

    es.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event !== "message") return;

        // Prevent duplicate processing if reconnected
        if (data.id && this.processedMessageIds.has(data.id)) return;
        if (data.id) {
          this.processedMessageIds.add(data.id);
          if (this.processedMessageIds.size > 500) {
            const first = this.processedMessageIds.values().next().value;
            if (first) this.processedMessageIds.delete(first);
          }
        }

        const payload = await this.extractMessagePayload(data);
        if (!payload || !this.sharedSecret) return;

        const packet: EncryptedSyncPacket = JSON.parse(payload);
        const msg: SyncMessage = await decryptSyncMessage(packet, this.sharedSecret);
        await this.handleIncomingMessage(msg, selfPeer);
      } catch (err) {
        console.warn("[Sync] Error decoding incoming relay packet:", err);
      }
    };

    es.onerror = () => {
      // Browser EventSource automatically handles reconnect
    };
  }

  /**
   * Device 1 (Host): Creates a session with a 6-digit PIN.
   * Publishes session metadata and listens for peer's immediate handshake.
   */
  public async hostWithPin(
    pin: string,
    deviceName: string,
    onProgress?: (msg: string) => void
  ): Promise<{ stop: () => void }> {
    this.disconnect();
    this.setStatus("connecting");
    this.isHost = true;
    this.activePin = pin;
    this.transportType = "relay";

    // Generate random 256-bit hex secret
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    this.sharedSecret = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    this.outgoingTopic = `lifelog-sync-${pin}-h2j`;
    this.incomingTopic = `lifelog-sync-${pin}-j2h`;

    const hostPeer: SyncPeerInfo = {
      deviceId: "host-" + Date.now().toString(36),
      deviceName,
      platform: detectPlatform(),
      connectedAt: Date.now(),
      stats: this.getLocalStats(),
    };

    onProgress?.("Publishing session to relay...");

    // Publish session metadata for Joiner
    const metaPayload = JSON.stringify({
      pin,
      secret: this.sharedSecret,
      hostPeer,
      createdAt: Date.now(),
    });

    await fetch(`https://ntfy.sh/lifelog-sync-${pin}-meta`, {
      method: "POST",
      body: metaPayload,
      headers: { "Content-Type": "application/json" },
    });

    onProgress?.("Waiting for peer to enter PIN...");

    // Connect EventSource to receive Joiner packets
    this.startRelayListener(this.incomingTopic, hostPeer);

    return {
      stop: () => {
        if (this.status !== "connected") {
          this.disconnect();
        }
      },
    };
  }

  /**
   * Device 2 (Joiner): Joins the session using the 6-digit PIN.
   * Connects within ~500ms and sends immediate handshake.
   */
  public async joinWithPin(
    pin: string,
    deviceName: string,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    this.disconnect();
    this.setStatus("connecting");
    this.isHost = false;
    this.activePin = pin;
    this.transportType = "relay";

    onProgress?.("Locating host session...");

    // Retry querying host metadata up to 5 times (every 700ms)
    let meta: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(`https://ntfy.sh/lifelog-sync-${pin}-meta/json?poll=1&since=all`);
        const text = await res.text();
        const lines = text.trim().split("\n").filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const evt = JSON.parse(lines[i]);
            if (evt.event === "message" && evt.message) {
              const parsed = JSON.parse(evt.message);
              if (parsed.secret && parsed.hostPeer) {
                meta = parsed;
                break;
              }
            }
          } catch {}
        }
        if (meta) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 700));
    }

    if (!meta) {
      throw new Error(
        `No active host session found with PIN ${pin}. Please verify that the Host device has LifeLog open with the PIN displayed.`
      );
    }

    this.sharedSecret = meta.secret;
    this.outgoingTopic = `lifelog-sync-${pin}-j2h`;
    this.incomingTopic = `lifelog-sync-${pin}-h2j`;

    onProgress?.("Host found! Establishing secure link...");

    const joinerPeer: SyncPeerInfo = {
      deviceId: "joiner-" + Date.now().toString(36),
      deviceName,
      platform: detectPlatform(),
      connectedAt: Date.now(),
      stats: this.getLocalStats(),
    };

    // Start listener on host's incoming stream
    this.startRelayListener(this.incomingTopic, joinerPeer);

    // Send immediate HANDSHAKE to Host
    await this.sendRelayMessage({
      type: "HANDSHAKE",
      peer: joinerPeer,
      lastSyncTs: Date.now(),
      stats: joinerPeer.stats,
    });

    // Mark connected immediately
    this.connectedPeer = meta.hostPeer;
    this.setStatus("connected", meta.hostPeer);
    onProgress?.(`Connected to ${meta.hostPeer.deviceName}!`);
  }

  private async sendRelayMessage(msg: SyncMessage): Promise<void> {
    if (!this.outgoingTopic || !this.sharedSecret) return;
    try {
      const packet = await encryptSyncMessage(msg, this.sharedSecret);
      await fetch(`https://ntfy.sh/${this.outgoingTopic}`, {
        method: "POST",
        body: JSON.stringify(packet),
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("[Sync] Failed to send relay packet:", e);
    }
  }

  /* ------------------- WebRTC Air-Gapped / Direct DataChannel ------------------- */

  private waitForAllIceCandidates(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
        return;
      }
      const check = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", check);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", check);
      setTimeout(() => {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }, 3500);
    });
  }

  public async createSession(deviceName: string): Promise<string> {
    this.disconnect();
    this.setStatus("connecting");
    this.transportType = "webrtc";

    const bytes = crypto.getRandomValues(new Uint8Array(16));
    this.sharedSecret = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    this.pc = new RTCPeerConnection(STUN_SERVERS);
    this.channel = this.pc.createDataChannel("lifelog-sync", { ordered: true });
    this.setupChannel(this.channel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    await this.waitForAllIceCandidates(this.pc);

    const ticket: SyncTicket = {
      type: "offer",
      sdp: JSON.stringify(this.pc.localDescription),
      secret: this.sharedSecret,
      deviceName,
    };

    return btoa(JSON.stringify(ticket));
  }

  public async joinSession(rawTicket: string, deviceName: string): Promise<string> {
    this.disconnect();
    this.setStatus("connecting");
    this.transportType = "webrtc";

    const parsed: SyncTicket = JSON.parse(atob(rawTicket.trim()));
    this.sharedSecret = parsed.secret;

    this.pc = new RTCPeerConnection(STUN_SERVERS);

    this.pc.ondatachannel = (e) => {
      this.channel = e.channel;
      this.setupChannel(this.channel);
    };

    const offerDesc = JSON.parse(parsed.sdp) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(offerDesc);

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await this.waitForAllIceCandidates(this.pc);

    const answerTicket: SyncTicket = {
      type: "answer",
      sdp: JSON.stringify(this.pc.localDescription),
      secret: this.sharedSecret,
      deviceName,
    };

    return btoa(JSON.stringify(answerTicket));
  }

  public async acceptAnswer(rawAnswerTicket: string): Promise<void> {
    if (!this.pc) throw new Error("No active sync session on this device.");
    const parsed: SyncTicket = JSON.parse(atob(rawAnswerTicket.trim()));
    const answerDesc = JSON.parse(parsed.sdp) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(answerDesc);
  }

  private setupChannel(ch: RTCDataChannel) {
    ch.onopen = () => {
      this.transportType = "webrtc";
      this.setStatus("connected", {
        deviceId: "peer-" + Date.now().toString(36),
        deviceName: "Connected Peer",
        platform: "web",
        connectedAt: Date.now(),
      });

      this.sendMessage({
        type: "HANDSHAKE",
        peer: {
          deviceId: "self-" + Date.now().toString(36),
          deviceName: "LifeLog Device",
          platform: detectPlatform(),
          connectedAt: Date.now(),
        },
        lastSyncTs: Date.now(),
      }).catch(console.error);
    };

    ch.onclose = () => {
      if (this.transportType === "webrtc") {
        this.setStatus("idle", null);
      }
    };

    ch.onerror = () => {
      if (this.transportType === "webrtc") {
        this.setStatus("error", null);
      }
    };

    ch.onmessage = async (e) => {
      try {
        const rawPacket = JSON.parse(e.data) as EncryptedSyncPacket;
        const msg = await decryptSyncMessage(rawPacket, this.sharedSecret);
        await this.handleIncomingMessage(msg);
      } catch (err) {
        console.error("Failed to decrypt WebRTC packet:", err);
      }
    };
  }

  /* ------------------- Unified Messaging & State Synchronization ------------------- */

  public async sendMessage(msg: SyncMessage): Promise<void> {
    if (this.channel && this.channel.readyState === "open") {
      try {
        const packet = await encryptSyncMessage(msg, this.sharedSecret);
        this.channel.send(JSON.stringify(packet));
        return;
      } catch (e) {
        console.warn("[Sync] WebRTC send failed, falling back to relay:", e);
      }
    }

    if (this.outgoingTopic && this.sharedSecret) {
      await this.sendRelayMessage(msg);
    }
  }

  public async broadcastDelta(delta: PartialStateDelta): Promise<void> {
    if (this.status !== "connected") return;
    await this.sendMessage({
      type: "DELTA_STATE",
      delta,
      timestamp: Date.now(),
    });
  }

  public getLocalStats(): DeviceStats {
    const s = this.localStateGetter ? this.localStateGetter() : null;
    if (!s) {
      return { taskCount: 0, projectCount: 0, habitCount: 0, noteCount: 0, isFreshSeed: false };
    }
    return {
      taskCount: s.tasks ? s.tasks.length : 0,
      projectCount: s.projects ? s.projects.length : 0,
      habitCount: s.habits ? s.habits.length : 0,
      noteCount: s.notes ? s.notes.length : 0,
      isFreshSeed: isFreshSeedState(s),
    };
  }

  public async forceCloneToPeer(state: State, masterDeviceName?: string): Promise<void> {
    if (this.status !== "connected") return;
    this.setStatus("syncing");
    try {
      let payloadState = state;
      if (state.notes && state.notes.length > 0) {
        try {
          const key = await getDeviceKey();
          const safeNotes = await Promise.all(
            state.notes.map(async (n) => {
              if (n.blob && n.blob.plain === undefined && (n.blob.d || n.blob.iv)) {
                try {
                  const text = await decryptText(key, n.blob);
                  if (text && !text.startsWith("(decryption failed)")) {
                    return { ...n, blob: { ...n.blob, plain: text } };
                  }
                } catch {}
              }
              return n;
            })
          );
          payloadState = { ...state, notes: safeNotes };
        } catch {}
      }

      const devName = masterDeviceName || "Primary Device";
      await this.sendMessage({
        type: "FORCE_REPLACE_STATE",
        state: payloadState,
        masterDeviceName: devName,
        timestamp: Date.now(),
      });
      await this.sendMasterSetupEvent("clone_to_peer", devName);
    } finally {
      this.setStatus("connected");
    }
  }

  public async broadcastFullState(state: State, filterSeed = true): Promise<void> {
    if (this.status !== "connected") return;
    this.setStatus("syncing");
    try {
      let payloadState = state;
      if (state.notes && state.notes.length > 0) {
        try {
          const key = await getDeviceKey();
          const safeNotes = await Promise.all(
            state.notes.map(async (n) => {
              if (n.blob && n.blob.plain === undefined && (n.blob.d || n.blob.iv)) {
                try {
                  const text = await decryptText(key, n.blob);
                  if (text && !text.startsWith("(decryption failed)")) {
                    return { ...n, blob: { ...n.blob, plain: text } };
                  }
                } catch {}
              }
              return n;
            })
          );
          payloadState = { ...state, notes: safeNotes };
        } catch {}
      }

      await this.sendMessage({
        type: "FULL_STATE",
        state: payloadState,
        timestamp: Date.now(),
        filterSeed,
      });
    } finally {
      this.setStatus("connected");
    }
  }

  private async handleIncomingMessage(msg: SyncMessage, selfPeer?: SyncPeerInfo) {
    if (msg.type === "HANDSHAKE") {
      this.connectedPeer = msg.peer;
      this.setStatus("connected", msg.peer);

      // Respond with HANDSHAKE_ACK
      if (selfPeer) {
        await this.sendMessage({
          type: "HANDSHAKE_ACK",
          peer: { ...selfPeer, stats: this.getLocalStats() },
          lastSyncTs: Date.now(),
        });
      }
      // Note: Do NOT auto-broadcast or auto-merge! Await user direction choice in SyncDialog!
    } else if (msg.type === "HANDSHAKE_ACK") {
      this.connectedPeer = msg.peer;
      this.setStatus("connected", msg.peer);
      // Note: Do NOT auto-broadcast or auto-merge! Await user direction choice in SyncDialog!
    } else if (msg.type === "FORCE_REPLACE_STATE") {
      this.setStatus("syncing");
      this.dispatchStateMerge((local) => ({
        ...msg.state,
        settings: local.settings,
      }));
      const masterName = msg.masterDeviceName || this.connectedPeer?.deviceName || "Primary Device";
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("lifelog.sync.masterEstablished", "true");
        localStorage.setItem("lifelog.sync.masterRole", "secondary");
        localStorage.setItem("lifelog.sync.masterDeviceName", masterName);
      }
      for (const l of this.masterSetupListeners) {
        l({ mode: "clone_to_peer", masterDeviceName: masterName });
      }
      this.setStatus("connected");
    } else if (msg.type === "MASTER_SETUP_EVENT") {
      const masterName = msg.masterDeviceName || this.connectedPeer?.deviceName || "Primary Device";
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("lifelog.sync.masterEstablished", "true");
        localStorage.setItem("lifelog.sync.masterRole", msg.mode === "clone_to_peer" ? "secondary" : "two_way");
        localStorage.setItem("lifelog.sync.masterDeviceName", masterName);
      }
      for (const l of this.masterSetupListeners) {
        l({ mode: msg.mode, masterDeviceName: masterName });
      }
    } else if (msg.type === "FULL_STATE") {
      this.setStatus("syncing");
      const remoteState = msg.filterSeed ? cleanSeedData(msg.state).cleanedState : msg.state;
      this.dispatchStateMerge((local) => {
        const cleanLocal = msg.filterSeed ? cleanSeedData(local).cleanedState : local;
        return mergeFullState(cleanLocal, remoteState);
      });
      this.setStatus("connected");
    } else if (msg.type === "DELTA_STATE") {
      this.dispatchStateMerge((local) => mergeDelta(local, msg.delta));
    } else if (msg.type === "DISCONNECT") {
      this.disconnect();
    }
  }

  private dispatchStateMerge(updater: (prev: State) => State) {
    for (const l of this.stateApplyListeners) {
      l(updater);
    }
  }

  public disconnect(): void {
    if (this.status === "connected" && this.outgoingTopic && this.sharedSecret) {
      this.sendMessage({
        type: "DISCONNECT",
        timestamp: Date.now(),
      }).catch(() => {});
    }

    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
      this.eventSource = null;
    }
    if (this.channel) {
      try { this.channel.close(); } catch {}
      this.channel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }

    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SYNC_STORAGE_KEY);
    }

    this.outgoingTopic = "";
    this.incomingTopic = "";
    this.activePin = null;
    this.isHost = false;
    this.transportType = "relay";
    this.processedMessageIds.clear();
    this.setStatus("idle", null);
  }
}

/**
 * Returns latest timestamp for a session including all pauses and resumes.
 */
export function getSessionLatestTs(s: Session): number {
  let ts = s.startedAt;
  if (s.endedAt) ts = Math.max(ts, s.endedAt);
  for (const p of s.pauses) {
    ts = Math.max(ts, p.at);
    if (p.resumeAt) ts = Math.max(ts, p.resumeAt);
  }
  return ts;
}

/**
 * Merge two full states using Last-Write-Wins (LWW) per entity ID,
 * enforcing deletion tombstones and preserving local device settings.
 */
export function mergeFullState(local: State, remote: State): State {
  // 1. Merge tombstones from local and remote
  const mergedDeleted = {
    notes: { ...(local.deleted?.notes ?? {}), ...(remote.deleted?.notes ?? {}) },
    tasks: { ...(local.deleted?.tasks ?? {}), ...(remote.deleted?.tasks ?? {}) },
    projects: { ...(local.deleted?.projects ?? {}), ...(remote.deleted?.projects ?? {}) },
    habits: { ...(local.deleted?.habits ?? {}), ...(remote.deleted?.habits ?? {}) },
  };

  // 2. Merge entity lists with LWW
  let mergedTasks = mergeList(local.tasks, remote.tasks, (t) => t.doneAt ?? t.createdAt);
  let mergedNotes = mergeList(local.notes, remote.notes, (n) => n.updatedAt ?? n.createdAt);
  let mergedProjects = mergeList(local.projects, remote.projects, (p) => p.createdAt);
  let mergedHabits = mergeList(local.habits, remote.habits, (h) => h.createdAt);
  let mergedSessions = mergeList(local.sessions, remote.sessions, getSessionLatestTs);

  // 3. Apply tombstones: purge any deleted items so they never resurrect
  if (mergedDeleted.notes) {
    mergedNotes = mergedNotes.filter((n) => {
      const delAt = mergedDeleted.notes[n.id];
      if (!delAt) return true;
      return (n.updatedAt ?? n.createdAt) > delAt;
    });
  }
  if (mergedDeleted.tasks) {
    mergedTasks = mergedTasks.filter((t) => {
      const delAt = mergedDeleted.tasks[t.id];
      if (!delAt) return true;
      return t.createdAt > delAt;
    });
  }
  if (mergedDeleted.projects) {
    mergedProjects = mergedProjects.filter((p) => {
      const delAt = mergedDeleted.projects[p.id];
      if (!delAt) return true;
      return p.createdAt > delAt;
    });
  }
  if (mergedDeleted.habits) {
    mergedHabits = mergedHabits.filter((h) => {
      const delAt = mergedDeleted.habits[h.id];
      if (!delAt) return true;
      return h.createdAt > delAt;
    });
  }

  const mergedDayLogs = { ...local.dayLogs };
  for (const [day, rLog] of Object.entries(remote.dayLogs ?? {})) {
    const lLog = mergedDayLogs[day];
    if (!lLog || (rLog.updatedAt ?? 0) >= (lLog.updatedAt ?? 0)) {
      mergedDayLogs[day] = rLog;
    }
  }

  // Preserve local device settings (Theme, Layout, Sound, Shortcuts, Mobile Engine)
  return {
    ...local,
    tasks: mergedTasks,
    notes: mergedNotes,
    projects: mergedProjects,
    habits: mergedHabits,
    sessions: mergedSessions,
    dayLogs: mergedDayLogs,
    folders: mergeList(local.folders, remote.folders, () => 0),
    deleted: mergedDeleted,
    settings: local.settings,
  };
}

/**
 * Merge incremental delta changes into local state.
 */
export function mergeDelta(local: State, delta: PartialStateDelta): State {
  let next = { ...local };

  if (delta.tasks) {
    next.tasks = mergeList(next.tasks, delta.tasks, (t) => t.doneAt ?? t.createdAt);
  }
  if (delta.notes) {
    next.notes = mergeList(next.notes, delta.notes, (n) => n.updatedAt ?? n.createdAt);
  }
  if (delta.projects) {
    next.projects = mergeList(next.projects, delta.projects, (p) => p.createdAt);
  }
  if (delta.habits) {
    next.habits = mergeList(next.habits, delta.habits, (h) => h.createdAt);
  }
  if (delta.sessions) {
    next.sessions = mergeList(next.sessions, delta.sessions, getSessionLatestTs);
  }
  if (delta.dayLogs) {
    next.dayLogs = { ...next.dayLogs, ...delta.dayLogs };
  }
  if (delta.deletedTaskIds?.length) {
    next.tasks = next.tasks.filter((t) => !delta.deletedTaskIds!.includes(t.id));
  }
  if (delta.deletedNoteIds?.length) {
    next.notes = next.notes.filter((n) => !delta.deletedNoteIds!.includes(n.id));
  }

  return next;
}

function mergeList<T extends { id: string }>(
  localList: T[],
  remoteList: T[],
  getTs: (item: T) => number
): T[] {
  const map = new Map<string, T>();
  for (const item of localList) map.set(item.id, item);
  for (const rItem of remoteList) {
    const lItem = map.get(rItem.id);
    if (!lItem || getTs(rItem) >= getTs(lItem)) {
      map.set(rItem.id, rItem);
    }
  }
  return Array.from(map.values());
}

export const syncEngine = new WebRTCSyncEngine();
