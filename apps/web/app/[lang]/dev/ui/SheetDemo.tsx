"use client";

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { preloadSheet, Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/Toast";

// A button that opens a sample sheet; the page passes the text, already translated.
export function SheetDemo({
  label,
  title,
  closeLabel,
  saveLabel,
  loadErrorLabel,
  children,
}: {
  label: string;
  title: ReactNode;
  closeLabel: string;
  saveLabel: string;
  loadErrorLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        onHoverStart={preloadSheet}
        onFocus={preloadSheet}
        onPressStart={preloadSheet}
        onPress={() => setOpen(true)}
      >
        {label}
      </Button>
      <Sheet
        isOpen={open}
        onOpenChange={setOpen}
        title={title}
        closeLabel={closeLabel}
        onLoadError={() => showToast({ title: loadErrorLabel, tone: "error" })}
        actions={<Button onPress={() => setOpen(false)}>{saveLabel}</Button>}
      >
        {children}
      </Sheet>
    </>
  );
}
