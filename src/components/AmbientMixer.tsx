import React, { useState, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  PowerOff,
  Headphones,
  Check,
} from "lucide-react";
import {
  AMBIENT_TRACKS,
  AMBIENT_PRESETS,
  type AmbientTrackId,
  type AmbientMixerState,
  subscribeAmbientMixer,
  setTrackState,
  setTrackVolume,
  toggleTrack,
  setMasterVolume,
  toggleMute,
  applyPreset,
  stopAllTracks,
  getActiveTrackCount,
} from "../utils/audio";
import { Modal, Btn } from "./ui";

interface AmbientMixerProps {
  open: boolean;
  onClose: () => void;
}

export const AmbientMixer: React.FC<AmbientMixerProps> = ({ open, onClose }) => {
  const [state, setState] = useState<AmbientMixerState>(() => ({
    masterVolume: 0.7,
    muted: false,
    tracks: {} as any,
  }));
  const [activeCategory, setActiveCategory] = useState<string>("All");

  useEffect(() => {
    return subscribeAmbientMixer((nextState) => {
      setState(nextState);
    });
  }, []);

  const activeCount = getActiveTrackCount();
  const categories = ["All", "Nature", "Noise", "Spaces", "Focus"];

  const filteredTracks = AMBIENT_TRACKS.filter((t) =>
    activeCategory === "All" ? true : t.category === activeCategory
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ambient Sound Mixer"
      width={720}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-[var(--color-mut)]">
            <Headphones size={13} className="text-purple-400" />
            <span>
              {activeCount === 0
                ? "No tracks active"
                : `${activeCount} sound${activeCount > 1 ? "s" : ""} playing`}
            </span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={stopAllTracks}
                className="ml-2 text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
              >
                Mute all
              </button>
            )}
          </div>
          <Btn variant="primary" onClick={onClose}>
            Done
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Master Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl border border-[var(--line)] bg-[var(--panel2)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                state.muted
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                  : "border-[var(--line)] bg-[var(--panel)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
              }`}
              title={state.muted ? "Unmute all" : "Mute all"}
            >
              {state.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <div>
              <div className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                Master Volume
                {state.muted && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">
                    MUTED
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[var(--color-mut)]">
                {Math.round(state.masterVolume * 100)}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-1 max-w-[260px]">
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={state.masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-full accent-[var(--color-primary)] h-1.5 rounded-lg cursor-pointer bg-[var(--line)]"
            />
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={stopAllTracks}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer border border-rose-500/20"
            >
              <PowerOff size={12} />
              Stop sounds
            </button>
          )}
        </div>

        {/* Presets Bar */}
        <div>
          <div className="text-xs font-semibold text-[var(--color-mut)] mb-2 flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-400" />
            <span>Blanket Sound Presets</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {AMBIENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--color-primary)] hover:bg-[var(--panel2)] transition cursor-pointer text-[var(--color-text)] font-medium"
                title={preset.description}
              >
                <span>{preset.emoji}</span>
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 border-b border-[var(--line)] pb-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeCategory === cat
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-mut)] hover:text-[var(--color-text)] hover:bg-[var(--panel2)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Multi-Track Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
          {filteredTracks.map((track) => {
            const trackState = state.tracks[track.id] || {
              enabled: false,
              volume: track.defaultVolume,
            };
            const isPlaying = trackState.enabled && !state.muted;

            return (
              <div
                key={track.id}
                className={`p-3.5 rounded-xl border transition flex flex-col gap-2.5 ${
                  trackState.enabled
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-xs"
                    : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--color-mut)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl select-none">{track.emoji}</span>
                    <div>
                      <div className="text-xs font-bold text-[var(--color-text)]">
                        {track.name}
                      </div>
                      <div className="text-[10px] text-[var(--color-mut)]">
                        {track.description}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleTrack(track.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      trackState.enabled
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--panel2)] text-[var(--color-mut)] hover:text-[var(--color-text)] border border-[var(--line)]"
                    }`}
                  >
                    {trackState.enabled ? (
                      <>
                        <Check size={11} /> On
                      </>
                    ) : (
                      "Off"
                    )}
                  </button>
                </div>

                {/* Individual Track Volume Slider */}
                <div className="flex items-center gap-2 pt-1 border-t border-[var(--line)]/50">
                  <Sliders
                    size={12}
                    className={
                      isPlaying
                        ? "text-[var(--color-primary)]"
                        : "text-[var(--color-mut)]"
                    }
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={trackState.volume}
                    disabled={!trackState.enabled}
                    onChange={(e) =>
                      setTrackVolume(track.id, parseFloat(e.target.value))
                    }
                    className={`w-full h-1 rounded cursor-pointer accent-[var(--color-primary)] ${
                      trackState.enabled ? "opacity-100" : "opacity-40 cursor-not-allowed"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-mono w-8 text-right font-medium ${
                      trackState.enabled
                        ? "text-[var(--color-text)]"
                        : "text-[var(--color-mut)]"
                    }`}
                  >
                    {Math.round(trackState.volume * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
