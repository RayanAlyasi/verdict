import { expect, test } from "vitest";
import { alternates, preferredLocale } from "../lib/locales";

test.each([
  [null, "en"],
  ["", "en"],
  ["ar", "ar"],
  ["ar-SA,ar;q=0.9,en;q=0.8", "ar"],
  ["en-GB,en;q=0.9,ar;q=0.8", "en"],
  ["fr-FR,fr;q=0.9,ar;q=0.8,en;q=0.7", "ar"],
  ["en;q=0.5, ar;q=0.6", "ar"],
  ["ar;q=0, en", "en"],
  ["fr, de", "en"],
  ["*", "en"],
  ["ar;q=nonsense, en;q=0.1", "en"],
])("Accept-Language %j prefers %s", (header, locale) => {
  expect(preferredLocale(header)).toBe(locale);
});

test("a page links every language and the unlocalised address", () => {
  expect(alternates("ar", "/practice")).toEqual({
    canonical: "/ar/practice",
    languages: { en: "/en/practice", ar: "/ar/practice", "x-default": "/practice" },
  });
  expect(alternates("en", "/").canonical).toBe("/en");
});
