import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  Wifi,
  WifiOff,
  Check,
  Copy,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Radio,
  Zap,
  ArrowRight,
  ArrowLeftRight,
  KeyRound,
  Lock,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "../store";
import { syncEngine } from "../sync/syncEngine";
import type { SyncStatus, SyncPeerInfo } from "../sync/syncTypes";
import { Modal, Btn, TextInput, Seg, cn } from "./ui";
import { triggerHaptic } from "../utils/native";
import { cleanSeedData, isSeedTask } from "../utils/cleanSeed";

interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
}

export const SyncDialog: React.FC<SyncDialogProps> = ({ open, onClose }) => {
  const { state, set, toast, confirm } = useApp();
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const [peer, setPeer] = useState<SyncPeerInfo | null>(syncEngine.getConnectedPeer());
  
  // Pairing modes: "pin" (automated 6-digit code) or "airgap" (offline base64 ticket)
  const [pairingMode, setPairingMode] = useState<"pin" | "airgap">("pin");
  const [activeTab, setActiveTab] = useState<"host" | "join">("host");
  
  const [deviceName, setDeviceName] = useState(
    state.settings.profileName
      ? `${state.settings.profileName}'s Device`
      : typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
      ? "Android Phone"
      : "Desktop Workstation"
  );

  // 6-digit PIN state
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinStatus, setPinStatus] = useState<string | null>(null);
  const [isPinConnecting, setIsPinConnecting] = useState(false);
  const hostStopperRef = useRef<{ stop: () => void } | null>(null);

  // Air-gapped ticket state
  const [offerTicket, setOfferTicket] = useState<string>("");
  const [offerQrUrl, setOfferQrUrl] = useState<string>("");
  const [answerInput, setAnswerInput] = useState<string>("");
  const [isGeneratingOffer, setIsGeneratingOffer] = useState(false);
  const [joinTicketInput, setJoinTicketInput] = useState<string>("");
  const [answerTicket, setAnswerTicket] = useState<string>("");
  const [answerQrUrl, setAnswerQrUrl] = useState<string>("");
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);

  // UI state
  const [copied, setCopied] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Listen to live sync status changes
  useEffect(() => {
    const unsub = syncEngine.onStatusChange((nextStatus, nextPeer) => {
      setStatus(nextStatus);
      if (nextPeer) setPeer(nextPeer);
      if (nextStatus === "connected") {
        setErrorMsg(null);
        setPinStatus(null);
        setIsPinConnecting(false);
        triggerHaptic("success");
      }
    });
    return unsub;
  }, []);

  // Cleanup active PIN hosting on unmount or dialog close (only if not connected)
  useEffect(() => {
    if (!open && syncEngine.getStatus() !== "connected") {
      hostStopperRef.current?.stop();
      hostStopperRef.current = null;
      setIsPinConnecting(false);
      setPinStatus(null);
    }
  }, [open]);

  // Generate QR code utility
  const generateQr = async (text: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(text, {
        width: 256,
        margin: 1.5,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    } catch (err) {
      console.error("Failed to generate QR code:", err);
      return "";
    }
  };

  /* ------------------- 6-Digit PIN Pairing Handlers ------------------- */
  const handleStartPinHost = async () => {
    try {
      setErrorMsg(null);
      setIsPinConnecting(true);
      const generatedPin = String(Math.floor(100000 + Math.random() * 900000));
      setPin(generatedPin);
      
      const qr = await generateQr(`lifelog-pin:${generatedPin}`);
      setOfferQrUrl(qr);
      triggerHaptic("medium");

      // Start hosting on relay
      const session = await syncEngine.hostWithPin(
        generatedPin,
        deviceName.trim() || "LifeLog Device",
        (msg) => setPinStatus(msg)
      );
      hostStopperRef.current = session;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to start hosting session.");
      setIsPinConnecting(false);
      triggerHaptic("warning");
    }
  };

  const handleStopPinHost = () => {
    hostStopperRef.current?.stop();
    hostStopperRef.current = null;
    setIsPinConnecting(false);
    setPinStatus(null);
    setPin("");
    setOfferQrUrl("");
    syncEngine.disconnect();
  };

  const handleJoinPin = async () => {
    const cleanPin = pinInput.trim().replace(/\s/g, "");
    if (cleanPin.length !== 6) {
      setErrorMsg("Please enter a valid 6-digit PIN code.");
      return;
    }
    try {
      setErrorMsg(null);
      setIsPinConnecting(true);
      setPinStatus("Locating host session...");
      triggerHaptic("medium");

      await syncEngine.joinWithPin(
        cleanPin,
        deviceName.trim() || "LifeLog Device",
        (msg) => setPinStatus(msg)
      );
      setIsPinConnecting(false);
      setPinStatus(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Connection failed. Please verify the 6-digit PIN.");
      setIsPinConnecting(false);
      setPinStatus(null);
      triggerHaptic("warning");
    }
  };

  /* ------------------- Air-Gapped Ticket Handlers ------------------- */
  const handleCreateOffer = async () => {
    try {
      setErrorMsg(null);
      setIsGeneratingOffer(true);
      const ticket = await syncEngine.createSession(deviceName.trim() || "LifeLog Device");
      setOfferTicket(ticket);
      const qr = await generateQr(ticket);
      setOfferQrUrl(qr);
      triggerHaptic("medium");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to generate session ticket.");
      triggerHaptic("warning");
    } finally {
      setIsGeneratingOffer(false);
    }
  };

  const handleAcceptAnswer = async () => {
    if (!answerInput.trim()) return;
    try {
      setErrorMsg(null);
      await syncEngine.acceptAnswer(answerInput.trim());
      triggerHaptic("success");
      toast("Connecting to peer...", "ok");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to accept answer ticket. Please check the code.");
      triggerHaptic("warning");
    }
  };

  const handleJoinSession = async () => {
    if (!joinTicketInput.trim()) return;
    try {
      setErrorMsg(null);
      setIsGeneratingAnswer(true);
      const answer = await syncEngine.joinSession(
        joinTicketInput.trim(),
        deviceName.trim() || "LifeLog Device"
      );
      setAnswerTicket(answer);
      const qr = await generateQr(answer);
      setAnswerQrUrl(qr);
      triggerHaptic("success");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Invalid pairing code. Please make sure you copied the full ticket.");
      triggerHaptic("warning");
    } finally {
      setIsGeneratingAnswer(false);
    }
  };

  const MASTER_KEY = "lifelog.sync.masterEstablished";
  const MASTER_ROLE_KEY = "lifelog.sync.masterRole";
  const MASTER_DEVICE_KEY = "lifelog.sync.masterDeviceName";

  const [masterEstablished, setMasterEstablished] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    return !!localStorage.getItem(MASTER_KEY);
  });
  const [masterRole, setMasterRole] = useState<string>(() => {
    if (typeof localStorage === "undefined") return "master";
    return localStorage.getItem(MASTER_ROLE_KEY) || "master";
  });
  const [masterDeviceName, setMasterDeviceName] = useState<string>(() => {
    if (typeof localStorage === "undefined") return "";
    return localStorage.getItem(MASTER_DEVICE_KEY) || "";
  });
  const [syncDirection, setSyncDirection] = useState<"clone_to_peer" | "two_way">("clone_to_peer");
  const [isApplyingSync, setIsApplyingSync] = useState(false);

  // Listen to remote peer establishing master setup
  useEffect(() => {
    const unsub = syncEngine.onMasterSetup((event) => {
      setMasterEstablished(true);
      const role = event.mode === "clone_to_peer" ? "secondary" : "two_way";
      setMasterRole(role);
      setMasterDeviceName(event.masterDeviceName);
      toast(
        event.mode === "clone_to_peer"
          ? `Primary device (${event.masterDeviceName}) initialized sync! Data mirrored cleanly from 0.`
          : `Two-way sync link established by ${event.masterDeviceName}!`,
        "ok"
      );
    });
    return unsub;
  }, []);

  const demoTasksCount = state?.tasks ? state.tasks.filter(isSeedTask).length : 0;
  const isConnectedOrSyncing = status === "connected" || status === "syncing";

  const handleExecuteSync = async () => {
    if (!state) return;
    setIsApplyingSync(true);
    const myDevice = deviceName.trim() || "LifeLog Device";
    try {
      triggerHaptic("medium");
      if (syncDirection === "clone_to_peer") {
        await syncEngine.forceCloneToPeer(state, myDevice);
        triggerHaptic("success");
        toast(`Master sync complete! Cloned this device's records to ${peer?.deviceName || "peer"}!`, "ok");
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(MASTER_KEY, "true");
          localStorage.setItem(MASTER_ROLE_KEY, "master");
          localStorage.setItem(MASTER_DEVICE_KEY, myDevice);
        }
        setMasterRole("master");
      } else {
        await syncEngine.broadcastFullState(state, true);
        await syncEngine.sendMasterSetupEvent("two_way", myDevice);
        triggerHaptic("success");
        toast("Two-way sync complete (sample demo items filtered)!", "ok");
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(MASTER_KEY, "true");
          localStorage.setItem(MASTER_ROLE_KEY, "two_way");
          localStorage.setItem(MASTER_DEVICE_KEY, myDevice);
        }
        setMasterRole("two_way");
      }
      setMasterEstablished(true);
    } catch (err: any) {
      toast("Sync failed: " + (err?.message || "network error"), "err");
    } finally {
      setIsApplyingSync(false);
    }
  };

  const handlePurgeDemoData = async () => {
    if (!state) return;
    const ok = await confirm({
      title: "Purge Injected Demo Data?",
      body: "This will remove sample tasks ('Hero section redesign', 'Timer engine...'), sample habits, and demo projects that were synced from a new install. Your personal tasks, habits, and notes will NOT be touched.",
      confirmLabel: "Purge Demo Data",
      danger: true,
    });
    if (!ok) return;
    const { cleanedState, stats } = cleanSeedData(state);
    set(() => cleanedState);
    triggerHaptic("medium");
    toast(`Cleaned ${stats.tasksRemoved} demo tasks, ${stats.habitsRemoved} habits & ${stats.projectsRemoved} demo projects!`, "ok");
  };

  const handleSyncFullState = async () => {
    try {
      triggerHaptic("medium");
      await syncEngine.broadcastFullState(state, true);
      toast("All data synchronized with peer!", "ok");
    } catch {
      toast("Failed to synchronize state.", "err");
    }
  };

  const handleDisconnect = () => {
    triggerHaptic("warning");
    handleStopPinHost();
    syncEngine.disconnect();
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(MASTER_KEY);
      localStorage.removeItem(MASTER_ROLE_KEY);
      localStorage.removeItem(MASTER_DEVICE_KEY);
    }
    setMasterEstablished(false);
    setMasterRole("master");
    setMasterDeviceName("");
    setOfferTicket("");
    setAnswerTicket("");
    setAnswerInput("");
    setJoinTicketInput("");
    setOfferQrUrl("");
    setAnswerQrUrl("");
    toast("Sync session disconnected.", "ok");
  };

  const copyToClipboard = (text: string, type: "offer" | "answer" | "pin") => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    triggerHaptic("light");
    toast(type === "pin" ? "PIN copied!" : "Pairing ticket copied to clipboard!", "ok");
    setTimeout(() => setCopied(null), 2500);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isConnectedOrSyncing) {
          handleStopPinHost();
        }
        onClose();
      }}
      title="Peer-to-Peer Device Sync"
      width={620}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 text-xs text-[var(--mut)]">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>AES-GCM-256 Encrypted</span>
          </div>
          <Btn variant="ghost" onClick={onClose}>
            Close
          </Btn>
        </div>
      }
    >
      <div className="space-y-4 text-[13px]">
        {/* Error notification */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Demo Data Injected Warning Banner (Clean tool) */}
        {demoTasksCount > 0 && (
          <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-400">
                <AlertCircle size={15} />
                <span>Detected {demoTasksCount} Sample Demo Tasks</span>
              </div>
              <p className="text-[11.5px] text-[var(--mut)]">
                Sample tasks from a fresh device were synced into this device. Click to purge them safely.
              </p>
            </div>
            <Btn size="sm" variant="danger" onClick={handlePurgeDemoData} className="shrink-0 gap-1 text-xs">
              <Trash2 size={12} /> Purge Demo Data
            </Btn>
          </div>
        )}

        {/* 1. Connected State View */}
        {isConnectedOrSyncing && (
          <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Wifi size={20} />
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                </div>
                <div>
                  <div className="font-bold text-[14px] text-[var(--text)] flex items-center gap-2">
                    <span>{peer?.deviceName || "Connected Device"}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                      LIVE P2P
                    </span>
                  </div>
                  <div className="text-[11.5px] text-[var(--mut)]">
                    Always Sync Active · Low Latency (&lt;50ms)
                  </div>
                </div>
              </div>

              <Btn variant="danger" size="sm" onClick={handleDisconnect}>
                <WifiOff size={13} /> Disconnect
              </Btn>
            </div>

            {/* Sync Direction & Device Role Selector (1st Connection Setup or Active Status) */}
            {!masterEstablished ? (
              <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-xs text-[var(--text)] flex items-center gap-1.5">
                    <ArrowLeftRight size={14} className="text-[var(--accent)]" /> 1st Connection: Device In Control Setup
                  </span>
                  <span className="text-[10px] font-mono text-[var(--accent)] px-2 py-0.5 rounded-md bg-[var(--accent-soft)]">
                    Action Required
                  </span>
                </div>
                <p className="text-[11.5px] text-[var(--mut)] leading-relaxed">
                  To guarantee zero sync errors or leftover sample demo entries, select which device is in control for this initial connection. 
                  Choosing <b>This Device as Master</b> will wipe data on the peer and mirror your local data starting from 0.
                </p>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSyncDirection("clone_to_peer")}
                    className={cn(
                      "flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer",
                      syncDirection === "clone_to_peer"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
                        : "border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--line-hi)]"
                    )}
                  >
                    <span className="mt-0.5 h-4 w-4 rounded-full border border-[var(--line)] flex items-center justify-center shrink-0">
                      {syncDirection === "clone_to_peer" && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[var(--text)] flex items-center gap-1.5">
                        <span>👑 Make THIS Device Primary (Wipe Peer &amp; Start from 0)</span>
                        <span className="chip !py-0 !px-1.5 text-[9px] font-bold text-emerald-500 border-emerald-500/30">Recommended</span>
                      </div>
                      <p className="text-[11px] text-[var(--mut)] mt-1 leading-snug">
                        This device is in control. Peer device data is completely cleared to 0 and replaced with your local tasks, notes, and habits. Guaranteed zero sync conflicts.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncDirection("two_way")}
                    className={cn(
                      "flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer",
                      syncDirection === "two_way"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
                        : "border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--line-hi)]"
                    )}
                  >
                    <span className="mt-0.5 h-4 w-4 rounded-full border border-[var(--line)] flex items-center justify-center shrink-0">
                      {syncDirection === "two_way" && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[var(--text)]">
                        🔄 Smart Two-Way Merge (Keep Both Devices)
                      </div>
                      <p className="text-[11px] text-[var(--mut)] mt-1 leading-snug">
                        Retains data on both devices and exchanges new entries bidirectionally while automatically filtering out fresh demo tasks.
                      </p>
                    </div>
                  </button>
                </div>

                <Btn
                  variant="primary"
                  className="w-full justify-center gap-1.5 py-2.5 text-xs font-bold"
                  onClick={handleExecuteSync}
                  disabled={isApplyingSync}
                >
                  {isApplyingSync ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>{isApplyingSync ? "Setting Up Initial Sync..." : syncDirection === "clone_to_peer" ? `Establish Master: Wipe ${peer?.deviceName || "Peer"} & Mirror from 0` : "Establish Two-Way Synchronized Link"}</span>
                </Btn>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span className="font-bold text-xs text-emerald-400">
                      {masterRole === "secondary"
                        ? `Secondary Replica · Master: ${masterDeviceName || peer?.deviceName || "Device 1"}`
                        : masterRole === "two_way" || syncDirection === "two_way"
                        ? "Continuous Two-Way Sync Active"
                        : "Master Control Active (Single Source of Truth)"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof localStorage !== "undefined") {
                        localStorage.removeItem(MASTER_KEY);
                        localStorage.removeItem(MASTER_ROLE_KEY);
                        localStorage.removeItem(MASTER_DEVICE_KEY);
                      }
                      setMasterEstablished(false);
                    }}
                    className="text-[11px] text-[var(--accent)] hover:underline font-semibold cursor-pointer"
                  >
                    Change Control Mode
                  </button>
                </div>
                <p className="text-[11.5px] text-[var(--mut)] leading-snug">
                  {masterRole === "secondary"
                    ? `This device is synced as a secondary replica of ${masterDeviceName || peer?.deviceName || "Device 1"}. Local records are mirrored from the primary device. Settings remain isolated on each device.`
                    : masterRole === "two_way" || syncDirection === "two_way"
                    ? `Bidirectional synchronization is active with deletion tracking and demo item filtration. Settings remain isolated on each device.`
                    : `This device is authoritative. Changes replicate continuously to ${peer?.deviceName || "peer"}. Settings remain isolated on each device.`}
                </p>
                <div className="pt-1">
                  <Btn
                    variant="outline"
                    size="sm"
                    className="w-full justify-center gap-1.5 text-xs"
                    onClick={handleExecuteSync}
                    disabled={isApplyingSync}
                  >
                    {isApplyingSync ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    <span>{isApplyingSync ? "Syncing..." : "Force Sync Now"}</span>
                  </Btn>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[var(--line)]">
              <div className="p-2 rounded-xl bg-[var(--panel2)]">
                <span className="text-[var(--mut)] block text-[10.5px]">Transport Link</span>
                <span className="font-semibold text-[var(--text)]">
                  {syncEngine.getTransportType() === "webrtc" ? "Direct WebRTC DataChannel" : "Encrypted Cloud Relay"}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--panel2)]">
                <span className="text-[var(--mut)] block text-[10.5px]">End-to-End Security</span>
                <span className="font-semibold text-emerald-400">AES-GCM-256 (E2EE)</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Pairing Configuration View (when not connected) */}
        {!isConnectedOrSyncing && (
          <div className="space-y-4">
            {/* Device Name input */}
            <div>
              <label className="text-xs font-semibold text-[var(--mut)] block mb-1">
                Your Device Name
              </label>
              <TextInput
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. My Phone / Workstation"
              />
            </div>

            {/* Mode Switcher: 6-Digit PIN vs Air-Gapped */}
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--line)" }}>
              <div className="flex items-center gap-1 bg-[var(--panel2)] p-1 rounded-xl border border-[var(--line)] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    handleStopPinHost();
                    setPairingMode("pin");
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer",
                    pairingMode === "pin"
                      ? "bg-[var(--accent)] text-[var(--on-accent)] shadow-xs"
                      : "text-[var(--mut)] hover:text-[var(--text)]"
                  )}
                >
                  <KeyRound size={13} />
                  <span>6-Digit PIN (Easy)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleStopPinHost();
                    setPairingMode("airgap");
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer",
                    pairingMode === "airgap"
                      ? "bg-[var(--accent)] text-[var(--on-accent)] shadow-xs"
                      : "text-[var(--mut)] hover:text-[var(--text)]"
                  )}
                >
                  <Lock size={13} />
                  <span>Air-Gapped Ticket</span>
                </button>
              </div>

              <div className="text-[11px] font-semibold text-[var(--mut)] hidden sm:block">
                {pairingMode === "pin" ? "Zero copy-pasting required" : "Offline / airplane mode"}
              </div>
            </div>

            {/* Role Seg Tabs */}
            <div className="flex justify-center">
              <Seg<"host" | "join">
                value={activeTab}
                onChange={(v) => {
                  handleStopPinHost();
                  setActiveTab(v);
                  setErrorMsg(null);
                }}
                options={[
                  { value: "host", label: "Host Session (Device 1)" },
                  { value: "join", label: "Join Session (Device 2)" },
                ]}
              />
            </div>

            {/* ===================== MODE 1: 6-DIGIT PIN PAIRING ===================== */}
            {pairingMode === "pin" && (
              <div className="space-y-4 pt-1">
                {activeTab === "host" ? (
                  !pin ? (
                    <div className="text-center py-5 space-y-3">
                      <p className="text-xs text-[var(--mut)] max-w-sm mx-auto">
                        Generate a secure 6-digit PIN on this device. Device 2 enters the PIN to connect in seconds.
                      </p>
                      <Btn
                        variant="primary"
                        onClick={handleStartPinHost}
                        disabled={isPinConnecting}
                        className="mx-auto"
                      >
                        <Radio size={14} /> Generate 6-Digit PIN
                      </Btn>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--panel2)] flex flex-col items-center text-center space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                        Enter this PIN on Device 2
                      </span>

                      {/* Big formatted PIN display */}
                      <div className="flex items-center gap-2 font-mono text-3xl font-bold tracking-widest text-[var(--accent)] bg-[var(--bg)] px-6 py-3 rounded-2xl border border-[var(--line)] shadow-sm">
                        <span>{pin.slice(0, 3)}</span>
                        <span className="text-[var(--mut)] opacity-50">·</span>
                        <span>{pin.slice(3, 6)}</span>
                      </div>

                      {offerQrUrl && (
                        <div className="p-2.5 rounded-xl bg-white shadow-md inline-block my-1">
                          <img
                            src={offerQrUrl}
                            alt="Pairing PIN QR Code"
                            className="w-40 h-40 object-contain"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-[var(--mut)]">
                        <Radio size={14} className="animate-pulse text-[var(--accent)]" />
                        <span>{pinStatus || "Waiting for Device 2 to enter PIN..."}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Btn variant="soft" size="sm" onClick={() => copyToClipboard(pin, "pin")}>
                          <Copy size={13} /> Copy PIN
                        </Btn>
                        <Btn variant="danger" size="sm" onClick={handleStopPinHost}>
                          Cancel
                        </Btn>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--panel2)] flex flex-col items-center text-center space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                      Enter the 6-Digit PIN from Device 1
                    </span>

                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && handleJoinPin()}
                      placeholder="• • • • • •"
                      className="inp text-center font-mono text-3xl tracking-[0.25em] font-bold h-14 w-64 max-w-full"
                    />

                    {pinStatus && (
                      <div className="flex items-center gap-2 text-xs text-[var(--accent)] animate-pulse">
                        <RefreshCw size={13} className="animate-spin" />
                        <span>{pinStatus}</span>
                      </div>
                    )}

                    <Btn
                      variant="primary"
                      onClick={handleJoinPin}
                      disabled={pinInput.trim().length !== 6 || isPinConnecting}
                      className="w-48 justify-center"
                    >
                      {isPinConnecting ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Connecting...
                        </>
                      ) : (
                        <>
                          <ArrowRight size={14} /> Connect Now
                        </>
                      )}
                    </Btn>
                  </div>
                )}
              </div>
            )}

            {/* ===================== MODE 2: AIR-GAPPED OFFLINE TICKET ===================== */}
            {pairingMode === "airgap" && (
              <div className="space-y-4 pt-1">
                {activeTab === "host" ? (
                  !offerTicket ? (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-xs text-[var(--mut)]">
                        Generate an offline ticket and QR code to pair without any internet access.
                      </p>
                      <Btn
                        variant="primary"
                        onClick={handleCreateOffer}
                        disabled={isGeneratingOffer}
                        className="mx-auto"
                      >
                        {isGeneratingOffer ? "Generating..." : "Generate Offline Ticket"}
                      </Btn>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-2xl border border-[var(--line)] bg-[var(--panel2)] flex flex-col items-center text-center space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                          Step 1 · Scan or Copy Ticket
                        </span>
                        {offerQrUrl && (
                          <div className="p-2.5 rounded-xl bg-white shadow-md inline-block">
                            <img src={offerQrUrl} alt="Pairing QR Code" className="w-44 h-44 object-contain" />
                          </div>
                        )}
                        <Btn variant="soft" size="sm" onClick={() => copyToClipboard(offerTicket, "offer")}>
                          {copied === "offer" ? <Check size={13} /> : <Copy size={13} />} Copy Ticket
                        </Btn>
                      </div>

                      <div className="p-3.5 rounded-2xl border border-[var(--line)] bg-[var(--panel2)] space-y-2.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] block">
                          Step 2 · Paste Device 2's Answer
                        </span>
                        <div className="flex gap-2">
                          <TextInput
                            value={answerInput}
                            onChange={(e) => setAnswerInput(e.target.value)}
                            placeholder="Paste answer from Device 2..."
                            className="text-xs"
                          />
                          <Btn variant="primary" onClick={handleAcceptAnswer} disabled={!answerInput.trim()}>
                            Connect
                          </Btn>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    {!answerTicket ? (
                      <>
                        <p className="text-xs text-[var(--mut)]">
                          Paste the ticket code provided by Device 1:
                        </p>
                        <textarea
                          value={joinTicketInput}
                          onChange={(e) => setJoinTicketInput(e.target.value)}
                          placeholder="Paste Device 1 ticket code here..."
                          rows={3}
                          className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel2)] p-2.5 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] resize-none"
                        />
                        <Btn
                          variant="primary"
                          onClick={handleJoinSession}
                          disabled={!joinTicketInput.trim() || isGeneratingAnswer}
                          className="w-full justify-center"
                        >
                          {isGeneratingAnswer ? "Processing..." : "Generate Answer Ticket"}
                        </Btn>
                      </>
                    ) : (
                      <div className="p-3.5 rounded-2xl border border-[var(--line)] bg-[var(--panel2)] flex flex-col items-center text-center space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          Answer Generated!
                        </span>
                        {answerQrUrl && (
                          <div className="p-2.5 rounded-xl bg-white shadow-md inline-block">
                            <img src={answerQrUrl} alt="Answer QR Code" className="w-44 h-44 object-contain" />
                          </div>
                        )}
                        <Btn variant="soft" size="sm" onClick={() => copyToClipboard(answerTicket, "answer")}>
                          {copied === "answer" ? <Check size={13} /> : <Copy size={13} />} Copy Answer Code
                        </Btn>
                        <p className="text-[11px] text-[var(--mut)]">
                          Paste this code into Device 1 to finalize pairing.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
