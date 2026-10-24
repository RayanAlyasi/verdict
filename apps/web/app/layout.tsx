import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdict",
  description: "An exam coach built from your own course materials.",
};

export const viewport: Viewport = {
  themeColor: "#0A1222",
  colorScheme: "dark",
  // Safe-area insets are 0 unless the page covers the whole screen.
  viewportFit: "cover",
  // dvh layouts stay above the on-screen keyboard on Android, as on iOS.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-space-900 font-sans text-body text-text antialiased">{children}</body>
    </html>
  );
}
