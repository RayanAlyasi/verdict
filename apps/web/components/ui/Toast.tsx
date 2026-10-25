"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { UNSTABLE_ToastQueue as ToastQueue } from "react-aria-components";

export type ToastMessage = {
  title: string;
  description?: string;
  tone?: "info" | "success" | "error";
};

// The app's one queue: toastQueue.add({ title }, { timeout: 6000 }). Give errors no timeout, so a
// student who needs longer to read them isn't hurried; timers pause on hover and focus.
export const toastQueue = new ToastQueue<ToastMessage>({
  maxVisibleToasts: 3,
  // Each change slides in or out as a view transition where the browser has them.
  wrapUpdate(update) {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if ("startViewTransition" in document && !still) {
      // A toast arriving mid-transition skips the earlier one, which is fine.
      document.startViewTransition(() => flushSync(update)).ready.catch(() => {});
    } else {
      update();
    }
  },
});

const ToastList = lazy(() => import("./ToastList"));

// Where toasts appear, once per page. It's a landmark: F6 reaches it from anywhere. Its code loads
// with the first toast, so pages that never show one don't carry it.
export function Toasts({ closeLabel }: { closeLabel: string }) {
  const hasToasts = useSyncExternalStore(
    (onChange) => toastQueue.subscribe(onChange),
    () => toastQueue.visibleToasts.length > 0,
    () => false,
  );
  if (!hasToasts) return null;
  return (
    <Suspense fallback={null}>
      <ToastList closeLabel={closeLabel} />
    </Suspense>
  );
}
