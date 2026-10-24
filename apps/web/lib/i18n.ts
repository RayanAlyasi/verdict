import { type I18n, setupI18n } from "@lingui/core";
import { setI18n } from "@lingui/react/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { messages as ar } from "@/locales/ar.po";
import { messages as en } from "@/locales/en.po";
import { isLocale, type Locale } from "./locales";

// One instance per locale: the server renders requests in different languages at the same time.
const I18N: Record<Locale, I18n> = {
  en: setupI18n({ locale: "en", messages: { en } }),
  ar: setupI18n({ locale: "ar", messages: { ar } }),
};

// Every layout and page calls this first, because Next.js can render a page before its layout.
export async function initLingui(): Promise<{ i18n: I18n; locale: Locale }> {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  setI18n(I18N[locale]);
  return { i18n: I18N[locale], locale };
}
