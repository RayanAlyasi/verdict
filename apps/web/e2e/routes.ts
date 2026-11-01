import { LOCALES, type Locale } from "../lib/locales";

// Every page the e2e suite visits, by its path below the locale and the status it answers with.
// Add each new route here: it then gets the JavaScript budget, the accessibility and layout checks
// and review screenshots, in every language.
export const ROUTES = [
  { name: "home", path: "/", status: 200 },
  { name: "course", path: "/course", status: 200 },
  { name: "practice", path: "/practice", status: 200 },
  { name: "progress", path: "/progress", status: 200 },
  { name: "ask", path: "/ask", status: 200 },
  { name: "add-course", path: "/add-course", status: 200 },
  { name: "profile", path: "/profile", status: 200 },
  { name: "not-found", path: "/no-such-page", status: 404 },
  { name: "dev-ui", path: "/dev/ui", status: 200 },
  { name: "dev-ui-overlays", path: "/dev/ui/overlays", status: 200 },
] as const;

export { LOCALES };

export function localized(locale: Locale, path: string): string {
  return `/${locale}${path === "/" ? "" : path}`;
}
