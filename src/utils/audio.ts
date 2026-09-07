/**
 * Synthetic audio chime & Blanket-style multi-track ambient soundscape engine.
 * 100% offline, zero external audio files, pure Web Audio API synthesis.
 */

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Ensures the Web Audio context is resumed on direct user touch/click.
 */
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

/**
 * Inspiring, crisp upward start chime when countdown/Pomodoro begins.
 */
export function playTimerStartSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes = [698.46, 880.0]; // F5 -> A5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      const startTime = now + idx * 0.1;
      const duration = 0.75;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.42 / (idx + 1), startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch {
    // Audio autoplay restrictions
  }
}

/**
 * Resonant, harmonic Tibetan singing bell chime when timer or break finishes.
 * Boosted ~2.5x louder with smooth harmonic envelope without clipping.
 */
export function playTimerFinishSound(type: "complete" | "break" = "complete"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const freqs = type === "complete" ? [528.0, 792.0, 1056.0] : [440.0, 659.25, 880.0];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      const startTime = now + idx * 0.12;
      const duration = 2.0;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.48 / (idx + 1), startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch {
    // Audio autoplay restrictions
  }
}

export function playTimerChime(type: "complete" | "break" = "complete"): void {
  playTimerFinishSound(type);
}

export type AmbientTrackId =
  | "rain"
  | "storm"
  | "wind"
  | "waves"
  | "stream"
  | "birds"
  | "cafe"
  | "brown"
  | "pink"
  | "white"
  | "binaural";

export type SoundscapeType = "none" | AmbientTrackId;

export interface AmbientTrackMeta {
  id: AmbientTrackId;
  name: string;
  category: "Nature" | "Noise" | "Spaces" | "Focus";
  emoji: string;
  description: string;
  defaultVolume: number;
}

export const AMBIENT_TRACKS: AmbientTrackMeta[] = [
  { id: "rain", name: "Rain", category: "Nature", emoji: "🌧️", description: "Gentle falling rain shower", defaultVolume: 0.5 },
  { id: "storm", name: "Thunderstorm", category: "Nature", emoji: "⛈️", description: "Rain with low rolling thunder", defaultVolume: 0.45 },
  { id: "wind", name: "Wind Gusts", category: "Nature", emoji: "🍃", description: "Soothing natural wind breeze", defaultVolume: 0.4 },
  { id: "waves", name: "Ocean Waves", category: "Nature", emoji: "🌊", description: "Rhythmic rolling shoreline surf", defaultVolume: 0.55 },
  { id: "stream", name: "Brook Stream", category: "Nature", emoji: "💧", description: "Babbling mountain creek water", defaultVolume: 0.45 },
  { id: "birds", name: "Forest Birds", category: "Nature", emoji: "🌲", description: "Woodland chirps and peaceful wild birds", defaultVolume: 0.35 },
  { id: "cafe", name: "Coffee Shop", category: "Spaces", emoji: "☕", description: "Gentle distant cafe bustle and murmur", defaultVolume: 0.4 },
  { id: "brown", name: "Brown Noise", category: "Noise", emoji: "🟫", description: "Deep, soothing low-frequency rumble", defaultVolume: 0.5 },
  { id: "pink", name: "Pink Noise", category: "Noise", emoji: "🌸", description: "Balanced full-spectrum natural static", defaultVolume: 0.4 },
  { id: "white", name: "White Noise", category: "Noise", emoji: "⚪", description: "Crisp waterfall-like masking noise", defaultVolume: 0.3 },
  { id: "binaural", name: "10Hz Alpha Beats", category: "Focus", emoji: "🧠", description: "Stereo beats promoting flow state", defaultVolume: 0.35 },
];

export interface AmbientPreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tracks: Partial<Record<AmbientTrackId, number>>;
}

