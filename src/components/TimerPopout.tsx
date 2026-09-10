import React, { useEffect, useState } from "react";
import { Coffee, Pause, Play, Square, Target, Timer, Plus } from "lucide-react";
import { useApp } from "../store";
import { fmtHMS, sessionMinutes, sessionSeconds } from "../utils/core";
import { triggerHaptic } from "../utils/native";
import { playTimerFinishSound } from "../utils/audio";
import { Btn, cn } from "./ui";

export function TimerPopout() {
  const { state, set, toast } = useApp();
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(t);
  }, []);

  const running = state.sessions.find((s) => s.status === "running");
  const openPause =
    running &&
    running.pauses.length > 0 &&
    running.pauses[running.pauses.length - 1].resumeAt === null;

  const elapsedSec = running ? sessionSeconds(running) : 0;
  const remainingSec =
    running && running.plannedMin ? Math.max(0, running.plannedMin * 60 - elapsedSec) : null;
  const task = running ? state.tasks.find((t) => t.id === running.taskId) : null;
  const proj = task ? state.projects.find((p) => p.id === task.projectId) : null;
  const label = running?.mode === "break" ? "Break" : task?.title ?? "Focus session";
  const pct =
    running && remainingSec !== null && running.plannedMin
      ? Math.min(100, (elapsedSec / (running.plannedMin * 60)) * 100)
      : 0;

  const togglePause = () => {
    if (!running) return;
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) => {
        if (x.id !== running.id) return x;
        if (openPause) {
          return {
            ...x,
            pauses: x.pauses.map((p, i) =>
              i === x.pauses.length - 1 ? { ...p, resumeAt: Date.now() } : p
            ),
          };
        }
        return { ...x, pauses: [...x.pauses, { at: Date.now(), resumeAt: null }] };
      }),
    }));
    toast(openPause ? "Resumed" : "Paused", "ok");
  };

  const stop = () => {
    if (!running) return;
    triggerHaptic("medium");
    const ts = Date.now();
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) =>
        x.id === running.id
          ? {
              ...x,
              endedAt: ts,
              status: "stopped",
              pauses: x.pauses.map((p) => (p.resumeAt ? p : { ...p, resumeAt: ts })),
            }
          : x
      ),
    }));
    toast("Timer stopped", "ok");
  };

  const extend = (min: number) => {
    if (!running || !running.plannedMin) return;
    const newPlanned = running.plannedMin + min;
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) =>
        x.id === running.id ? { ...x, plannedMin: newPlanned } : x
      ),
    }));
    toast(`+${min}m added`, "ok");
  };

  const big = remainingSec !== null ? fmtHMS(remainingSec) : fmtHMS(elapsedSec);

  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-between p-4 select-none overflow-hidden"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Top Header */}
      <div className="flex w-full items-center justify-between border-b pb-2" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2">
          <span
            className={cn("h-2.5 w-2.5 rounded-full shrink-0", running && !openPause && "ring-pulse")}
            style={{ background: openPause ? "var(--warn)" : running ? "var(--ok)" : "var(--mut)" }}
          />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
            {running ? (openPause ? "Paused" : running.mode) : "Idle"}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[var(--mut)]">LifeLog Timer</span>
      </div>

      {/* Main Counter Stage */}
      {running ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 w-full min-w-0 my-2">
          {/* Task info */}
          <div className="flex flex-col items-center text-center max-w-full px-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--mut)]">
              {proj && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: proj.color }} />
                  <span>{proj.name}</span>
                </span>
              )}
            </div>
            <div className="font-display text-sm font-bold truncate max-w-[280px]" title={label}>
              {label}
            </div>
          </div>

          {/* Large Digits */}
          <div className="relative flex items-center justify-center my-1">
            <div className="font-mono text-[44px] font-extrabold tracking-tight tnum" style={{ color: openPause ? "var(--warn)" : "var(--text)" }}>
              {big}
            </div>
          </div>

          {/* Progress bar */}
          {remainingSec !== null && (
            <div className="w-full max-w-[260px] h-1.5 rounded-full overflow-hidden bg-[var(--panel2)]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: "var(--accent)" }}
              />
            </div>
          )}

          {/* Extend buttons */}
          {running.plannedMin && (
            <div className="flex gap-1.5 mt-1">
              <button
                onClick={() => extend(5)}
                className="chip !py-0.5 !px-2 text-[10px] hover:border-[var(--accent)] cursor-pointer"
              >
                +5m
              </button>
              <button
                onClick={() => extend(15)}
                className="chip !py-0.5 !px-2 text-[10px] hover:border-[var(--accent)] cursor-pointer"
              >
                +15m
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--panel2)] text-[var(--mut)]">
            <Timer size={24} />
          </div>
          <div className="text-xs font-semibold text-[var(--mut)]">
            No focus session is currently running.
          </div>
          <Btn
            size="sm"
            variant="primary"
            onClick={() => {
              window.opener?.focus();
            }}
          >
            Switch to LifeLog
          </Btn>
        </div>
      )}

      {/* Bottom Controls */}
      {running && (
        <div className="flex w-full gap-2 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
          <Btn
            variant={openPause ? "primary" : "soft"}
            className="flex-1 text-xs"
            onClick={togglePause}
          >
            {openPause ? <Play size={13} /> : <Pause size={13} />}
            <span>{openPause ? "Resume" : "Pause"}</span>
          </Btn>
          <Btn variant="danger" className="text-xs px-4" onClick={stop}>
            <Square size={12} />
            <span>Stop</span>
          </Btn>
        </div>
      )}
    </div>
  );
}
