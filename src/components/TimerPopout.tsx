import React, { useEffect, useState, useRef } from "react";
import { Coffee, Pause, Play, Square, Target, Timer, Plus, ExternalLink, Sparkles, Flame, Clock } from "lucide-react";
import { useApp } from "../store";
import type { Session } from "../types";
import { fmtHMS, sessionSeconds } from "../utils/core";
import { triggerHaptic } from "../utils/native";
import { playTimerFinishSound, playTimerStopSound, playTimerStartSound, playTimerToggleSound } from "../utils/audio";
import { useApplyTheme } from "../utils/useApplyTheme";
import { Btn, cn } from "./ui";

export function TimerPopout() {
  const { state, set, toast } = useApp();
  const [, force] = useState(0);
  const finishedRef = useRef<string | null>(null);
  const [completedOffer, setCompletedOffer] = useState<{ mode: string; plannedMin?: number | null; title?: string } | null>(null);

  // Apply user theme, tokens, fonts, and dark/light modes
  useApplyTheme(state.settings);

  const running = state.sessions.find((s) => s.status === "running");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
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

  // Auto-complete session when countdown reaches zero (don't stay stuck on 0:00 screen!)
  useEffect(() => {
    if (running && remainingSec === 0 && finishedRef.current !== running.id) {
      finishedRef.current = running.id;
      const ts = Date.now();
      const finishedMode = running.mode;
      const finishedPlanned = running.plannedMin;
      setCompletedOffer({ mode: finishedMode, plannedMin: finishedPlanned });

      set((s) => ({
        ...s,
        sessions: s.sessions.map((x) =>
          x.id === running.id
            ? {
                ...x,
                endedAt: ts,
                status: "done" as const,
                updatedAt: ts,
                pauses: x.pauses.map((p) => (p.resumeAt ? p : { ...p, resumeAt: ts })),
              }
            : x
        ),
      }));

      playTimerFinishSound(finishedMode === "break" ? "break" : "complete");
      triggerHaptic("success");
      toast(finishedMode === "break" ? "Break finished! Ready to focus." : "Focus session complete!", "ok");
    }
  }, [running, remainingSec, toast, set]);

  const togglePause = () => {
    if (!running) return;
    playTimerToggleSound(openPause ? false : true);
    triggerHaptic("light");
    const ts = Date.now();
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) => {
        if (x.id !== running.id) return x;
        if (openPause) {
          return {
            ...x,
            updatedAt: ts,
            pauses: x.pauses.map((p, i) =>
              i === x.pauses.length - 1 ? { ...p, resumeAt: ts } : p
            ),
          };
        }
        return { ...x, updatedAt: ts, pauses: [...x.pauses, { at: ts, resumeAt: null }] };
      }),
    }));
    toast(openPause ? "Resumed" : "Paused", "ok");
  };

  const stop = () => {
    if (!running) return;
    playTimerStopSound();
    triggerHaptic("medium");
    const ts = Date.now();
    const stoppedTaskTitle = task?.title || (running.mode === "break" ? "Break" : "Focus Session");
    const stoppedMode = running.mode;
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) =>
        x.id === running.id
          ? {
              ...x,
              endedAt: ts,
              status: "stopped",
              updatedAt: ts,
              pauses: x.pauses.map((p) => (p.resumeAt ? p : { ...p, resumeAt: ts })),
            }
          : x
      ),
    }));
    toast("Timer stopped", "ok");
    setCompletedOffer({ title: stoppedTaskTitle, mode: stoppedMode });
  };

  const extend = (min: number) => {
    if (!running || !running.plannedMin) return;
    const newPlanned = running.plannedMin + min;
    const ts = Date.now();
    set((s) => ({
      ...s,
      sessions: s.sessions.map((x) =>
        x.id === running.id ? { ...x, plannedMin: newPlanned, updatedAt: ts } : x
      ),
    }));
    toast(`+${min}m added`, "ok");
  };

  const startQuickSession = (min: number | null, mode: "pomodoro" | "countdown" | "flow" | "break" = "pomodoro") => {
    playTimerStartSound();
    triggerHaptic("light");
    setCompletedOffer(null);
    const now = Date.now();
    const newSess: Session = {
      id: "sess_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      startedAt: now,
      endedAt: null,
      plannedMin: min,
      status: "running",
      mode: mode === "break" ? "break" : mode,
      taskId: null,
      subtaskId: null,
      pauses: [],
      updatedAt: now,
    };
    set((s) => ({
      ...s,
      sessions: [
        ...s.sessions.map((x) =>
          x.status === "running" ? { ...x, status: "stopped" as const, endedAt: now, updatedAt: now } : x
        ),
        newSess,
      ],
    }));
    toast(
      mode === "break"
        ? `${min ?? 5}m Break started`
        : mode === "flow"
        ? "Flow session started (open-ended)"
        : `Started ${min}m ${mode === "pomodoro" ? "Pomodoro" : "Countdown"}`,
      "ok"
    );
  };

  const focusMainWindow = async () => {
    if (window.electronAPI?.focusMainWindow) {
      await window.electronAPI.focusMainWindow();
      return;
    }
    if (typeof window !== "undefined" && window.opener) {
      try {
        window.opener.focus();
      } catch {}
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

      {/* Top Header */}
      <div
        className="relative z-10 flex w-full items-center justify-between border-b pb-2.5"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-2">
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
      ) : completedOffer ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 text-center p-3 w-full animate-fade-in">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border text-[var(--ok)] ring-pulse"
            style={{
              background: "var(--panel2)",
              borderColor: "var(--ok)",
            }}
          >
            <Sparkles size={24} />
          </div>
          <div className="space-y-0.5">
            <div className="text-[15px] font-bold" style={{ color: "var(--text)" }}>
              {completedOffer.mode === "break"
                ? "Break Finished!"
                : completedOffer.title
                ? `🎉 ${completedOffer.title}`
                : "🎉 Session Complete!"}
            </div>
            <div className="text-xs font-semibold text-[var(--mut)]">
              {completedOffer.mode === "break"
                ? "Feeling refreshed? Time to dive back in."
                : "Great momentum! Take a break or start your next block."}
            </div>
          </div>

          {/* Break and Focus options */}
          <div className="flex flex-col gap-2 mt-1 w-full max-w-[270px]">
            {completedOffer.mode !== "break" ? (
              <>
                <div className="flex gap-2">
                  <Btn
                    size="sm"
                    variant="soft"
                    onClick={() => startQuickSession(5, "break")}
                    className="flex-1 text-xs py-2 !border-[var(--ok)]/40 text-[var(--ok)]"
                  >
                    <Coffee size={13} />
                    <span>5m Break</span>
                  </Btn>
                  <Btn
                    size="sm"
                    variant="soft"
                    onClick={() => startQuickSession(15, "break")}
                    className="flex-1 text-xs py-2 text-[var(--mut)]"
                  >
                    <Coffee size={13} />
                    <span>15m Long</span>
                  </Btn>
                </div>
                <div className="flex gap-2">
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => startQuickSession(25, "pomodoro")}
                    className="flex-1 text-xs py-2"
                  >
                    <Play size={12} />
                    <span>25m Focus</span>
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => startQuickSession(null, "flow")}
                    className="flex-1 text-xs py-2"
                  >
                    <Flame size={12} />
                    <span>Flow Mode</span>
                  </Btn>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <Btn
                  size="sm"
                  variant="primary"
                  onClick={() => startQuickSession(25, "pomodoro")}
                  className="flex-1 text-xs py-2"
                >
                  <Play size={12} />
                  <span>25m Focus</span>
                </Btn>
                <Btn
                  size="sm"
                  variant="soft"
                  onClick={() => startQuickSession(null, "flow")}
                  className="flex-1 text-xs py-2"
                >
                  <Flame size={12} />
                  <span>Flow Mode</span>
                </Btn>
              </div>
            )}
          </div>

          <button
            onClick={focusMainWindow}
            className="text-[11px] font-bold text-[var(--mut)] hover:text-[var(--text)] transition-colors underline decoration-dotted cursor-pointer mt-1"
          >
            Open main window
          </button>
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 text-center p-3 w-full">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border text-[var(--accent)]"
            style={{
              background: "var(--panel2)",
              borderColor: "var(--line)",
            }}
          >
            <Timer size={22} />
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-bold" style={{ color: "var(--text)" }}>
              No active session
            </div>
            <div className="text-xs font-semibold text-[var(--mut)]">
              Pick a mode or return to LifeLog
            </div>
          </div>

          {/* Multi-mode Quick Start Grid */}
          <div className="flex flex-col gap-1.5 mt-1 w-full max-w-[270px]">
            <div className="flex gap-1.5">
              <Btn
                size="sm"
                variant="primary"
                onClick={() => startQuickSession(25, "pomodoro")}
                className="flex-1 text-xs py-1.5"
                title="Standard 25-minute Pomodoro block"
              >
                <Play size={12} />
                <span>25m Focus</span>
              </Btn>
              <Btn
                size="sm"
                variant="soft"
                onClick={() => startQuickSession(null, "flow")}
                className="flex-1 text-xs py-1.5"
                title="Open-ended stopwatch flow session"
              >
                <Flame size={12} />
                <span>Flow</span>
              </Btn>
            </div>
            <div className="flex gap-1.5">
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => startQuickSession(15, "countdown")}
                className="flex-1 text-[11px] py-1 text-[var(--mut)]"
              >
                <Clock size={11} />
                <span>15m Timer</span>
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => startQuickSession(45, "countdown")}
                className="flex-1 text-[11px] py-1 text-[var(--mut)]"
              >
                <Clock size={11} />
                <span>45m Timer</span>
              </Btn>
              <Btn
                size="sm"
                variant="soft"
                onClick={() => startQuickSession(5, "break")}
                className="text-[11px] px-2.5 py-1"
                title="Take a quick 5-minute break"
              >
                <Coffee size={11} />
                <span>5m</span>
              </Btn>
            </div>
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
