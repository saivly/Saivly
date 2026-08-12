"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ONBOARDING_STEPS } from "@/lib/onboarding/onboarding";

type Step = (typeof ONBOARDING_STEPS)[number];

export default function OnboardingSidebar({
  steps,
  stepDone,
}: {
  steps: readonly Step[];
  stepDone: Record<string, boolean>;
}) {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 md:w-56">
      <h2 className="mb-4 text-sm font-medium tracking-wide text-muted uppercase">
        Onboarding
      </h2>
      <ol className="flex flex-row gap-2 overflow-x-auto md:flex-col md:gap-1 md:overflow-visible">
        {steps.map((step, i) => {
          // A step can span several URLs (see ONBOARDING_STEPS) — active if
          // the current page is any of them.
          const active = (step.paths as readonly string[]).some(
            (p) => pathname === `/onboarding/${p}`
          );
          const done = stepDone[step.key];
          // Reachable = already done (revisit/edit) or the current step.
          // Steps ahead of where the user actually is aren't links — typing
          // the URL directly still gets redirected back by the page itself.
          const reachable = done || active;
          // While active, link to wherever the user already is (a no-op);
          // once done-but-not-active, land on the step's canonical
          // revisit/edit page rather than back at its first URL.
          const href = active ? pathname : `/onboarding/${step.revisitPath}`;

          const content = (
            <div
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
                active
                  ? "bg-accent-soft font-medium text-ink"
                  : done
                    ? "text-ink hover:bg-panel"
                    : "text-muted"
              }`}
            >
              <StepIcon done={done} active={active} index={i} />
              <span className="truncate">{step.label}</span>
            </div>
          );

          return (
            <li key={step.key} className="shrink-0 md:shrink md:w-full">
              {reachable ? (
                <Link href={href} aria-current={active ? "step" : undefined}>
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepIcon({
  done,
  active,
  index,
}: {
  done: boolean;
  active: boolean;
  index: number;
}) {
  if (done) {
    return (
      <svg
        viewBox="0 0 20 20"
        className="size-5 shrink-0 text-success"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="10" fill="currentColor" />
        <path
          d="M6 10.5l2.5 2.5L14 7.5"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
        active ? "border-ink text-ink" : "border-line text-muted"
      }`}
    >
      {index + 1}
    </span>
  );
}
