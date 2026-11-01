"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-aria-components";
import { type ButtonLook, buttonClasses, Spinner } from "./Button";

function Label({ pendingLabel, children }: { pendingLabel: string; children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {/* Hidden by opacity, not removed, so the link keeps its size while the page loads. */}
      <span className={`relative inline-flex items-center gap-2 ${pending ? "opacity-0" : ""}`}>
        {children}
      </span>
      {pending && <Spinner label={pendingLabel} />}
    </>
  );
}

// A link that looks like a button, for an action that opens another page. React Aria gives it a
// button's states; Next.js's link gives it prefetching, the page transition and the pending state.
export function ButtonLink({
  href,
  pendingLabel,
  children,
  ...look
}: ButtonLook & { href: string; pendingLabel: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={buttonClasses(look)}
      render={(props) => (
        <NextLink
          {...(props as ComponentProps<"a">)}
          href={href}
          transitionTypes={["nav-forward"]}
        />
      )}
    >
      <Label pendingLabel={pendingLabel}>{children}</Label>
    </Link>
  );
}