export const AMBIENT_PRESETS: AmbientPreset[] = [
  {
    id: "rainy-cafe",
    name: "Rainy Cafe",
    description: "Rain outside with cozy coffee shop murmur",
    emoji: "☕🌧️",
    tracks: { rain: 0.6, cafe: 0.45 },
  },
  {
    id: "deep-focus",
    name: "Deep Flow",
    description: "Brown noise + 10Hz alpha wave focus harmonics",
    emoji: "🧠⚡",
    tracks: { brown: 0.5, binaural: 0.4 },
  },
  {
    id: "ocean-shore",
    name: "Ocean Breeze",
    description: "Rolling ocean waves with calming coastal wind",
    emoji: "🌊🍃",
    tracks: { waves: 0.6, wind: 0.3 },
  },
  {
    id: "forest-creek",
    name: "Forest Stream",
    description: "Babbling mountain stream, birds, and whispering wind",
    emoji: "🌲💧",
    tracks: { stream: 0.5, birds: 0.4, wind: 0.25 },
  },
  {
    id: "cozy-storm",
    name: "Midnight Thunder",
    description: "Thunderstorm rumble with rain and brown noise warmth",
    emoji: "⛈️🟫",
    tracks: { storm: 0.55, rain: 0.4, brown: 0.25 },
  },
];

export interface AmbientMixerState {
  masterVolume: number;
  muted: boolean;
  tracks: Record<AmbientTrackId, { enabled: boolean; volume: number }>;
}

const STORAGE_KEY = "lifelog_ambient_mixer_v1";

function loadInitialState(): AmbientMixerState {
  const defaultTracks: Record<AmbientTrackId, { enabled: boolean; volume: number }> = {
    rain: { enabled: false, volume: 0.5 },
    storm: { enabled: false, volume: 0.45 },
    wind: { enabled: false, volume: 0.4 },
    waves: { enabled: false, volume: 0.55 },
    stream: { enabled: false, volume: 0.45 },
    birds: { enabled: false, volume: 0.35 },
    cafe: { enabled: false, volume: 0.4 },
    brown: { enabled: false, volume: 0.5 },
    pink: { enabled: false, volume: 0.4 },
    white: { enabled: false, volume: 0.3 },
    binaural: { enabled: false, volume: 0.35 },
  };

  if (typeof window === "undefined") {
    return { masterVolume: 0.7, muted: false, tracks: defaultTracks };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        masterVolume: typeof parsed.masterVolume === "number" ? parsed.masterVolume : 0.7,
        muted: Boolean(parsed.muted),
        tracks: { ...defaultTracks, ...(parsed.tracks || {}) },
      };
    }
  } catch {
    // ignore
  }

  return { masterVolume: 0.7, muted: false, tracks: defaultTracks };
}

let mixerState: AmbientMixerState = loadInitialState();
const listeners = new Set<(s: AmbientMixerState) => void>();

function notifyListeners() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mixerState));
  } catch {
    // ignore
  }
  listeners.forEach((fn) => {
    try {
      fn(mixerState);
    } catch {
      // ignore
    }
  });
}

export function subscribeAmbientMixer(fn: (s: AmbientMixerState) => void): () => void {
  listeners.add(fn);
  fn(mixerState);
  return () => {
    listeners.delete(fn);
  };
}

export function getAmbientMixerState(): AmbientMixerState {
  return mixerState;
}

/* ---------------- Audio Engine Internals ---------------- */
let masterGain: GainNode | null = null;

interface ActiveTrackNode {
  trackGain: GainNode;
  cleanup: () => void;
}

const activeNodes: Partial<Record<AmbientTrackId, ActiveTrackNode>> = {};

function initMaster(): GainNode | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!masterGain) {
    masterGain = ctx.createGain();
    const effectiveVol = mixerState.muted ? 0 : mixerState.masterVolume;
    masterGain.gain.setValueAtTime(effectiveVol, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

function createNoiseBuffer(ctx: AudioContext, type: "white" | "pink" | "brown", durationSec: number = 4): AudioBuffer {
  const bufferSize = ctx.sampleRate * durationSec;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === "white") {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
      b6 = white * 0.115926;
    }
  } else if (type === "brown") {
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
  }
  return buffer;
}

