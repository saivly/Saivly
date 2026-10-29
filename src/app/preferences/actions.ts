"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, toLocale } from "@/lib/i18n";

const ONE_YEAR = 60 * 60 * 24 * 365;

// Setting a cookie in a Server Action re-renders the current route, so
// server-rendered text switches language straight away.
export async function setLocale(locale: string) {
  (await cookies()).set(LOCALE_COOKIE, toLocale(locale), {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}
