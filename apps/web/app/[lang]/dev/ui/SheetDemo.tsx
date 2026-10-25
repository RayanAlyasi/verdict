"use client";

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { preloadSheet, Sheet } from "@/components/ui/Sheet";

// A button that opens a sample sheet; the page passes the text, already translated.
export function SheetDemo({
  label,
  title,
  closeLabel,
  saveLabel,
  children,
}: {
  label: string;
  title: ReactNode;
  closeLabel: string;
  saveLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const preload = () => void preloadSheet().catch(() => {});
  return (
    <>
      <Button
        variant="secondary"
        onHoverStart={preload}
        onFocus={preload}
        onPressStart={preload}
        onPress={() => setOpen(true)}
      >
        {label}
      </Button>
      <Sheet
        isOpen={open}
        onOpenChange={setOpen}
        title={title}
        closeLabel={closeLabel}
        actions={<Button onPress={() => setOpen(false)}>{saveLabel}</Button>}
      >
        {children}
      </Sheet>
    </>
  );
}
