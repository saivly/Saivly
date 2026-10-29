import { cookies } from "next/headers";
import { LOCALE_COOKIE, THEME_COOKIE, toLocale, toTheme, type Locale, type Theme } from "./i18n";

export async function getLocale(): Promise<Locale> {
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

export async function getTheme(): Promise<Theme> {
  return toTheme((await cookies()).get(THEME_COOKIE)?.value);
}
