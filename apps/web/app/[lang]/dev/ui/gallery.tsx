import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

// The component gallery replaces a separate Storybook (spec 000). It shows only in development,
// tests and staging: an unset APP_ENV hides it, as production does.
export async function showGalleryOrNotFound() {
  await connection();
  if (!["development", "test", "staging"].includes(process.env.APP_ENV ?? "")) notFound();
}

export function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title-3">{title}</h2>
      {children}
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
