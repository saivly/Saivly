import type { Metadata } from "next";
import "./globals.css";
import { getLocale, getTheme } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: "Saivly",
  description:
    "Next.js + TypeScript + Tailwind + Supabase Auth + RLS starter",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read server-side so the right language and theme are there on first paint.
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    <html lang={locale} className={theme === "dark" ? "dark" : undefined}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
