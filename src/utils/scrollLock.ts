import { useEffect } from "react";

let activeLockCount = 0;

/**
 * Acquire a body scroll lock.
 * Uses reference counting so nested drawers/modals never prematurely unlock
 * or permanently freeze the page.
 */
export function lockBodyScroll(): void {
  activeLockCount++;
  if (activeLockCount === 1) {
    document.body.style.overflow = "hidden";
  }
}

/**
 * Release a body scroll lock.
 * When the last lock is released, restores normal scrolling on body.
 */
export function unlockBodyScroll(): void {
  activeLockCount = Math.max(0, activeLockCount - 1);
  if (activeLockCount === 0) {
    document.body.style.overflow = "";
  }
}

/**
 * Force unlock all body scroll locks (safety net).
 */
export function forceUnlockBodyScroll(): void {
  activeLockCount = 0;
  document.body.style.overflow = "";
}

/**
 * React hook that acquires a body scroll lock while `locked` is true.
 * Safely releases the lock when `locked` becomes false or when the component unmounts.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [locked]);
}

// Disable browser automatic history scroll restoration so section switches always start at top
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  try {
    window.history.scrollRestoration = "manual";
  } catch {}
}

/**
 * Unconditionally scrolls the window, documentElement, body, #root, and <main> to top (0, 0).
 */
export function scrollToPageTop(behavior: ScrollBehavior = "auto"): void {
  if (typeof window === "undefined") return;
  try {
    window.scrollTo({ top: 0, left: 0, behavior });
  } catch {
    window.scrollTo(0, 0);
  }
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  const root = document.getElementById("root");
  if (root) root.scrollTop = 0;
  const main = document.querySelector("main");
  if (main) main.scrollTop = 0;
}