function startTrackSynth(ctx: AudioContext, trackId: AmbientTrackId, targetNode: GainNode): () => void {
  const cleanupFns: Array<() => void> = [];

  try {
    if (trackId === "brown" || trackId === "pink" || trackId === "white") {
      const buf = createNoiseBuffer(ctx, trackId);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      if (trackId === "brown") {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(450, ctx.currentTime);
        src.connect(filter);
        filter.connect(targetNode);
        cleanupFns.push(() => {
          try {
            src.stop();
            src.disconnect();
            filter.disconnect();
          } catch {}
        });
      } else {
        src.connect(targetNode);
        cleanupFns.push(() => {
          try {
            src.stop();
            src.disconnect();
          } catch {}
        });
      }
      src.start();
    } else if (trackId === "rain") {
      const buf = createNoiseBuffer(ctx, "pink");
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const bq1 = ctx.createBiquadFilter();
      bq1.type = "bandpass";
      bq1.frequency.setValueAtTime(1100, ctx.currentTime);
      bq1.Q.setValueAtTime(0.7, ctx.currentTime);

      const bq2 = ctx.createBiquadFilter();
      bq2.type = "lowpass";
      bq2.frequency.setValueAtTime(3200, ctx.currentTime);

      src.connect(bq1);
      bq1.connect(bq2);
      bq2.connect(targetNode);
      src.start();

      cleanupFns.push(() => {
        try {
          src.stop();
          src.disconnect();
          bq1.disconnect();
          bq2.disconnect();
        } catch {}
      });
    } else if (trackId === "storm") {
      // Base rain bed + random periodic low thunder rumbles
      const buf = createNoiseBuffer(ctx, "brown");
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(140, ctx.currentTime);

      src.connect(lp);
      lp.connect(targetNode);
      src.start();

      let thunderTimer: any = null;
      const scheduleThunder = () => {
        const delay = 5000 + Math.random() * 8000;
        thunderTimer = setTimeout(() => {
          try {
            if (ctx.state !== "running") return;
            const rumbleOsc = ctx.createOscillator();
            const rumbleGain = ctx.createGain();
            rumbleOsc.type = "triangle";
            rumbleOsc.frequency.setValueAtTime(42 + Math.random() * 20, ctx.currentTime);
            rumbleGain.gain.setValueAtTime(0.001, ctx.currentTime);
            rumbleGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.6);
            rumbleGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);

            rumbleOsc.connect(rumbleGain);
            rumbleGain.connect(targetNode);
            rumbleOsc.start();
            rumbleOsc.stop(ctx.currentTime + 3.5);
          } catch {}
          scheduleThunder();
        }, delay);
      };
      scheduleThunder();

      cleanupFns.push(() => {
        if (thunderTimer) clearTimeout(thunderTimer);
        try {
          src.stop();
          src.disconnect();
          lp.disconnect();
        } catch {}
      });
    } else if (trackId === "wind") {
      const buf = createNoiseBuffer(ctx, "pink");
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(500, ctx.currentTime);
      filter.Q.setValueAtTime(2.2, ctx.currentTime);

      // LFO modulation for wind gusts
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(280, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      src.connect(filter);
      filter.connect(targetNode);

      lfo.start();
      src.start();

      cleanupFns.push(() => {
        try {
          src.stop();
          lfo.stop();
          src.disconnect();
          lfo.disconnect();
          lfoGain.disconnect();
          filter.disconnect();
        } catch {}
      });
    } else if (trackId === "waves") {
      const buf = createNoiseBuffer(ctx, "pink");
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(700, ctx.currentTime);

      const waveGain = ctx.createGain();
      waveGain.gain.setValueAtTime(0.2, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.09, ctx.currentTime); // ~11 sec wave cycle
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.35, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(waveGain.gain);

      src.connect(lp);
      lp.connect(waveGain);
      waveGain.connect(targetNode);

      lfo.start();
      src.start();

      cleanupFns.push(() => {
        try {
          src.stop();
          lfo.stop();
          src.disconnect();
          lfo.disconnect();
          lfoGain.disconnect();
          lp.disconnect();
          waveGain.disconnect();
        } catch {}
      });
    } else if (trackId === "stream") {
      const buf = createNoiseBuffer(ctx, "white");
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1300, ctx.currentTime);
      bp.Q.setValueAtTime(1.8, ctx.currentTime);

      // Ripple modulation
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(1.4, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(250, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(bp.frequency);

      src.connect(bp);
      bp.connect(targetNode);

      lfo.start();
      src.start();

      cleanupFns.push(() => {
        try {
          src.stop();
          lfo.stop();
          src.disconnect();
          lfo.disconnect();
          bp.disconnect();
        } catch {}
      });
    } else if (trackId === "birds") {
      // Periodic forest birds chirping
      let birdTimer: any = null;
      const playChirp = () => {
        const next = 2500 + Math.random() * 4500;
        birdTimer = setTimeout(() => {
          try {
            if (ctx.state !== "running") return;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            const baseFreq = 2600 + Math.random() * 1200;
            osc.type = "sine";
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq + 800, ctx.currentTime + 0.08);
            osc.frequency.exponentialRampToValueAtTime(baseFreq - 300, ctx.currentTime + 0.16);

            g.gain.setValueAtTime(0.001, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

            osc.connect(g);
            g.connect(targetNode);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
          } catch {}
          playChirp();
        }, next);
      };
      playChirp();

      cleanupFns.push(() => {
        if (birdTimer) clearTimeout(birdTimer);
      });
    } else if (trackId === "cafe") {
      // Distant warm chatter rumble + cafe background
      const buf = createNoiseBuffer(ctx, "pink");
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(480, ctx.currentTime);

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(800, ctx.currentTime);
      bp.Q.setValueAtTime(0.6, ctx.currentTime);

      src.connect(lp);
      lp.connect(bp);
      bp.connect(targetNode);
      src.start();

      cleanupFns.push(() => {
        try {
          src.stop();
          src.disconnect();
          lp.disconnect();
          bp.disconnect();
        } catch {}
      });
    } else if (trackId === "binaural") {
      // 10Hz Alpha Binaural Beats (210Hz Left, 200Hz Right)
      const oscL = ctx.createOscillator();
      const oscR = ctx.createOscillator();
      oscL.type = "sine";
      oscR.type = "sine";
      oscL.frequency.setValueAtTime(210, ctx.currentTime);
      oscR.frequency.setValueAtTime(200, ctx.currentTime);

      const merger = ctx.createChannelMerger(2);
      const gainL = ctx.createGain();
      const gainR = ctx.createGain();
      gainL.gain.setValueAtTime(0.28, ctx.currentTime);
      gainR.gain.setValueAtTime(0.28, ctx.currentTime);

      oscL.connect(gainL);
      oscR.connect(gainR);
      gainL.connect(merger, 0, 0);
      gainR.connect(merger, 0, 1);
      merger.connect(targetNode);

      oscL.start();
      oscR.start();

      cleanupFns.push(() => {
        try {
          oscL.stop();
          oscR.stop();
          oscL.disconnect();
          oscR.disconnect();
          gainL.disconnect();
          gainR.disconnect();
          merger.disconnect();
        } catch {}
      });
    }
  } catch {
    // ignore
  }

  return () => {
    cleanupFns.forEach((f) => {
      try {
        f();
      } catch {}
    });
  };
}

