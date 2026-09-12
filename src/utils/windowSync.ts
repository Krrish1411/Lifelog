import type { State } from "../types";

export interface StateSyncMessage {
  type: "STATE_SYNC" | "REQUEST_STATE";
  senderId: string;
  state?: State;
  timestamp: number;
}

// Generate unique ID for this window instance (e.g. "main_x829" or "timer-popout_k91a")
const SENDER_ID =
  typeof window !== "undefined"
    ? `${window.location.hash.replace("#", "") || "main"}_${Math.random().toString(36).slice(2, 8)}`
    : "win_srv";

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    broadcastChannel = new BroadcastChannel("lifelog_window_sync");
  }
} catch {
  broadcastChannel = null;
}

/**
 * Broadcasts state updates to all other windows (main, popout, etc.)
 * Uses BroadcastChannel (supported natively in all modern browsers and Electron).
 */
export async function broadcastWindowState(state: State): Promise<void> {
  const msg: StateSyncMessage = {
    type: "STATE_SYNC",
    senderId: SENDER_ID,
    state,
    timestamp: Date.now(),
  };

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(msg);
    } catch (e) {
      console.warn("BroadcastChannel postMessage error:", e);
    }
  }
}

/**
 * Sends a request to any existing open window to broadcast the latest state.
 */
export async function requestLatestState(): Promise<void> {
  const msg: StateSyncMessage = {
    type: "REQUEST_STATE",
    senderId: SENDER_ID,
    timestamp: Date.now(),
  };

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(msg);
    } catch {}
  }
}

/**
 * Subscribes to state updates from other windows.
 */
export function onWindowStateSync(
  onUpdate: (state: State) => void,
  getState?: () => State | null
): () => void {
  const unsubs: (() => void)[] = [];

  const handleMessage = (msg: StateSyncMessage) => {
    if (!msg || msg.senderId === SENDER_ID) return; // Ignore self

    if (msg.type === "REQUEST_STATE") {
      // Another window just opened and needs the latest state
      const current = getState ? getState() : null;
      if (current) {
        broadcastWindowState(current);
      }
      return;
    }

    if (msg.type === "STATE_SYNC" && msg.state) {
      onUpdate(msg.state);
    }
  };

  if (broadcastChannel) {
    const handleBcMessage = (e: MessageEvent<StateSyncMessage>) => {
      handleMessage(e.data);
    };
    broadcastChannel.addEventListener("message", handleBcMessage);
    unsubs.push(() => broadcastChannel?.removeEventListener("message", handleBcMessage));
  }

  return () => {
    for (const u of unsubs) u();
  };
}
