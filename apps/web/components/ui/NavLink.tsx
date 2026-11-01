"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The four main pages in order: going to a later one moves forward, to an earlier one back.
const SECTIONS = ["", "/course", "/practice", "/progress"];

// Only shows on a slow connection: the delay keeps it from flickering on a fast one.
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-x-3 bottom-0.5 h-0.5 rounded-pill bg-glow transition-opacity duration-base ${
        pending ? "opacity-100 delay-100" : "opacity-0"
      }`}
    />
  );
}

// A link in the shell. It's a client component only to know which page is open, so the shell
// around it stays server-rendered. Style the open page with aria-[current=page]:.
export function NavLink({
  locale,
  path,
  className = "",
  children,
}: {
  locale: string;
  // Below the language: "" for Today, "/course" for Course.
  path: string;
  className?: string;
  children: ReactNode;
}) {
  const current = usePathname().slice(`/${locale}`.length);
  const direction = SECTIONS.indexOf(path) < SECTIONS.indexOf(current) ? "nav-back" : "nav-forward";
  return (
    <Link
      href={`/${locale}${path}`}
      aria-current={current === path ? "page" : undefined}
      transitionTypes={[direction]}
      className={[
        "group relative outline-offset-2 transition-transform duration-press ease-standard focus-visible:outline-2 focus-visible:outline-focus active:scale-97 motion-reduce:transition-none",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-text/8 before:opacity-0 before:transition-opacity before:duration-fast hover:before:opacity-100 motion-reduce:before:transition-none",
        className,
      ].join(" ")}
    >
      {children}
      <Pending />
    </Link>
  );
}
