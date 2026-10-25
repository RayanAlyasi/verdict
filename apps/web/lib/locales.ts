export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function direction(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

// A page's canonical address and its hreflang alternates, from its path below the locale.
export function alternates(locale: Locale, path: string) {
  const suffix = path === "/" ? "" : path;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(LOCALES.map((other) => [other, `/${other}${suffix}`])),
      // The unlocalised address redirects by the browser's language (proxy.ts).
      "x-default": path,
    },
  };
}

// The language the browser ranks highest among ours, matched on its first part (ar-SA is Arabic);
// English when it names neither. Two locales don't need a negotiation library.
export function preferredLocale(acceptLanguage: string | null): Locale {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((entry) => {
      const [tag = "", ...parameters] = entry.split(";").map((part) => part.trim());
      const quality = parameters.find((parameter) => parameter.startsWith("q="));
      return {
        language: tag.split("-")[0]?.toLowerCase() ?? "",
        weight: quality ? Number(quality.slice(2)) : 1,
      };
    })
    .filter(({ language, weight }) => isLocale(language) && weight > 0)
    .sort((a, b) => b.weight - a.weight);
  return (ranked[0]?.language as Locale | undefined) ?? "en";
}
