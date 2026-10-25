"use client";

import { Button } from "@/components/ui/Button";
import { showToast, type ToastMessage } from "@/components/ui/Toast";

// Buttons that raise sample toasts; the page passes the text, already translated.
export function ToastDemo({ samples }: { samples: { label: string; toast: ToastMessage }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {samples.map(({ label, toast }) => (
        <Button key={label} variant="secondary" onPress={() => showToast(toast)}>
          {label}
        </Button>
      ))}
    </div>
  );
}
