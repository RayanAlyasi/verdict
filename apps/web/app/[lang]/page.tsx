import { Trans } from "@lingui/react/macro";
import type { Metadata } from "next";
import { lang } from "next/root-params";
import { initLingui } from "@/lib/i18n";
import { alternates, isLocale } from "@/lib/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await lang();
  return isLocale(locale) ? { alternates: alternates(locale, "/") } : {};
}

// A placeholder until the app shell (spec 000).
export default async function Home() {
  await initLingui();
  return (
    <main className="grid min-h-dvh place-content-center justify-items-center gap-2 p-6 text-center">
      <h1 className="text-title-1">Verdict</h1>
      <p className="text-body text-text-muted">
        <Trans>An exam coach built from your own course materials.</Trans>
      </p>
    </main>
  );
}
