import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ICON_NAMES } from "@/components/dashboard/icons";
import { getLocale, getTheme } from "@/lib/i18n-server";
import { I18nProvider } from "./i18n-provider";

export const metadata: Metadata = {
  title: "Saivly",
  description:
    "Next.js + TypeScript + Tailwind + Supabase Auth + RLS starter",
};

// One type system for the whole app; globals.css maps these to
// font-sans / font-mono.
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://banking.saivly.com";

// Tells search engines which image is the Saivly logo (Google shows it in
// results). Files in public/brand are the public, stable brand URLs.
const ORGANIZATION_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Saivly",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/saivly-mark.png`,
}).replace(/</g, "\\u003c");

// Material Symbols, limited to the glyphs the app uses (see icons.ts).
const ICON_FONT_URL = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0..1,0&icon_names=${ICON_NAMES.join(",")}&display=block`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read server-side so the right language and theme are there on first paint.
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    // suppressHydrationWarning: browser extensions (password/passkey
    // managers) add attributes to <html> before React loads. Only affects
    // this element's own attributes, not its children.
    <html
      lang={locale}
      className={`${dmSans.variable} ${jetBrainsMono.variable}${theme === "dark" ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="stylesheet" href={ICON_FONT_URL} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ORGANIZATION_JSON_LD }}
        />
      </head>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
