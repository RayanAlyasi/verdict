"use client";

import type { ReactNode } from "react";

// Moves focus past the navigation by hand: following #content would add a history entry that the
// router ignores, so the next press of Back would change the address and not the page.
export function SkipLink({ children }: { children: ReactNode }) {
  return (
    <a
      href="#content"
      onClick={(event) => {
        event.preventDefault();
        document.getElementById("content")?.focus();
      }}
      className="fixed start-2 top-2 z-20 rounded-md bg-panel px-4 py-3 text-label text-text opacity-0 outline-offset-2 not-focus:pointer-events-none focus:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
    >
      {children}
    </a>
  );
}
