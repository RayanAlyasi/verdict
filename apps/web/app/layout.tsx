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
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-space-900 font-sans text-text antialiased">{children}</body>
    </html>
  );
}
