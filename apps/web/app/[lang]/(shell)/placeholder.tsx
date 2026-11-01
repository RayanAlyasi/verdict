import type { MessageDescriptor } from "@lingui/core";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { initLingui } from "@/lib/i18n";
import { alternates } from "@/lib/locales";

// A page's own title is what screen readers hear when it opens: the router announces only a title
// that changes.
export async function pageMetadata(path: string, title: MessageDescriptor): Promise<Metadata> {
  const { i18n, locale } = await initLingui();
  return { title: i18n._(title), alternates: alternates(locale, path) };
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
    <div className="mx-auto flex max-w-299 flex-col gap-4 px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
      <h1 className="text-title-1">{title}</h1>
      <EmptyState icon={icon} title={emptyTitle} description={description} action={action} />
    </div>
  );
}
