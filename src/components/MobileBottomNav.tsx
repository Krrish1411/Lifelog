import React from "react";
import { LayoutDashboard, ListTodo, Plus, Timer, Grid } from "lucide-react";
import type { ViewId } from "../types";
import { triggerHaptic } from "../utils/native";
import { scrollToPageTop } from "../utils/scrollLock";

interface MobileBottomNavProps {
  currentView: ViewId;
  onSelectView: (view: ViewId) => void;
  onOpenNewTask: () => void;
  onOpenMore: () => void;
  moreOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenNewTask,
  onOpenMore,
  moreOpen,
}) => {
  const handleTab = (v: ViewId) => {
    triggerHaptic("light");
    if (v === currentView) {
      scrollToPageTop("smooth");
    } else {
      scrollToPageTop("auto");
      onSelectView(v);
    }
  };

  const handleFab = () => {
    triggerHaptic("medium");
    onOpenNewTask();
  };

  const handleMore = () => {
    triggerHaptic("light");
    onOpenMore();
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-2 pt-2 md:hidden select-none"
      style={{
        background: "color-mix(in srgb, var(--panel) 92%, transparent)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "max(12px, var(--safe-bottom, env(safe-area-inset-bottom, 12px)))",
      }}
      role="navigation"
      aria-label="Mobile Navigation Bar"
    >
      {/* 1. Today */}
      <button
        type="button"
        onClick={() => handleTab("dashboard")}
        className="flex flex-col items-center justify-center flex-1 py-1 transition-transform active:scale-90"
        style={{
          color: currentView === "dashboard" ? "var(--accent)" : "var(--mut)",
        }}
      >
        <div className="relative flex items-center justify-center">
          <LayoutDashboard size={21} strokeWidth={currentView === "dashboard" ? 2.4 : 1.8} />
          {currentView === "dashboard" && (
            <span
              className="absolute -bottom-1.5 h-1 w-1 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          )}
        </div>
        <span className="mt-1 text-[10.5px] font-bold tracking-tight">Today</span>
      </button>

      {/* 2. Tasks */}
      <button
        type="button"
        onClick={() => handleTab("tasks")}
        className="flex flex-col items-center justify-center flex-1 py-1 transition-transform active:scale-90"
        style={{
          color: currentView === "tasks" ? "var(--accent)" : "var(--mut)",
        }}
      >
        <div className="relative flex items-center justify-center">
          <ListTodo size={21} strokeWidth={currentView === "tasks" ? 2.4 : 1.8} />
          {currentView === "tasks" && (
            <span
              className="absolute -bottom-1.5 h-1 w-1 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          )}
        </div>
        <span className="mt-1 text-[10.5px] font-bold tracking-tight">Tasks</span>
      </button>

      {/* 3. Center Elevated FAB Button (+) */}
      <div className="flex flex-col items-center justify-center -mt-6 px-1">
        <button
          type="button"
          onClick={handleFab}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-lg transition-transform active:scale-85 hover:scale-105 cursor-pointer"
          style={{
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "0 6px 18px color-mix(in srgb, var(--accent) 45%, transparent)",
          }}
          title="New Task"
          aria-label="Create new task"
        >
          <Plus size={26} strokeWidth={2.8} />
        </button>
      </div>

      {/* 4. Focus */}
      <button
        type="button"
        onClick={() => handleTab("focus")}
        className="flex flex-col items-center justify-center flex-1 py-1 transition-transform active:scale-90"
        style={{
          color: currentView === "focus" ? "var(--accent)" : "var(--mut)",
        }}
      >
        <div className="relative flex items-center justify-center">
          <Timer size={21} strokeWidth={currentView === "focus" ? 2.4 : 1.8} />
          {currentView === "focus" && (
            <span
              className="absolute -bottom-1.5 h-1 w-1 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          )}
        </div>
        <span className="mt-1 text-[10.5px] font-bold tracking-tight">Focus</span>
      </button>

      {/* 5. More */}
      <button
        type="button"
        onClick={handleMore}
        className="flex flex-col items-center justify-center flex-1 py-1 transition-transform active:scale-90"
        style={{
          color:
            moreOpen ||
            !["dashboard", "tasks", "focus"].includes(currentView)
              ? "var(--accent)"
              : "var(--mut)",
        }}
      >
        <div className="relative flex items-center justify-center">
          <Grid
            size={21}
            strokeWidth={
              moreOpen || !["dashboard", "tasks", "focus"].includes(currentView) ? 2.4 : 1.8
            }
          />
          {(moreOpen || !["dashboard", "tasks", "focus"].includes(currentView)) && (
            <span
              className="absolute -bottom-1.5 h-1 w-1 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          )}
        </div>
        <span className="mt-1 text-[10.5px] font-bold tracking-tight">More</span>
      </button>
    </nav>
  );
};
