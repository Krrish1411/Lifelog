import React, { useEffect, useState } from "react";

type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function announce(message: string): void {
  listeners.forEach((fn) => fn(message));
}

export const LiveAnnouncer: React.FC = () => {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const handler: Listener = (msg) => {
      // Clear briefly so identical consecutive messages re-trigger screen readers
      setAnnouncement("");
      setTimeout(() => {
        setAnnouncement(msg);
      }, 50);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {announcement}
    </div>
  );
};
