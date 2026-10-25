"use client";

import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { IconButton } from "./IconButton";

import type { SheetProps } from "./Sheet";

// Loaded the first time a sheet opens (./Sheet.tsx): the overlay code is too big to send with
// every page that only might open one.
export default function SheetModal({
  isOpen,
  onOpenChange,
  title,
  closeLabel,
  children,
}: SheetProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-end justify-center bg-space-950/70 motion-safe:data-entering:animate-overlay-in motion-safe:data-exiting:animate-overlay-out lg:items-center lg:p-6"
    >
      <Modal
        className={[
          "max-h-[85dvh] w-full overflow-y-auto rounded-t-xl border border-panel-border bg-panel shadow-overlay",
          // Only with motion allowed: a reduced-motion rule loses to these more specific selectors.
          "max-lg:motion-safe:data-entering:animate-sheet-in max-lg:motion-safe:data-exiting:animate-sheet-out",
          "lg:max-w-lg lg:rounded-xl lg:motion-safe:data-entering:animate-dialog-in lg:motion-safe:data-exiting:animate-dialog-out",
        ].join(" ")}
      >
        <Dialog className="flex flex-col gap-4 p-6 pb-[max(--spacing(6),env(safe-area-inset-bottom))] outline-none">
          {({ close }) => (
            <>
              <div className="flex items-start justify-between gap-4">
                <Heading slot="title" className="pt-2 text-title-3">
                  {title}
                </Heading>
                <IconButton label={closeLabel} onPress={close} className="-me-2 -mt-1">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>
              </div>
              {children}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