function syncTrackAudio(trackId: AmbientTrackId) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const master = initMaster();
  if (!master) return;

  const trackInfo = mixerState.tracks[trackId];
  const shouldPlay = trackInfo?.enabled && !mixerState.muted;

  if (shouldPlay) {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    let nodeInfo = activeNodes[trackId];
    if (!nodeInfo) {
      const trackGain = ctx.createGain();
      trackGain.gain.setValueAtTime(trackInfo.volume * 0.45, ctx.currentTime);
      trackGain.connect(master);
      const cleanup = startTrackSynth(ctx, trackId, trackGain);
      nodeInfo = { trackGain, cleanup };
      activeNodes[trackId] = nodeInfo;
    } else {
      nodeInfo.trackGain.gain.setValueAtTime(trackInfo.volume * 0.45, ctx.currentTime);
    }
  } else {
    const nodeInfo = activeNodes[trackId];
    if (nodeInfo) {
      try {
        nodeInfo.cleanup();
        nodeInfo.trackGain.disconnect();
      } catch {}
      delete activeNodes[trackId];
    }
  }
}

function syncAllAudio() {
  const ctx = getAudioContext();
  if (masterGain && ctx) {
    const effectiveVol = mixerState.muted ? 0 : mixerState.masterVolume;
    masterGain.gain.setValueAtTime(effectiveVol, ctx.currentTime);
  }
  (Object.keys(mixerState.tracks) as AmbientTrackId[]).forEach(syncTrackAudio);
}

