/**
 * Saivly logo: keyhole coin (mark) + "sai✓ly" wordmark.
 * Spec and colours: public/brand (see SAIVLY-LOGO.md from design).
 *
 * tone="auto"     follows the theme tokens: navy coin/text on light pages,
 *                 light coin/text in dark mode (= the reversed artwork).
 * tone="reversed" always light, for surfaces that are dark in both themes
 *                 (the sidebar).
 *
 * Server-safe: no hooks.
 */

type Tone = "auto" | "reversed";

// The keyhole stays #2f6fdb in every variant (spec: never outside the blue family).
const KEYHOLE = "#2f6fdb";

const TONES: Record<Tone, { coin: string; text: string; check: string }> = {
  auto: { coin: "var(--color-ink)", text: "text-ink", check: "text-accent" },
  reversed: { coin: "#e6ebf2", text: "text-[#e6ebf2]", check: "text-[#3d7fea]" },
};

export function LogoMark({
  size = 24,
  tone = "auto",
  className,
}: {
  size?: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className={`shrink-0 ${className ?? ""}`}
    >
      <circle cx="24" cy="24" r="24" fill={TONES[tone].coin} />
      <circle cx="24" cy="20" r="7" fill={KEYHOLE} />
      <path d="M20.5 23h7l2.2 13.5h-11.4z" fill={KEYHOLE} />
    </svg>
  );
}

/** "sai" + drawn check + "ly". Never a plain "v". */
export function Wordmark({ size = 20, tone = "auto" }: { size?: number; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-baseline leading-none font-bold tracking-[-0.04em] ${t.text}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      sai
      <svg
        viewBox="0 0 34 30"
        className={`mx-[0.05em] shrink-0 ${t.check}`}
        style={{ width: "0.6em", height: `${(0.6 * 30) / 34}em` }}
      >
        <path
          d="M4 13l9 11L30 4"
          fill="none"
          stroke="currentColor"
          strokeWidth={7.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      ly
    </span>
  );
}

/**
 * Mark + wordmark lockup. Pass the wordmark font size; the mark is
 * ≈1.1× that and the gap ≈0.28× (rounded up slightly for small sizes).
 */
export function Logo({
  size = 20,
  markSize,
  tone = "auto",
  className,
}: {
  size?: number;
  markSize?: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Saivly"
      className={`inline-flex items-center ${className ?? ""}`}
      style={{ gap: Math.round(size * 0.28) }}
    >
      <LogoMark size={markSize ?? Math.round(size * 1.2)} tone={tone} />
      <Wordmark size={size} tone={tone} />
    </span>
  );
}
