"use client";

import type { ReactNode } from "react";
import {
  Text,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components";
import { IconButton } from "./IconButton";

export type ToastMessage = {
  title: string;
  description?: string;
  tone?: "info" | "success" | "error";
};

// One queue for the app, outlasting client-side navigation, so <Toasts> belongs once in the root
// layout: a page without it would leave a toast waiting, and two would show each toast twice.
export const toastQueue = new ToastQueue<ToastMessage>({ maxVisibleToasts: 3 });

// Errors stay until dismissed, so a student who needs longer to read one isn't hurried; anything
// else leaves after 6 seconds. Timers pause while the pointer or focus rests on a toast.
export function showToast(message: ToastMessage) {
  return toastQueue.add(message, message.tone === "error" ? undefined : { timeout: 6000 });
}

const TONES = {
  info: { border: "border-panel-border-strong", icon: <InfoIcon /> },
  success: { border: "border-glow-border", icon: <CheckIcon /> },
  error: { border: "border-coral-border", icon: <AlertIcon /> },
};

// Where toasts appear: a landmark F6 reaches from anywhere. It loads with the page rather than
// with the first toast, because an error toast must still show when the network is down. On
// phones it sits above the tallest of what's pinned to the bottom of the screen: the shell's
// --toast-offset, an open sheet's actions (--sheet-offset) or the safe area.
export function Toasts({ closeLabel }: { closeLabel: string }): ReactNode {
  return (
    <ToastRegion
      queue={toastQueue}
      className="fixed inset-x-4 bottom-[calc(max(var(--toast-offset,0px),var(--sheet-offset,0px),env(safe-area-inset-bottom))+--spacing(4))] z-50 flex flex-col gap-2 rounded-row outline-offset-4 data-focus-visible:outline-2 data-focus-visible:outline-focus lg:inset-x-auto lg:end-6 lg:bottom-6 lg:w-96"
    >
      {({ toast }) => {
        const tone = TONES[toast.content.tone ?? "info"];
        return (
          <AriaToast
            toast={toast}
            className={[
              "flex items-start gap-3 rounded-row border bg-panel py-2 ps-4 pe-1 shadow-overlay outline-offset-2 data-focus-visible:outline-2 data-focus-visible:outline-focus",
              // Slides in with transform and opacity as it's added; leaving is instant.
              "transition-[opacity,translate] duration-slow ease-standard starting:translate-y-4 starting:opacity-0 motion-reduce:transition-none",
              tone.border,
            ].join(" ")}
          >
            <span className="pt-3">{tone.icon}</span>
            <ToastContent className="flex min-w-0 flex-1 flex-col gap-1 py-2">
              <Text slot="title" className="text-small font-semibold text-text">
                {toast.content.title}
              </Text>
              {toast.content.description && (
                <Text slot="description" className="text-note text-text-muted">
                  {toast.content.description}
                </Text>
              )}
            </ToastContent>
            <IconButton slot="close" label={closeLabel}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          </AriaToast>
        );
      }}
    </ToastRegion>
  );
}

// The tone's icon backs up its words; the title says what happened either way.
function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 text-glow" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 12.5l2.5 2.5L16 9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 text-coral" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7.5v5.5M12 16.5v.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 text-text-muted" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5.5M12 7.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
