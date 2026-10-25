"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "react-aria-components";

// React Aria reads the language from here: arrow keys follow the page's direction and labels its
// own (such as a progress bar's value) are in the page's language, not the browser's.
export function LocaleProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
