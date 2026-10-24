import type { Metadata } from "next";
import { lang } from "next/root-params";
import { alternates, isLocale } from "@/lib/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await lang();
  return isLocale(locale) ? { alternates: alternates(locale, "/") } : {};
}

// A placeholder until the app shell (spec 000).
export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <h1 className="text-title-1">Verdict</h1>
    </main>
  );
}
