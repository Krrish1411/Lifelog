import type { State, Task, Note, Habit, Project, Session, DayLog } from "../types";
import type { SyncMessage, SyncStatus, SyncPeerInfo, PartialStateDelta, EncryptedSyncPacket } from "./syncTypes";
import { encryptSyncMessage, decryptSyncMessage } from "./syncCrypto";

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
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
  private statusListeners: Set<SyncStatusListener> = new Set();
  private stateApplyListeners: Set<StateApplyListener> = new Set();

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getConnectedPeer(): SyncPeerInfo | null {
    return this.connectedPeer;
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

  private setStatus(status: SyncStatus, peer?: SyncPeerInfo | null) {
    this.status = status;
    if (peer !== undefined) this.connectedPeer = peer;
    for (const l of this.statusListeners) {
      l(this.status, this.connectedPeer ?? undefined);
    }
  }

  /**
   * Helper to wait for ICE gathering to complete before packaging the SDP.
   */
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
      // Timeout fallback: after 2.5s resolve with whatever candidates gathered
      setTimeout(() => {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }, 2500);
    });
  }

  /**
   * Device 1 (Host): Creates a session ticket (Offer + Encryption Key).
   */
  public async createSession(deviceName: string): Promise<string> {
    this.disconnect();
    this.setStatus("connecting");

    // Generate random 256-bit hex secret
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

  /**
   * Device 2 (Joiner): Joins an existing session by scanning or pasting the host's ticket.
   */
  public async joinSession(rawTicket: string, deviceName: string): Promise<string> {
    this.disconnect();
    this.setStatus("connecting");

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

  /**
   * Device 1 (Host): Accepts the answer ticket from Device 2 to finalize the WebRTC handshake.
   */
  public async acceptAnswer(rawAnswerTicket: string): Promise<void> {
    if (!this.pc) throw new Error("No active sync session on this device.");
    const parsed: SyncTicket = JSON.parse(atob(rawAnswerTicket.trim()));
    const answerDesc = JSON.parse(parsed.sdp) as RTCSessionDescriptionInit;
    await this.pc.setRemoteDescription(answerDesc);
  }

  /**
   * Device 1 (Host): Creates a session ticket and publishes it to a public relay with a 6-digit PIN.
   * Continuously checks for the peer's answer until connected or cancelled.
   */
  public async hostWithPin(
    pin: string,
    deviceName: string,
    onProgress?: (msg: string) => void
  ): Promise<{ stop: () => void }> {
    const offerTicket = await this.createSession(deviceName);
    onProgress?.("Publishing session to relay...");

    // Publish offer
    await fetch(`https://ntfy.sh/lifelog-sync-${pin}-offer`, {
      method: "POST",
      body: offerTicket,
    });

    onProgress?.("Waiting for peer to enter PIN...");

    let cancelled = false;
    let pollTimer: any = null;

    const pollAnswer = async () => {
      if (cancelled || this.getStatus() === "connected") return;
      try {
        const res = await fetch(`https://ntfy.sh/lifelog-sync-${pin}-answer/json?poll=1&since=all`);
        const text = await res.text();
        const events = text
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            try {
              return JSON.parse(l);
            } catch {
              return null;
            }
          })
          .filter((e) => e && e.event === "message");

        if (events.length > 0) {
          const answerTicket = events[events.length - 1].message;
          onProgress?.("Peer connected! Establishing encrypted link...");
          await this.acceptAnswer(answerTicket);
          return;
        }
      } catch {
        // Retry next poll
      }
      if (!cancelled && this.getStatus() !== "connected") {
        pollTimer = setTimeout(pollAnswer, 1500);
      }
    };

    pollTimer = setTimeout(pollAnswer, 1200);

    return {
      stop: () => {
        cancelled = true;
        if (pollTimer) clearTimeout(pollTimer);
      },
    };
  }

  /**
   * Device 2 (Joiner): Joins a session using the 6-digit PIN.
   */
  public async joinWithPin(
    pin: string,
    deviceName: string,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    onProgress?.("Locating host session...");
    const res = await fetch(`https://ntfy.sh/lifelog-sync-${pin}-offer/json?poll=1&since=all`);
    const text = await res.text();
    const events = text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.event === "message");

    if (events.length === 0) {
      throw new Error("No active host found with this PIN. Please make sure the host has LifeLog open with the PIN displayed.");
    }

    const offerTicket = events[events.length - 1].message;
    onProgress?.("Found host! Creating encrypted response...");

    const answerTicket = await this.joinSession(offerTicket, deviceName);

    onProgress?.("Sending response to host...");
    await fetch(`https://ntfy.sh/lifelog-sync-${pin}-answer`, {
      method: "POST",
      body: answerTicket,
    });

    onProgress?.("Connecting directly to peer...");
  }

  /**
   * Setup listeners on the open WebRTC DataChannel.
   */
  private setupChannel(ch: RTCDataChannel) {
    ch.onopen = () => {
      this.setStatus("connected", {
        deviceId: "peer-" + Date.now().toString(36),
        deviceName: "Connected Peer",
        platform: "web",
        connectedAt: Date.now(),
      });
      // Send initial handshake ping
      this.sendMessage({
        type: "HANDSHAKE",
        peer: {
          deviceId: "self-" + Date.now().toString(36),
          deviceName: "LifeLog Device",
          platform: "web",
          connectedAt: Date.now(),
        },
        lastSyncTs: Date.now(),
      }).catch(console.error);
    };

    ch.onclose = () => {
      this.setStatus("idle", null);
    };

    ch.onerror = () => {
      this.setStatus("error", null);
    };

    ch.onmessage = async (e) => {
      try {
        const rawPacket = JSON.parse(e.data) as EncryptedSyncPacket;
        const msg = await decryptSyncMessage(rawPacket, this.sharedSecret);
        await this.handleIncomingMessage(msg);
      } catch (err) {
        console.error("Failed to decrypt or handle sync packet:", err);
      }
    };
  }

  /**
   * Encrypt and send a typed SyncMessage over the DataChannel.
   */
  public async sendMessage(msg: SyncMessage): Promise<void> {
    if (!this.channel || this.channel.readyState !== "open") return;
    const packet = await encryptSyncMessage(msg, this.sharedSecret);
    this.channel.send(JSON.stringify(packet));
  }

  /**
   * Send live state delta over the active DataChannel ("Always Sync").
   */
  public async broadcastDelta(delta: PartialStateDelta): Promise<void> {
    if (this.status !== "connected") return;
    await this.sendMessage({
      type: "DELTA_STATE",
      delta,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast full state to peer (e.g. on initial pair or manual sync).
   */
  public async broadcastFullState(state: State): Promise<void> {
    if (this.status !== "connected") return;
    this.setStatus("syncing");
    await this.sendMessage({
      type: "FULL_STATE",
      state,
      timestamp: Date.now(),
    });
    this.setStatus("connected");
  }

  /**
   * Process incoming decrypted sync messages.
   */
  private async handleIncomingMessage(msg: SyncMessage) {
    if (msg.type === "FULL_STATE") {
      this.setStatus("syncing");
      this.dispatchStateMerge((local) => mergeFullState(local, msg.state));
      this.setStatus("connected");
    } else if (msg.type === "DELTA_STATE") {
      this.dispatchStateMerge((local) => mergeDelta(local, msg.delta));
    } else if (msg.type === "HANDSHAKE") {
      this.connectedPeer = msg.peer;
      this.setStatus("connected", msg.peer);
    }
  }

  private dispatchStateMerge(updater: (prev: State) => State) {
    for (const l of this.stateApplyListeners) {
      l(updater);
    }
  }

  public disconnect(): void {
    if (this.channel) {
      try { this.channel.close(); } catch {}
      this.channel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
    this.setStatus("idle", null);
  }
}

/**
 * Merge two full states using Last-Write-Wins (LWW) per entity ID.
 */
export function mergeFullState(local: State, remote: State): State {
  const mergedTasks = mergeList(local.tasks, remote.tasks, (t) => t.doneAt ?? t.createdAt);
  const mergedNotes = mergeList(local.notes, remote.notes, (n) => n.updatedAt ?? n.createdAt);
  const mergedProjects = mergeList(local.projects, remote.projects, (p) => p.createdAt);
  const mergedHabits = mergeList(local.habits, remote.habits, (h) => h.createdAt);
  const mergedSessions = mergeList(local.sessions, remote.sessions, (s) => s.endedAt ?? s.startedAt);

  const mergedDayLogs = { ...local.dayLogs };
  for (const [day, rLog] of Object.entries(remote.dayLogs ?? {})) {
    const lLog = mergedDayLogs[day];
    if (!lLog || (rLog.updatedAt ?? 0) >= (lLog.updatedAt ?? 0)) {
      mergedDayLogs[day] = rLog;
    }
  }

  return {
    ...local,
    tasks: mergedTasks,
    notes: mergedNotes,
    projects: mergedProjects,
    habits: mergedHabits,
    sessions: mergedSessions,
    dayLogs: mergedDayLogs,
    folders: mergeList(local.folders, remote.folders, () => 0),
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
    next.sessions = mergeList(next.sessions, delta.sessions, (s) => s.endedAt ?? s.startedAt);
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
