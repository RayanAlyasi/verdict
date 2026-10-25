"use client";

import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { IconButton } from "./IconButton";
import type { SheetProps } from "./Sheet";

// Fetched when a sheet is about to open (./Sheet.tsx): the overlay code is too big to send with
// every page that only might open one.
export default function SheetModal({
  isOpen,
  onOpenChange,
  title,
  closeLabel,
  children,
  actions,
}: SheetProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      // The visual viewport's height, not 100%: on iOS the on-screen keyboard covers the layout
      // viewport, and the sheet's actions must stay above it.
      className="fixed inset-x-0 top-0 z-50 flex h-(--visual-viewport-height) items-end justify-center bg-space-950/70 pt-6 motion-safe:data-entering:animate-overlay-in motion-safe:data-exiting:animate-overlay-out lg:items-center lg:p-6"
    >
      <Modal
        className={[
          "flex max-h-full w-full flex-col rounded-t-xl border border-panel-border bg-panel shadow-overlay",
          // Only with motion allowed: a reduced-motion rule loses to these more specific selectors.
          "max-lg:motion-safe:data-entering:animate-sheet-in max-lg:motion-safe:data-exiting:animate-sheet-out",
          "lg:max-w-lg lg:rounded-xl lg:motion-safe:data-entering:animate-dialog-in lg:motion-safe:data-exiting:animate-dialog-out",
        ].join(" ")}
      >
        <Dialog className="flex min-h-0 flex-1 flex-col outline-none">
          {({ close }) => (
            <>
              {/* The title and close button stay put while the content scrolls. */}
              <div className="flex shrink-0 items-start justify-between gap-4 ps-6 pe-4 pt-4">
                <Heading slot="title" className="pt-2 text-title-3">
                  {title}
                </Heading>
                <IconButton label={closeLabel} onPress={close}>
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
              <div
                className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-4 ${actions ? "pb-4" : "pb-[calc(--spacing(6)+env(safe-area-inset-bottom))]"}`}
              >
                {children}
              </div>
              {actions && (
                <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-divider px-6 pt-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]">
                  {actions}
                </div>
              )}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
