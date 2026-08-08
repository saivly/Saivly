import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Browser-side Supabase client.
 * Use inside Client Components ("use client") only.
 * Regenerate types with `npm run db:types` once your schema evolves —
 * the <Database> generic keeps .from(...) calls type-checked against it.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { experimental: { passkey: true } } }
  );
}
