import type { Metadata } from "next";
import { lang } from "next/root-params";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { alternates, isLocale } from "@/lib/locales";

export async function placeholderMetadata(path: string): Promise<Metadata> {
  const locale = await lang();
  return isLocale(locale) ? { alternates: alternates(locale, path) } : {};
}

// A page whose feature a later spec adds: it says what will be here, so the navigation works now.
export function Placeholder({
  title,
  emptyTitle,
  description,
  icon,
  action,
}: {
  title: ReactNode;
  emptyTitle: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-275 flex-col gap-4 px-4 py-6 lg:px-12 lg:py-10">
      <h1 className="text-title-1">{title}</h1>
      <EmptyState icon={icon} title={emptyTitle} description={description} action={action} />
    </div>
  );
}
