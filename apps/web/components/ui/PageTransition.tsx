"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, ViewTransition } from "react";

// Which way the page moves comes from the link that was followed (NavLink). The browser's back and
// forward buttons, and anything else, swap the page instantly. globals.css draws the movement.
const BY_DIRECTION = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition key={usePathname()} enter={BY_DIRECTION} exit={BY_DIRECTION} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
