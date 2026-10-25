"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  Text,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastRegion as ToastRegion,
} from "react-aria-components";
import { IconButton } from "./IconButton";
import { toastQueue } from "./Toast";

const TONES = {
  info: "border-panel-border-strong",
  success: "border-glow-border",
  error: "border-coral-border",
};

// Loaded with the first toast (./Toast.tsx).
export default function ToastList({ closeLabel }: { closeLabel: string }): ReactNode {
  return (
    <ToastRegion
      queue={toastQueue}
      className="fixed inset-x-4 bottom-[max(--spacing(4),env(safe-area-inset-bottom))] z-50 flex flex-col gap-2 outline-none lg:inset-x-auto lg:end-6 lg:bottom-6 lg:w-96"
    >
      {({ toast }) => (
        <AriaToast
          toast={toast}
          style={
            {
              viewTransitionName: `toast-${toast.key}`,
              viewTransitionClass: "toast",
            } as CSSProperties
          }
          className={`flex items-start gap-2 rounded-row border bg-panel py-2 ps-4 pe-1 shadow-overlay outline-offset-2 data-focus-visible:outline-2 data-focus-visible:outline-focus ${TONES[toast.content.tone ?? "info"]}`}
        >
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
      )}
    </ToastRegion>
  );
}
