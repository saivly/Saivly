"use client";

import { useFormStatus } from "react-dom";

// useFormStatus only reports the enclosing <form>'s real pending state
// when called from a component distinct from the one rendering the
// <form> itself — same reasoning as ContinueButton in
// ../company/company-form.tsx. page.tsx is a server component (it does
// its own data fetching), so this can't just be inlined there — it needs
// its own "use client" file. This click mints a fresh, single-use Adyen
// onboarding link and redirects to it, so a second click before the
// first request lands could burn (or double-request) that link.
export default function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Redirecting…" : "Continue to Adyen"}
    </button>
  );
}
