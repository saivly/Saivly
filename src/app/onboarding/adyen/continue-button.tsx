"use client";

import { useFormStatus } from "react-dom";

const VARIANT_CLASSES = {
  primary:
    "w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-db-primary-hover disabled:opacity-50 sm:w-auto",
  outline:
    "rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent-soft disabled:opacity-50",
} as const;

// useFormStatus only reports the enclosing <form>'s real pending state
// when called from a component distinct from the one rendering the
// <form> itself — same reasoning as ContinueButton in
// ../company/company-form.tsx. page.tsx is a server component (it does
// its own data fetching), so this can't just be inlined there — it needs
// its own "use client" file. Both of this page's uses of this button
// (the first-time "Continue to Adyen" and the completed-state "Review
// with Adyen again") mint a fresh, single-use Adyen onboarding link and
// redirect to it, so a second click before the first request lands could
// burn (or double-request) that link — disabled here covers both.
export default function ContinueButton({
  idleLabel = "Continue to Adyen",
  pendingLabel = "Redirecting…",
  variant = "primary",
}: {
  idleLabel?: string;
  pendingLabel?: string;
  variant?: keyof typeof VARIANT_CLASSES;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={VARIANT_CLASSES[variant]}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
