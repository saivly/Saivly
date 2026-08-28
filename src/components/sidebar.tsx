"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

const NAV_ITEMS: { segment: string; label: string; icon: ReactNode }[] = [
  {
    segment: "dashboard",
    label: "Dashboard",
    icon: (
      <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 011-1h0a1 1 0 011 1v4a1 1 0 001 1h4a1 1 0 001-1V10" />
    ),
  },
  {
    segment: "payments",
    label: "Payments",
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
  },
  {
    segment: "invoices",
    label: "Invoices",
    icon: (
      <>
        <path d="M6 3h12a1 1 0 011 1v16l-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1V4a1 1 0 011-1z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
  },
  {
    segment: "accounts",
    label: "Accounts",
    icon: (
      <>
        <path d="M3 10l9-6 9 6" />
        <path d="M5 10v9M9 10v9M15 10v9M19 10v9" />
        <path d="M3 21h18" />
      </>
    ),
  },
  {
    segment: "analytics",
    label: "Analytics",
    icon: (
      <>
        <path d="M4 20V10M12 20V4M20 20v-7" />
      </>
    ),
  },
  {
    segment: "users",
    label: "Users",
    icon: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M16 5.5a3 3 0 010 5.9" />
        <path d="M21 20c0-2.8-1.9-5.1-4.5-5.8" />
      </>
    ),
  },
  {
    segment: "reports",
    label: "Reports",
    icon: (
      <>
        <path d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
        <path d="M14 3v4a1 1 0 001 1h4" />
        <path d="M9 13h6M9 17h6" />
      </>
    ),
  },
  {
    segment: "settings",
    label: "Settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.04 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1.04-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1.04H3a2 2 0 110-4h.09a1.7 1.7 0 001.56-1.04 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001.04-1.56V3a2 2 0 114 0v.09a1.7 1.7 0 001.04 1.56 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9a1.7 1.7 0 001.56 1.04H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.56 1.04z" />
      </>
    ),
  },
];

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function NavLinks({
  orgBase,
  pathname,
  onNavigate,
}: {
  orgBase: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const href = `${orgBase}/${item.segment}`;
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={item.segment}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border border-white/15 bg-white/10 text-white"
                : "border border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <NavIcon>{item.icon}</NavIcon>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Building/landmark glyph next to the organisation name. */
function OrgIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M4 21h16" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export default function Sidebar({
  orgId,
  orgName,
  userName,
  userEmail,
}: {
  orgId: string;
  orgName: string;
  userName?: string | null;
  userEmail: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const orgBase = `/org/${orgId}`;

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3 md:hidden">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
          <OrgIcon />
          <span className="truncate">{orgName}</span>
        </span>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="shrink-0 rounded-lg border border-line p-2 text-ink hover:bg-accent-soft"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col bg-accent text-white transition-transform duration-200 md:sticky md:top-0 md:h-dvh md:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            Saivly
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-1 text-zinc-400 hover:text-white md:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mx-3 mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
          <OrgIcon />
          <span className="truncate text-sm font-medium text-white">
            {orgName}
          </span>
        </div>

        <NavLinks orgBase={orgBase} pathname={pathname} onNavigate={() => setOpen(false)} />

        <div className="mt-auto border-t border-white/10 p-3">
          <div className="mb-2 truncate px-2 text-xs text-zinc-400">
            <span className="block truncate font-medium text-zinc-200">
              {userName || "Account"}
            </span>
            <span className="block truncate">{userEmail}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white">
              <NavIcon>
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </NavIcon>
              Log off
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