/* ---------------- Public API ---------------- */

export function setTrackState(trackId: AmbientTrackId, enabled: boolean, volume?: number): void {
  const cur = mixerState.tracks[trackId] || { enabled: false, volume: 0.5 };
  mixerState = {
    ...mixerState,
    tracks: {
      ...mixerState.tracks,
      [trackId]: {
        enabled,
        volume: volume !== undefined ? Math.max(0, Math.min(1, volume)) : cur.volume,
      },
    },
  };
  syncTrackAudio(trackId);
  notifyListeners();
}

export function setTrackVolume(trackId: AmbientTrackId, volume: number): void {
  const cur = mixerState.tracks[trackId];
  if (!cur) return;
  setTrackState(trackId, cur.enabled, volume);
}

export function toggleTrack(trackId: AmbientTrackId): void {
  const cur = mixerState.tracks[trackId];
  setTrackState(trackId, !cur?.enabled);
}

export function setMasterVolume(volume: number): void {
  mixerState = {
    ...mixerState,
    masterVolume: Math.max(0, Math.min(1, volume)),
  };
  syncAllAudio();
  notifyListeners();
}

export function toggleMute(): boolean {
  mixerState = {
    ...mixerState,
    muted: !mixerState.muted,
  };
  syncAllAudio();
  notifyListeners();
  return mixerState.muted;
}

export function applyPreset(presetId: string): void {
  const preset = AMBIENT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;

  const nextTracks: Record<AmbientTrackId, { enabled: boolean; volume: number }> = { ...mixerState.tracks };
  (Object.keys(nextTracks) as AmbientTrackId[]).forEach((id) => {
    if (preset.tracks[id] !== undefined) {
      nextTracks[id] = { enabled: true, volume: preset.tracks[id]! };
    } else {
      nextTracks[id] = { ...nextTracks[id], enabled: false };
    }
  });

  mixerState = {
    ...mixerState,
    muted: false,
    tracks: nextTracks,
  };
  syncAllAudio();
  notifyListeners();
}

export function stopAllTracks(): void {
  const nextTracks: Record<AmbientTrackId, { enabled: boolean; volume: number }> = { ...mixerState.tracks };
  (Object.keys(nextTracks) as AmbientTrackId[]).forEach((id) => {
    nextTracks[id] = { ...nextTracks[id], enabled: false };
  });
  mixerState = {
    ...mixerState,
    tracks: nextTracks,
  };
  syncAllAudio();
  notifyListeners();
}

export function getActiveTrackCount(): number {
  return Object.values(mixerState.tracks).filter((t) => t.enabled).length;
}

/* Backward compatibility layer for legacy calls */
export function getCurrentSoundscape(): SoundscapeType {
  const active = (Object.keys(mixerState.tracks) as AmbientTrackId[]).find((k) => mixerState.tracks[k]?.enabled);
  return active || "none";
}

export function startSoundscape(type: SoundscapeType, initialVolume: number = 0.5): void {
  if (type === "none") {
    stopAllTracks();
    return;
  }
  const nextTracks: Record<AmbientTrackId, { enabled: boolean; volume: number }> = { ...mixerState.tracks };
  (Object.keys(nextTracks) as AmbientTrackId[]).forEach((id) => {
    nextTracks[id] = { ...nextTracks[id], enabled: id === type };
    if (id === type) {
      nextTracks[id].volume = Math.max(0, Math.min(1, initialVolume));
    }
  });
  mixerState = {
    ...mixerState,
    muted: false,
    tracks: nextTracks,
  };
  syncAllAudio();
  notifyListeners();
}

export function stopSoundscape(): void {
  stopAllTracks();
}

export function setSoundscapeVolume(volume: number): void {
  setMasterVolume(volume);
}
