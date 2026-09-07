import type { State, Task, Note, Habit, Project, Session, DayLog } from "../types";

export type SyncRole = "host" | "client";
export type SyncStatus = "idle" | "connecting" | "connected" | "syncing" | "error";

export interface SyncPeerInfo {
  deviceId: string;
  deviceName: string;
  platform: "android" | "windows" | "linux" | "macos" | "web";
  connectedAt: number;
}

export type SyncMessage =
  | { type: "HANDSHAKE"; peer: SyncPeerInfo; lastSyncTs: number }
  | { type: "HANDSHAKE_ACK"; peer: SyncPeerInfo; lastSyncTs: number }
  | { type: "FULL_STATE"; state: State; timestamp: number }
  | { type: "DELTA_STATE"; delta: PartialStateDelta; timestamp: number }
  | { type: "PING"; timestamp: number }
  | { type: "PONG"; timestamp: number };

export interface PartialStateDelta {
  tasks?: Task[];
  notes?: Note[];
  habits?: Habit[];
  projects?: Project[];
  sessions?: Session[];
  dayLogs?: Record<string, DayLog>;
  deletedTaskIds?: string[];
  deletedNoteIds?: string[];
  deletedHabitIds?: string[];
  deletedProjectIds?: string[];
}

export interface EncryptedSyncPacket {
  iv: string; // base64 IV
  salt: string; // base64 salt
  ciphertext: string; // base64 AES-GCM ciphertext
  tagLength: number;
}
