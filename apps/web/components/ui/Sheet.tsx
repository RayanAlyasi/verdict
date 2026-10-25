"use client";

import { type ComponentType, type ReactNode, useEffect, useState } from "react";

export type SheetProps = {
  // Open it from any button: <Button onPress={() => setOpen(true)} />.
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: ReactNode;
  // The close button's name, for example "Close".
  closeLabel: string;
  children: ReactNode;
  // Buttons kept in thumb reach at the bottom while the content above scrolls.
  actions?: ReactNode;
};

type SheetModal = ComponentType<SheetProps>;
let loaded: SheetModal | null = null;
let loading: Promise<SheetModal> | null = null;

// Fetches the sheet's code, React Aria's whole dialog module, which is too big to send with every
// page that only might open one. Call it from the opener's onHoverStart, onFocus and onPressStart,
// so the first opening doesn't wait for the network. A failed fetch (offline, or a build since
// replaced) is tried again on the next call.
export function preloadSheet(): Promise<SheetModal> {
  loading ??= import("./SheetModal").then(
    (module) => (loaded = module.default),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

// A sheet that rises from the bottom on phones and a centred dialog from 1024px. It traps focus,
// closes with Escape, a tap outside or its close button, and returns focus to what opened it. If
// its code can't be fetched, it stays closed, and the next press tries again.
export function Sheet(props: SheetProps) {
  const [Modal, setModal] = useState<SheetModal | null>(() => loaded);
  const { isOpen, onOpenChange } = props;
  useEffect(() => {
    if (!isOpen || Modal) return;
    let current = true;
    preloadSheet().then(
      (component) => current && setModal(() => component),
      () => current && onOpenChange(false),
    );
    return () => {
      current = false;
    };
  }, [isOpen, Modal, onOpenChange]);
  return Modal ? <Modal {...props} /> : null;
}
