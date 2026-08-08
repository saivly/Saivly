import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saivly",
  description:
    "Next.js + TypeScript + Tailwind + Supabase Auth + RLS starter",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
