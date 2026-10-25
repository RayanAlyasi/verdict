"use client";

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

// A button that opens a sample sheet; the page passes the text, already translated.
export function SheetDemo({
  label,
  title,
  closeLabel,
  children,
}: {
  label: string;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onPress={() => setOpen(true)}>
        {label}
      </Button>
      <Sheet isOpen={open} onOpenChange={setOpen} title={title} closeLabel={closeLabel}>
        {children}
      </Sheet>
    </>
  );
}
