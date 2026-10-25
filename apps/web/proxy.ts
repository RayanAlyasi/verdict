import { type NextRequest, NextResponse } from "next/server";
import { isLocale, preferredLocale } from "@/lib/locales";

// Sends a path without a language (/ or /practice) to the browser's preferred one (/ar/practice).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isLocale(pathname.split("/")[1] ?? "")) return;
  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request.headers.get("accept-language"))}${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.redirect(url);
  // Caches must keep one redirect per language.
  response.headers.set("Vary", "Accept-Language");
  return response;
}

export const config = {
  // Not the api routes, Next.js's own files or files with an extension (favicon.ico).
  matcher: ["/((?!api/|_next/|.*\\.).*)"],
};
