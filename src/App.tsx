import { useEffect, useState } from "react";
import { AppProvider } from "./store";
import { Shell } from "./components/Shell";
import { TimerPopout } from "./components/TimerPopout";

/**
 * LifeLog — a private, local-first life-logging system.
 * The AppProvider decrypts the at-rest state (or seeds first-run data),
 * then the Shell renders the active layout mode and view.
 */
export default function App() {
  const [isPopout, setIsPopout] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#timer-popout"
  );

  useEffect(() => {
    const handleHash = () => {
      setIsPopout(window.location.hash === "#timer-popout");
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  return (
    <AppProvider>
      {isPopout ? <TimerPopout /> : <Shell />}
    </AppProvider>
  );
}
