"use client";

import { lazy, type ReactNode, Suspense, useState } from "react";

const SheetModal = lazy(() => import("./SheetModal"));

export type SheetProps = {
  // Open it from any button: <Button onPress={() => setOpen(true)} />.
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: ReactNode;
  // The close button's name, for example "Close".
  closeLabel: string;
  children: ReactNode;
};

// A sheet that rises from the bottom on phones and a centred dialog from 1024px. It traps focus,
// closes with Escape, a tap outside or its close button, and returns focus to what opened it.
// Its code (React Aria's whole dialog module) loads the first time it opens, then stays for the
// closing animation and later openings.
export function Sheet(props: SheetProps) {
  const [opened, setOpened] = useState(props.isOpen);
  if (props.isOpen && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <SheetModal {...props} />
    </Suspense>
  );
}
