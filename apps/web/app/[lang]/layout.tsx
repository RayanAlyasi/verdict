import { msg } from "@lingui/core/macro";
import type { Metadata, Viewport } from "next";
import { Readex_Pro } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/components/ui/LocaleProvider";
import { SpaceBackground } from "@/components/ui/SpaceBackground";
import { initLingui } from "@/lib/i18n";
import { direction } from "@/lib/locales";
import "../globals.css";

// Variable, so one file per script covers every weight the type scale uses.
const readexPro = Readex_Pro({ subsets: ["latin", "arabic"], variable: "--font-readex-pro" });

export async function generateMetadata(): Promise<Metadata> {
  const { i18n } = await initLingui();
  // At request time: staging and production run the same build, so the address can't be built in.
  await connection();
  return {
    metadataBase: new URL(process.env.WEB_URL ?? ""),
    title: "Verdict",
    description: i18n._(msg`An exam coach built from your own course materials.`),
  };
}

export const viewport: Viewport = {
  themeColor: "#0A1222",
  colorScheme: "dark",
  // Safe-area insets are 0 unless the page covers the whole screen.
  viewportFit: "cover",
  // dvh layouts stay above the on-screen keyboard on Android, as on iOS.
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await initLingui();
  return (
    <html lang={locale} dir={direction(locale)} className={readexPro.variable}>
      <body className="isolate bg-space-900 font-sans text-body text-text antialiased">
        <SpaceBackground />
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
