import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * Logo pinned to the top-left of the signed-out / auth screens (login,
 * signup, 2FA, error). Absolutely positioned so it doesn't change those
 * pages' own vertically-centred layouts.
 */
export function BrandCorner({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Link href="/" className="absolute top-5 left-6 z-10 md:top-6 md:left-8">
        <Logo size={20} markSize={24} />
      </Link>
      {children}
    </>
  );
}
