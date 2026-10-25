"use client";

import { Button } from "@/components/ui/Button";
import { type ToastMessage, toastQueue } from "@/components/ui/Toast";

// Buttons that raise sample toasts; the page passes the text, already translated.
export function ToastDemo({ samples }: { samples: { label: string; toast: ToastMessage }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {samples.map(({ label, toast }) => (
        <Button
          key={label}
          variant="secondary"
          onPress={() =>
            toastQueue.add(toast, toast.tone === "error" ? undefined : { timeout: 6000 })
          }
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
