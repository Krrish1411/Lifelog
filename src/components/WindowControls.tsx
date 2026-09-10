import React, { useState, useEffect } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import {
  isTauri,
  minimizeDesktopWindow,
  toggleMaximizeDesktopWindow,
  closeDesktopWindow,
} from "../utils/native";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const WindowControls: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;

    let unlisten: (() => void) | undefined;
    try {
      const appWin = getCurrentWindow();
      appWin.isMaximized().then(setIsMaximized);
      appWin.onResized(() => {
        appWin.isMaximized().then(setIsMaximized);
      }).then((fn) => {
        unlisten = fn;
      });
    } catch {}

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!isTauri) return null;

  return (
    <div
      className={`inline-flex items-center gap-0.5 border-l pl-2 select-none ${className}`}
      style={{ borderColor: "var(--line)" }}
    >
      {/* Minimize */}
      <button
        type="button"
        onClick={minimizeDesktopWindow}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--panel2)] active:scale-95 cursor-pointer text-[var(--mut)] hover:text-[var(--text)]"
        title="Minimize LifeLog"
        aria-label="Minimize"
      >
        <Minus size={13} strokeWidth={2.2} />
      </button>

      {/* Maximize / Restore */}
      <button
        type="button"
        onClick={toggleMaximizeDesktopWindow}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--panel2)] active:scale-95 cursor-pointer text-[var(--mut)] hover:text-[var(--text)]"
        title={isMaximized ? "Restore Window" : "Maximize Window"}
        aria-label="Maximize"
      >
        {isMaximized ? (
          <Copy size={12} strokeWidth={2.2} />
        ) : (
          <Square size={11} strokeWidth={2.2} />
        )}
      </button>

      {/* Close (Hide to Tray) */}
      <button
        type="button"
        onClick={closeDesktopWindow}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-rose-500/20 active:scale-95 cursor-pointer text-[var(--mut)] hover:text-rose-400"
        title="Hide to Tray (Close)"
        aria-label="Close"
      >
        <X size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
};
