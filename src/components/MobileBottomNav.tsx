import React from "react";
import { LayoutDashboard, ListTodo, Plus, Timer, Grid } from "lucide-react";
import type { MobileLayoutMode, ViewId } from "../types";
import { triggerHaptic } from "../utils/native";
import { scrollToPageTop } from "../utils/scrollLock";

interface MobileBottomNavProps {
  currentView: ViewId;
  onSelectView: (view: ViewId) => void;
  onOpenNewTask: () => void;
  onOpenMore: () => void;
  moreOpen: boolean;
  mobileLayout?: MobileLayoutMode;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenNewTask,
  onOpenMore,
  moreOpen,
  mobileLayout = "classic",
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

  /* 1. LIQUID GLASS ENGINE: Floating VisionOS-style pill dock */
  if (mobileLayout === "liquid") {
    return (
      <div className="fixed bottom-3 inset-x-3 sm:inset-x-6 z-40 flex justify-center md:hidden pointer-events-none select-none">
        <nav
          className="pointer-events-auto glass-elevated rounded-full px-2.5 py-1.5 flex items-center justify-between w-full max-w-md shadow-2xl transition-all duration-300"
          style={{
            boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.75), inset 0 1px 0.5px 0 rgba(255, 255, 255, 0.3)",
          }}
          role="navigation"
          aria-label="Mobile Navigation Bar"
        >
          {/* Today */}
          <button
            type="button"
            onClick={() => handleTab("dashboard")}
            className="relative flex flex-col items-center justify-center flex-1 py-1 rounded-full transition-all active:scale-90 cursor-pointer"
            style={{
              color: currentView === "dashboard" ? "var(--accent)" : "var(--mut)",
            }}
          >
            {currentView === "dashboard" && (
              <span
                className="absolute inset-0 rounded-full opacity-15"
                style={{ background: "var(--accent)" }}
              />
            )}
            <div className="relative flex items-center justify-center">
              <LayoutDashboard size={20} strokeWidth={currentView === "dashboard" ? 2.3 : 1.7} />
            </div>
            <span className="mt-0.5 text-[10px] font-bold tracking-tight">Today</span>
          </button>

          {/* Tasks */}
          <button
            type="button"
            onClick={() => handleTab("tasks")}
            className="relative flex flex-col items-center justify-center flex-1 py-1 rounded-full transition-all active:scale-90 cursor-pointer"
            style={{
              color: currentView === "tasks" ? "var(--accent)" : "var(--mut)",
            }}
          >
            {currentView === "tasks" && (
              <span
                className="absolute inset-0 rounded-full opacity-15"
                style={{ background: "var(--accent)" }}
              />
            )}
            <div className="relative flex items-center justify-center">
              <ListTodo size={20} strokeWidth={currentView === "tasks" ? 2.3 : 1.7} />
            </div>
            <span className="mt-0.5 text-[10px] font-bold tracking-tight">Tasks</span>
          </button>

          {/* Center Elevated FAB Button (+) */}
          <div className="flex flex-col items-center justify-center px-1">
            <button
              type="button"
              onClick={handleFab}
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full glass-prominent text-[var(--on-accent)] shadow-lg transition-transform active:scale-85 hover:scale-105 cursor-pointer"
              style={{
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "0 8px 24px -4px color-mix(in srgb, var(--accent) 55%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
              }}
              title="New Task"
              aria-label="Create new task"
            >
              <Plus size={22} strokeWidth={2.8} />
            </button>
          </div>

          {/* Focus */}
          <button
            type="button"
            onClick={() => handleTab("focus")}
            className="relative flex flex-col items-center justify-center flex-1 py-1 rounded-full transition-all active:scale-90 cursor-pointer"
            style={{
              color: currentView === "focus" ? "var(--accent)" : "var(--mut)",
            }}
          >
            {currentView === "focus" && (
              <span
                className="absolute inset-0 rounded-full opacity-15"
                style={{ background: "var(--accent)" }}
              />
            )}
            <div className="relative flex items-center justify-center">
              <Timer size={20} strokeWidth={currentView === "focus" ? 2.3 : 1.7} />
            </div>
            <span className="mt-0.5 text-[10px] font-bold tracking-tight">Focus</span>
          </button>

          {/* More */}
          <button
            type="button"
            onClick={handleMore}
            className="relative flex flex-col items-center justify-center flex-1 py-1 rounded-full transition-all active:scale-90 cursor-pointer"
            style={{
              color:
                moreOpen ||
                !["dashboard", "tasks", "focus"].includes(currentView)
                  ? "var(--accent)"
                  : "var(--mut)",
            }}
          >
            {(moreOpen || !["dashboard", "tasks", "focus"].includes(currentView)) && (
              <span
                className="absolute inset-0 rounded-full opacity-15"
                style={{ background: "var(--accent)" }}
              />
            )}
            <div className="relative flex items-center justify-center">
              <Grid
                size={20}
                strokeWidth={
                  moreOpen || !["dashboard", "tasks", "focus"].includes(currentView) ? 2.3 : 1.7
                }
              />
            </div>
            <span className="mt-0.5 text-[10px] font-bold tracking-tight">More</span>
          </button>
        </nav>
      </div>
    );
  }

  /* 2. CLASSIC NATIVE APP ENGINE (Default): Edge-to-edge grounded bottom bar */
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-2 pt-2 md:hidden select-none"
      style={{
        background: "color-mix(in srgb, var(--panel) 94%, transparent)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderTop: "1px solid var(--line)",
        boxShadow: "0 -4px 20px -2px rgba(0, 0, 0, 0.25)",
        paddingBottom: "max(12px, var(--safe-bottom, env(safe-area-inset-bottom, 12px)))",
      }}
      role="navigation"
      aria-label="Mobile Navigation Bar"
    >
      {/* 1. Today */}
      <button
        type="button"
        onClick={() => handleTab("dashboard")}
        className="flex flex-col items-center justify-center flex-1 py-1 transition-transform active:scale-90 cursor-pointer"
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
        className="flex flex-col items-center justify-center flex-1 py-1 transition-transform active:scale-90 cursor-pointer"
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
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-xl transition-transform active:scale-85 hover:scale-105 cursor-pointer"
          style={{
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "0 8px 20px -2px color-mix(in srgb, var(--accent) 55%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
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
        className="flex flex-col items-center justify-center flex-1 py-1 transition-transform active:scale-90 cursor-pointer"
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
        className="flex flex-col items-center justify-center flex-1 py-1 transition-transform active:scale-90 cursor-pointer"
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
