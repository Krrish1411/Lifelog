import React, { useEffect, useState, useRef } from "react";
import { Coffee, Pause, Play, Square, Target, Timer, Plus, ExternalLink, Sparkles } from "lucide-react";
import { useApp } from "../store";
import type { Session } from "../types";
import { fmtHMS, sessionSeconds } from "../utils/core";
import { triggerHaptic, isTauri } from "../utils/native";
import { playTimerFinishSound } from "../utils/audio";
import { useApplyTheme } from "../utils/useApplyTheme";
import { invoke } from "@tauri-apps/api/core";
import { Btn, cn } from "./ui";

export function TimerPopout() {
  const { state, set, toast } = useApp();
  const [, force] = useState(0);
  const finishedRef = useRef<string | null>(null);

  // Apply user theme, tokens, fonts, and dark/light modes
  useApplyTheme(state.settings);

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

  // Sound chime when planned countdown reaches zero
  useEffect(() => {
    if (running && remainingSec === 0 && finishedRef.current !== running.id) {
      finishedRef.current = running.id;
      playTimerFinishSound();
      triggerHaptic("success");
      toast("Focus session complete!", "ok");
    }
  }, [running, remainingSec, toast]);

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

  const startQuickSession = (min: number, mode: "pomodoro" | "break" = "pomodoro") => {
    const now = Date.now();
    const newSess: Session = {
      id: "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      startedAt: now,
      endedAt: null,
      plannedMin: min,
      status: "running",
      mode: mode === "break" ? "break" : "pomodoro",
      taskId: null,
      subtaskId: null,
      pauses: [],
    };
    set((s) => ({
      ...s,
      sessions: [
        ...s.sessions.map((x) =>
          x.status === "running" ? { ...x, status: "stopped" as const, endedAt: now } : x
        ),
        newSess,
      ],
    }));
    toast(mode === "break" ? "Break started" : `Started ${min}m session`, "ok");
  };

  const focusMainWindow = async () => {
    if (isTauri) {
      try {
        await invoke("show_window");
        return;
      } catch {}
    }
    if (typeof window !== "undefined" && window.opener) {
      window.opener.focus();
    }
  };

  const big = remainingSec !== null ? fmtHMS(remainingSec) : fmtHMS(elapsedSec);

  return (
    <div
      className="relative flex h-screen w-screen flex-col items-center justify-between p-4 select-none overflow-hidden"
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Ambient Liquid Lighting Mesh */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl opacity-20"
        style={{
          background: "var(--accent)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full blur-3xl opacity-15"
        style={{
          background: openPause ? "var(--warn)" : running ? "var(--ok)" : "var(--accent)",
        }}
      />

      {/* Top Header / Window Drag Region */}
      <div
        data-tauri-drag-region
        className="relative z-10 flex w-full items-center justify-between border-b pb-2.5 cursor-grab active:cursor-grabbing"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <span
            className={cn("h-2.5 w-2.5 rounded-full shrink-0", running && !openPause && "ring-pulse")}
            style={{ background: openPause ? "var(--warn)" : running ? "var(--ok)" : "var(--mut)" }}
          />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
            {running ? (openPause ? "Paused" : running.mode) : "Ready"}
          </span>
        </div>
        <button
          type="button"
          onClick={focusMainWindow}
          className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mut)] hover:text-[var(--text)] transition-colors cursor-pointer"
          title="Switch to full LifeLog application"
        >
          <span>LifeLog</span>
          <ExternalLink size={11} />
        </button>
      </div>

      {/* Main Counter Stage */}
      {running ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 w-full min-w-0 my-2">
          {/* Task and Project info */}
          <div className="flex flex-col items-center text-center max-w-full px-2">
            {proj && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--mut)] mb-0.5">
                <span className="h-2 w-2 rounded-full" style={{ background: proj.color }} />
                <span className="truncate max-w-[200px]">{proj.name}</span>
              </div>
            )}
            <div
              className="font-display text-[15px] font-bold truncate max-w-[300px]"
              title={label}
              style={{ color: "var(--text)" }}
            >
              {label}
            </div>
          </div>

          {/* Large Digits */}
          <div className="relative flex items-center justify-center my-0.5">
            <div
              className="font-mono text-[46px] font-extrabold tracking-tight tnum drop-shadow-sm"
              style={{ color: openPause ? "var(--warn)" : "var(--text)" }}
            >
              {big}
            </div>
          </div>

          {/* Progress bar with glowing liquid indicator */}
          {remainingSec !== null && (
            <div className="w-full max-w-[260px] h-2 rounded-full overflow-hidden p-0.5 bg-[var(--panel2)] border border-[var(--line)]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  background: openPause ? "var(--warn)" : "var(--accent)",
                  boxShadow: `0 0 10px -2px ${openPause ? "var(--warn)" : "var(--accent)"}`,
                }}
              />
            </div>
          )}

          {/* Extend chips */}
          {running.plannedMin && (
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => extend(5)}
                className="chip !py-1 !px-2.5 text-[11px] font-bold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                +5m
              </button>
              <button
                onClick={() => extend(15)}
                className="chip !py-1 !px-2.5 text-[11px] font-bold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                +15m
              </button>
              <button
                onClick={() => extend(25)}
                className="chip !py-1 !px-2.5 text-[11px] font-bold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              >
                +25m
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3.5 text-center p-3 w-full">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border text-[var(--accent)]"
            style={{
              background: "var(--panel2)",
              borderColor: "var(--line)",
            }}
          >
            <Timer size={24} />
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-bold" style={{ color: "var(--text)" }}>
              No active session
            </div>
            <div className="text-xs font-semibold text-[var(--mut)]">
              Start a session or return to LifeLog
            </div>
          </div>

          {/* Quick Start Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1 w-full max-w-[280px]">
            <Btn
              size="sm"
              variant="primary"
              onClick={() => startQuickSession(25, "pomodoro")}
              className="flex-1 text-xs"
            >
              <Play size={12} />
              <span>25m Focus</span>
            </Btn>
            <Btn
              size="sm"
              variant="soft"
              onClick={() => startQuickSession(5, "break")}
              className="text-xs px-3"
            >
              <Coffee size={12} />
              <span>5m Break</span>
            </Btn>
          </div>

          <button
            onClick={focusMainWindow}
            className="text-[11px] font-bold text-[var(--mut)] hover:text-[var(--text)] transition-colors underline decoration-dotted cursor-pointer mt-1"
          >
            Open main window
          </button>
        </div>
      )}

      {/* Bottom Controls */}
      {running && (
        <div
          className="relative z-10 flex w-full gap-2 pt-2.5 border-t"
          style={{ borderColor: "var(--line)" }}
        >
          <Btn
            variant={openPause ? "primary" : "soft"}
            className="flex-1 text-xs font-bold py-2"
            onClick={togglePause}
          >
            {openPause ? <Play size={14} /> : <Pause size={14} />}
            <span>{openPause ? "Resume" : "Pause"}</span>
          </Btn>
          <Btn
            variant="danger"
            className="text-xs font-bold px-4 py-2"
            onClick={stop}
          >
            <Square size={13} />
            <span>Stop</span>
          </Btn>
        </div>
      )}
    </div>
  );
}
