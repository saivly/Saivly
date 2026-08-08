import Link from "next/link";

export default function ErrorPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted">
        The link may have expired or already been used. Try signing in again.
      </p>
      <Link href="/login" className="text-accent hover:underline">
        Back to sign in
      </Link>
    </main>
  );
}
