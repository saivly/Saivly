"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/app/i18n-provider";
import { Icon, buttonStyles } from "@/components/dashboard/ui";

const NAV_ITEMS: { segment: string; label: string; icon: string }[] = [
  { segment: "dashboard", label: "Overview", icon: "space_dashboard" },
  { segment: "accounts", label: "Accounts", icon: "account_balance_wallet" },
  { segment: "payments", label: "Payments & payouts", icon: "swap_horiz" },
  { segment: "invoices", label: "Invoices", icon: "request_quote" },
  { segment: "reports", label: "Reports", icon: "bar_chart" },
  { segment: "settings", label: "Settings", icon: "settings" },
];

function LogoutDialog({ orgName, onCancel }: { orgName: string; onCancel: () => void }) {
  const { t } = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,27,45,.45)] p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        className="w-full max-w-[380px] rounded-[14px] bg-db-card p-7 text-db-ink shadow-[0_20px_50px_-10px_rgba(15,27,45,.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mb-4 inline-flex rounded-lg bg-db-tint p-2 text-db-primary">
          <Icon name="logout" size={22} />
        </span>
        <h2 id="logout-title" className="text-lg font-bold">
          {t("Log out of {org}?", { org: orgName })}
        </h2>
        <p className="mt-1.5 text-sm text-db-muted">
          {t("You'll need to sign in again to access your accounts.")}
        </p>
        <form action="/auth/signout" method="post" className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={`${buttonStyles.secondary} text-sm`} autoFocus>
            {t("Cancel")}
          </button>
          <button type="submit" className={buttonStyles.primary}>
            {t("Log out")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Sidebar({
  orgId,
  orgName,
  userName,
  userEmail,
  initials,
  roleLabel,
}: {
  orgId: string;
  orgName: string;
  userName?: string | null;
  userEmail: string;
  initials: string;
  roleLabel: string;
}) {
  const { t } = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const orgBase = `/org/${orgId}`;

  const brand = (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-db-bright text-white">
        <Icon name="account_balance" size={20} />
      </span>
      <span className="min-w-0 truncate text-base font-bold tracking-[.02em] text-white" title={orgName}>
        {orgName}
      </span>
    </div>
  );

  return (
    <>
      {/* Below md the sidebar becomes a drawer behind this bar. */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-db-side px-4 py-3 md:hidden">
        {brand}
        <button
          onClick={() => setOpen(true)}
          aria-label={t("Open menu")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-db-side-text hover:bg-db-side-active hover:text-white"
        >
          <Icon name="menu" size={22} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-[rgba(15,27,45,.45)] md:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col bg-db-side transition-transform duration-200 md:sticky md:top-0 md:h-dvh md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-db-side-line px-5 py-[22px]">
          {brand}
          <button
            onClick={() => setOpen(false)}
            aria-label={t("Close menu")}
            className="rounded-lg p-1 text-db-side-text hover:text-white md:hidden"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
          <span className="px-3 pb-2 text-[11px] font-semibold tracking-[.08em] text-db-side-label uppercase">
            {t("Menu")}
          </span>
          {NAV_ITEMS.map((item) => {
            const href = `${orgBase}/${item.segment}`;
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={item.segment}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? "bg-db-side-active text-white" : "text-db-side-text hover:text-white"
                }`}
              >
                <Icon
                  name={item.icon}
                  size={20}
                  className={active ? "text-db-light" : "text-db-side-muted group-hover:text-white"}
                />
                {t(item.label)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 border-t border-db-side-line px-5 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-db-side-avatar text-[13px] font-semibold text-white">
            {initials}
          </span>
          <span className="min-w-0 flex-1" title={userEmail}>
            <span className="block truncate text-[13px] font-semibold text-white">{userName || userEmail}</span>
            <span className="block truncate text-xs text-db-side-muted">{roleLabel}</span>
          </span>
          <button
            onClick={() => setConfirmLogout(true)}
            aria-label={t("Log out")}
            title={t("Log out")}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-db-side-text hover:bg-db-side-active hover:text-white"
          >
            <Icon name="logout" size={20} />
          </button>
        </div>
      </aside>

      {confirmLogout && <LogoutDialog orgName={orgName} onCancel={() => setConfirmLogout(false)} />}
    </>
  );
}
