import { cookies } from "next/headers";
import { LOCALE_COOKIE, THEME_COOKIE, createT, toLocale, toTheme, type Locale, type T, type Theme } from "./i18n";

export async function getLocale(): Promise<Locale> {
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getTheme(): Promise<Theme> {
  return toTheme((await cookies()).get(THEME_COOKIE)?.value);
}

/** Translator for the current request's language (server components). */
export async function getT(): Promise<T> {
  return createT(await getLocale());
}
