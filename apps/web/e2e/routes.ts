import { LOCALES, type Locale } from "../lib/locales";

// Every page the e2e suite visits, by its path below the locale. Add each new route here: it then
// gets the JavaScript budget, the accessibility and layout checks and review screenshots, in every
// language.
export const ROUTES = [{ name: "home", path: "/" }] as const;

export { LOCALES };

export function localized(locale: Locale, path: string): string {
  return `/${locale}${path === "/" ? "" : path}`;
}
