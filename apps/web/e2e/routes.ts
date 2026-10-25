import { LOCALES, type Locale } from "../lib/locales";

// Every page the e2e suite visits, by its path below the locale and the status it answers with.
// Add each new route here: it then gets the JavaScript budget, the accessibility and layout checks
// and review screenshots, in every language.
export const ROUTES = [
  { name: "home", path: "/", status: 200 },
  { name: "not-found", path: "/no-such-page", status: 404 },
] as const;

export { LOCALES };

export function localized(locale: Locale, path: string): string {
  return `/${locale}${path === "/" ? "" : path}`;
}
