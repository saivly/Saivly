import type { Metadata } from "next";
import "./globals.css";
import { getLocale, getTheme } from "@/lib/i18n-server";
import { I18nProvider } from "./i18n-provider";

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
    // suppressHydrationWarning: browser extensions (password/passkey
    // managers) add attributes to <html> before React loads. Only affects
    // this element's own attributes, not its children.
    <html lang={locale} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
