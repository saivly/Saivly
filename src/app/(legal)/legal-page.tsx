import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { getT } from "@/lib/i18n-server";
import { LEGAL, safeBackPath } from "@/lib/legal";

/** Shared shell for /terms and /privacy: header, back link, document body. */
export async function LegalPage({
  title,
  back,
  children,
}: {
  title: string;
  back: string | undefined;
  children: ReactNode;
}) {
  const t = await getT();
  const backHref = safeBackPath(back);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Logo size={20} markSize={24} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <BackLink href={backHref} label={t("Back")} />

        <h1 className="mt-6 text-[28px] leading-tight font-bold">{t(title)}</h1>
        <p className="mt-2 text-sm text-muted">
          {t("Last updated: {date}", { date: LEGAL.lastUpdated })}
        </p>
        <p className="mt-1 text-xs text-muted">
          {t("This document is currently available in English only.")}
        </p>

        <div className="mt-8 flex flex-col gap-8 rounded-xl border border-line bg-panel p-6 md:p-8">
          {children}
        </div>

        <div className="mt-8">
          <BackLink href={backHref} label={t("Back")} />
        </div>
      </main>
    </div>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-ink hover:text-accent"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </Link>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Mail() {
  return (
    <a href={`mailto:${LEGAL.email}`} className="font-medium text-ink underline underline-offset-2">
      {LEGAL.email}
    </a>
  );
}
