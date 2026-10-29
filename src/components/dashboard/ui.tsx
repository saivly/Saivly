import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Building blocks for the org dashboard, matching the Northbank design
 * spec (colors/sizes live in globals.css as db-* tokens). Server-safe:
 * nothing here uses hooks, so client components can import these too.
 */

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Material Symbols Rounded glyph — the font is loaded in the org layout. */
export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("material-symbols-rounded inline-block shrink-0 overflow-hidden", className)}
      style={{ fontSize: size, width: size, height: size }}
    >
      {name}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-bold text-db-ink">{title}</h1>
        {subtitle && <p className="text-sm text-db-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-xl border border-db-border bg-db-card p-5 sm:p-6", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-db-ink">{children}</h2>
      {aside}
    </div>
  );
}

// ---------- Buttons ----------
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

export const buttonStyles = {
  primary: cx(BUTTON_BASE, "bg-db-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-db-primary-hover"),
  secondary: cx(
    BUTTON_BASE,
    "border border-db-border bg-db-card px-3.5 py-2 text-[13px] font-medium text-db-ink hover:bg-db-page"
  ),
  ghost: cx(BUTTON_BASE, "px-3 py-1.5 text-[13px] font-semibold text-db-primary hover:bg-db-tint"),
};

type Variant = keyof typeof buttonStyles;

export function Button({
  variant = "primary",
  icon,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; icon?: string }) {
  return (
    <button className={cx(buttonStyles[variant], className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  icon,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; icon?: string }) {
  return (
    <Link className={cx(buttonStyles[variant], className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Link>
  );
}

// ---------- Status pill ----------
export type PillTone = "success" | "warning" | "danger" | "info" | "neutral";

const PILL_TONES: Record<PillTone, string> = {
  success: "bg-db-success-tint text-db-success",
  warning: "bg-db-warning-tint text-db-warning",
  danger: "bg-db-danger-tint text-db-danger",
  info: "bg-db-tint text-db-info",
  neutral: "bg-db-segment text-db-muted",
};

export function StatusPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-[9px] py-[3px] text-xs font-semibold whitespace-nowrap",
        PILL_TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

// ---------- Segmented tabs ----------
export function Segmented({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("inline-flex max-w-full gap-1 overflow-x-auto rounded-[9px] bg-db-segment p-1", className)}>
      {children}
    </div>
  );
}

export function segmentStyles(active: boolean, size: "sm" | "lg" = "sm") {
  return cx(
    "inline-flex items-center gap-1.5 rounded-md whitespace-nowrap transition-colors",
    size === "lg" ? "px-4 py-[7px] text-sm font-semibold" : "px-3.5 py-1.5 text-[13px] font-medium",
    active ? "bg-db-segment-active text-db-ink shadow-[0_1px_2px_rgba(15,27,45,.12)]" : "text-db-muted hover:text-db-ink"
  );
}

export function SegmentLink({
  active,
  size,
  icon,
  children,
  ...rest
}: ComponentProps<typeof Link> & { active: boolean; size?: "sm" | "lg"; icon?: string }) {
  return (
    <Link className={segmentStyles(active, size)} aria-current={active ? "page" : undefined} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </Link>
  );
}

// ---------- Table ----------
/** A grid-based table so rows can keep the design's fractional column widths. */
export function Table({
  columns,
  minWidth = 720,
  head,
  children,
}: {
  columns: string;
  minWidth?: number;
  head: ReactNode[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <div role="table" style={{ minWidth }}>
        <div
          role="row"
          className="grid bg-db-subtle text-xs font-semibold tracking-[.05em] text-db-muted uppercase"
          style={{ gridTemplateColumns: columns }}
        >
          {head.map((cell, i) => (
            <div key={i} role="columnheader" className="px-5 py-3 last:text-right">
              {cell}
            </div>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function TableRow({ columns, cells }: { columns: string; cells: ReactNode[] }) {
  return (
    <div
      role="row"
      className="grid items-center border-t border-db-row text-sm text-db-ink hover:bg-db-subtle"
      style={{ gridTemplateColumns: columns }}
    >
      {cells.map((cell, i) => (
        <div key={i} role="cell" className="min-w-0 truncate px-5 py-3.5 last:text-right">
          {cell}
        </div>
      ))}
    </div>
  );
}

export function TableEmpty({ children }: { children: ReactNode }) {
  return <div className="border-t border-db-row px-5 py-10 text-center text-sm text-db-muted">{children}</div>;
}

// ---------- Forms ----------
export const inputStyles =
  "w-full rounded-lg border border-db-input bg-db-card px-3 py-2.5 text-base text-db-ink outline-none placeholder:text-db-faint focus:border-db-primary disabled:bg-db-subtle disabled:text-db-muted sm:text-sm";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-db-text">{label}</span>
      {children}
      {hint && <span className="text-xs text-db-muted">{hint}</span>}
    </label>
  );
}

/** 40×22 switch. Pass `name` to submit it in a form, or onChange for client use. */
export function ToggleVisual({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative inline-block h-[22px] w-10 shrink-0 rounded-full transition-colors",
        on ? "bg-db-primary" : "bg-db-toggle-off"
      )}
    >
      <span
        className={cx(
          "absolute top-[2px] h-[18px] w-[18px] rounded-full bg-db-card shadow-sm transition-[left]",
          on ? "left-5" : "left-[2px]"
        )}
      />
    </span>
  );
}

// ---------- Icon chip ----------
export type ChipTone = "blue" | "green" | "amber" | "violet" | "red" | "neutral";

const CHIP_TONES: Record<ChipTone, string> = {
  blue: "bg-db-tint text-db-primary",
  green: "bg-db-success-tint text-db-success",
  amber: "bg-db-warning-tint text-db-warning",
  violet: "bg-db-violet-tint text-db-violet",
  red: "bg-db-danger-tint text-db-danger",
  neutral: "bg-db-segment text-db-muted",
};

export function IconChip({
  name,
  tone,
  round,
  size = 20,
  className,
}: {
  name: string;
  tone: ChipTone;
  round?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center",
        round ? "rounded-full p-2" : "rounded-lg p-1.5",
        CHIP_TONES[tone],
        className
      )}
    >
      <Icon name={name} size={size} />
    </span>
  );
}

export function chipToneClass(tone: ChipTone) {
  return CHIP_TONES[tone];
}
