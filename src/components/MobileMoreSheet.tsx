import React, { useEffect } from "react";
import {
  Calendar,
  Flame,
  FileText,
  FileClock,
  BarChart3,
  PenLine,
  Settings,
  X,
  Sparkles,
} from "lucide-react";
import type { ViewId } from "../types";
import { triggerHaptic } from "../utils/native";
import { scrollToPageTop, useBodyScrollLock } from "../utils/scrollLock";

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  currentView: ViewId;
  onSelectView: (v: ViewId) => void;
}

const HUB_ITEMS: { id: ViewId; label: string; icon: any; color: string; desc: string }[] = [
  { id: "calendar", label: "Calendar", icon: Calendar, color: "#3b82f6", desc: "Multi-block planner" },
  { id: "habits", label: "Habits", icon: Flame, color: "#f97316", desc: "Streaks & routines" },
  { id: "notes", label: "Notes", icon: FileText, color: "#eab308", desc: "AES encrypted vault" },
  { id: "daylog", label: "Day Log", icon: FileClock, color: "#10b981", desc: "Daily timeline reflection" },
  { id: "reports", label: "Reports", icon: BarChart3, color: "#8b5cf6", desc: "Analytics & trends" },
  { id: "review", label: "Review", icon: PenLine, color: "#ec4899", desc: "Weekly debriefing" },
  { id: "settings", label: "Settings", icon: Settings, color: "#64748b", desc: "Themes & backup" },
];

export const MobileMoreSheet: React.FC<MobileMoreSheetProps> = ({
  open,
  onClose,
  currentView,
  onSelectView,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useBodyScrollLock(open);

  if (!open) return null;

  const handleSelect = (v: ViewId) => {
    triggerHaptic("light");
    scrollToPageTop("auto");
    onSelectView(v);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:hidden animate-fade-in"
      style={{
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl border-t p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto animate-slide-up"
        style={{
          background: "var(--panel)",
          borderColor: "var(--line)",
          paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pull handle */}
        <div className="mx-auto -mt-2 mb-3 h-1.5 w-12 rounded-full bg-[var(--line)] opacity-80" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <span className="font-display text-[17px] font-bold tracking-tight">LifeLog Hub</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:bg-[var(--panel2)] active:scale-95 cursor-pointer"
            style={{ color: "var(--mut)" }}
            aria-label="Close sheet"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hub Items Grid */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          {HUB_ITEMS.map((item) => {
            const Icon = item.icon;
            const isSelected = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className="flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-95 text-left cursor-pointer"
                style={{
                  background: isSelected ? "var(--accent-soft)" : "var(--panel2)",
                  borderColor: isSelected ? "var(--accent)" : "var(--line)",
                }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${item.color} 15%, transparent)`,
                    color: item.color,
                  }}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[13px] font-bold truncate"
                    style={{ color: isSelected ? "var(--accent)" : "var(--text)" }}
                  >
                    {item.label}
                  </div>
                  <div className="text-[10.5px] truncate font-medium" style={{ color: "var(--mut)" }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
