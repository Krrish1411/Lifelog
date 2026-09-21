import React, { useState } from "react";
import { ChevronDown, ChevronRight, Clock, Pause, Play, CheckCircle2, Square, Sparkles } from "lucide-react";
import type { Session } from "../types";
import { fmtClock, fmtDur, sessionMinutes } from "../utils/core";
import { cn } from "./ui";

interface Props {
  session: Session;
  className?: string;
  defaultExpanded?: boolean;
}

export function SessionTimelineBranch({ session, className, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const now = Date.now();
  const endTs = session.endedAt ?? now;
  const grossMs = Math.max(0, endTs - session.startedAt);
  const netMin = sessionMinutes(session, now);

  const pauses = session.pauses || [];
  let totalPauseMs = 0;
  pauses.forEach((p) => {
    const resume = p.resumeAt ?? (session.endedAt ?? now);
    const durMs = Math.max(0, resume - p.at);
    totalPauseMs += durMs;
  });

  const totalPauseMin = Math.round(totalPauseMs / 60000);
  const efficiency = grossMs > 0 ? Math.min(100, Math.round((netMin / Math.max(1, Math.round(grossMs / 60000))) * 100)) : 100;

  // Build the chronological focus & pause legs
  interface Leg {
    type: "focus" | "pause";
    start: number;
    end: number;
    durationMs: number;
    isOpen?: boolean;
  }

  const legs: Leg[] = [];
  let cursor = session.startedAt;

  pauses.forEach((p) => {
    if (p.at > cursor) {
      legs.push({
        type: "focus",
        start: cursor,
        end: p.at,
        durationMs: Math.max(0, p.at - cursor),
      });
    }
    const r = p.resumeAt ?? (session.endedAt ?? now);
    legs.push({
      type: "pause",
      start: p.at,
      end: r,
      durationMs: Math.max(0, r - p.at),
      isOpen: p.resumeAt === null && !session.endedAt,
    });
    cursor = r;
  });

  if (cursor < endTs) {
    legs.push({
      type: "focus",
      start: cursor,
      end: endTs,
      durationMs: Math.max(0, endTs - cursor),
    });
  }

  return (
    <div className={cn("flex flex-col gap-1.5 w-full select-none text-[11px]", className)}>
      {/* Header Pill & Mini Segmented Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--mut)]">
          <Clock size={11} />
          <span>{fmtClock(session.startedAt)} → {session.endedAt ? fmtClock(session.endedAt) : "now"}</span>
        </div>

        {pauses.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10.5px] font-bold transition-colors cursor-pointer hover:border-[var(--accent)] hover:text-[var(--text)]"
            style={{
              borderColor: expanded ? "var(--accent)" : "var(--line)",
              background: expanded ? "var(--accent-soft)" : "var(--panel2)",
              color: expanded ? "var(--accent)" : "var(--warn)",
            }}
            title="Click to view pause & resume branch timeline"
          >
            <Pause size={9} />
            <span>{pauses.length} pause{pauses.length > 1 ? "s" : ""} ({totalPauseMin}m)</span>
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span className="text-[10px] font-semibold text-[var(--ok)]">
            Continuous (0 pauses)
          </span>
        )}
      </div>

      {/* Proportional Segmented Interval Bar */}
      {grossMs > 0 && pauses.length > 0 && (
        <div
          className="w-full h-1.5 rounded-full overflow-hidden flex bg-[var(--panel2)] border border-[var(--line)]/50 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          title="Segmented timeline: Focus (green) vs Pauses (amber)"
        >
          {legs.map((leg, idx) => {
            const widthPct = Math.max(2, (leg.durationMs / grossMs) * 100);
            return (
              <div
                key={idx}
                style={{
                  width: `${widthPct}%`,
                  background: leg.type === "focus" ? "var(--ok)" : "var(--warn)",
                  opacity: leg.isOpen ? 0.6 : 1,
                }}
                className={cn("h-full transition-all", leg.isOpen && "animate-pulse")}
                title={`${leg.type === "focus" ? "🟢 Focus" : "⏸️ Paused"}: ${fmtClock(leg.start)} - ${fmtClock(leg.end)} (${fmtDur(Math.round(leg.durationMs / 60000))})`}
              />
            );
          })}
        </div>
      )}

      {/* Expanded Branch Tree Diagram */}
      {expanded && (
        <div
          className="mt-1.5 p-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel2)]/60 flex flex-col gap-2 font-mono text-[10.5px] animate-fade-in"
        >
          {/* Summary Strip */}
          <div className="flex items-center justify-between pb-1.5 border-b border-[var(--line)]/60 text-[10px] font-sans">
            <span className="font-bold text-[var(--text)]">Focus Branch Audit</span>
            <div className="flex items-center gap-2 font-bold">
              <span className="text-[var(--ok)]">Net: {fmtDur(netMin)}</span>
              <span className="text-[var(--warn)]">Paused: {totalPauseMin}m</span>
              <span className="chip !py-0 !px-1.5 text-[9.5px]" style={{ background: "var(--bg)" }}>
                {efficiency}% locked
              </span>
            </div>
          </div>

          {/* Chronological Tree Nodes */}
          <div className="relative pl-3 flex flex-col gap-2 border-l-2 border-[var(--line)] ml-1.5 my-1">
            {/* Start Node */}
            <div className="relative flex items-start gap-2">
              <span
                className="absolute -left-[19px] top-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg)] flex items-center justify-center text-[7px]"
                style={{ background: "var(--accent)" }}
              />
              <div>
                <span className="font-bold text-[var(--text)]">{fmtClock(session.startedAt)}</span>
                <span className="ml-1.5 text-[var(--mut)]">Started session</span>
              </div>
            </div>

            {/* Intermediate Pause & Resume branches */}
            {legs.map((leg, i) => {
              if (leg.type === "focus") {
                const legMin = Math.round(leg.durationMs / 60000);
                if (legMin <= 0 && legs.length > 1) return null;
                return (
                  <div key={i} className="text-[10px] text-[var(--ok)] pl-1 flex items-center gap-1 font-semibold">
                    <span className="h-1 w-2 border-b border-[var(--ok)]" />
                    <span>Focus run: {fmtDur(Math.max(1, legMin))} active</span>
                  </div>
                );
              }
              const pMin = Math.round(leg.durationMs / 60000);
              return (
                <div key={i} className="relative flex flex-col gap-0.5 my-0.5">
                  <div className="relative flex items-center gap-2">
                    <span
                      className="absolute -left-[19px] top-1 h-3 w-3 rounded-full border-2 border-[var(--bg)]"
                      style={{ background: "var(--warn)" }}
                    />
                    <div>
                      <span className="font-bold text-[var(--warn)]">{fmtClock(leg.start)}</span>
                      <span className="ml-1.5 font-sans font-bold text-[var(--warn)]">
                        Paused for {pMin > 0 ? fmtDur(pMin) : "< 1m"}
                      </span>
                    </div>
                  </div>
                  {!leg.isOpen && (
                    <div className="relative flex items-center gap-2 pl-4 mt-0.5">
                      <span className="text-[10px] text-[var(--mut)]">
                        Resumed at {fmtClock(leg.end)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* End Node */}
            <div className="relative flex items-start gap-2 pt-0.5">
              <span
                className="absolute -left-[19px] top-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg)]"
                style={{
                  background:
                    session.status === "running"
                      ? "var(--ok)"
                      : session.status === "stopped"
                      ? "var(--warn)"
                      : "var(--ok)",
                }}
              />
              <div>
                <span className="font-bold text-[var(--text)]">
                  {session.endedAt ? fmtClock(session.endedAt) : "Now (Running)"}
                </span>
                <span className="ml-1.5 text-[var(--mut)]">
                  {session.status === "running"
                    ? "In progress…"
                    : session.status === "stopped"
                    ? "Stopped early"
                    : "Completed"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
