"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Link, RouterProvider } from "react-aria-components";
import { type ButtonLook, buttonClasses } from "./Button";

// A link that looks like a button, for an action that opens another page.
export function ButtonLink({
  href,
  children,
  ...look
}: ButtonLook & { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <RouterProvider navigate={(path) => router.push(path)}>
      <Link href={href} className={buttonClasses(look)}>
        <span className="relative inline-flex items-center gap-2">{children}</span>
      </Link>
    </RouterProvider>
  );
}
