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

// The sheet's code is React Aria's whole dialog module, too big to send with every page that only
// might open one. A failed fetch is forgotten, so the next attempt fetches again; deploys keep the
// previous build's files for pages still open (#14), so a retry finds them.
function loadSheet(): Promise<SheetModal> {
  loading ??= import("./SheetModal").then(
    (module) => (loaded = module.default),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

// Call from the opener's onHoverStart, onFocus and onPressStart, so the first opening doesn't wait
// for the network. A failure here is left for the opening itself to report.
export function preloadSheet() {
  loadSheet().catch(() => {});
}

// A sheet that rises from the bottom on phones and a centred dialog from 1024px. It traps focus,
// closes with Escape, a tap outside or its close button, and returns focus to what opened it. If
// its code can't be fetched, it stays closed, onLoadError says so, and the next press tries again.
export function Sheet({ onLoadError, ...props }: SheetProps & { onLoadError?: () => void }) {
  const [Modal, setModal] = useState<SheetModal | null>(() => loaded);
  const { isOpen, onOpenChange } = props;
  useEffect(() => {
    if (!isOpen || Modal) return;
    let current = true;
    loadSheet().then(
      (component) => current && setModal(() => component),
      () => {
        if (!current) return;
        onOpenChange(false);
        onLoadError?.();
      },
    );
    return () => {
      current = false;
    };
  }, [isOpen, Modal, onOpenChange, onLoadError]);
  return Modal ? <Modal {...props} /> : null;
}
