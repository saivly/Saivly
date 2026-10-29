"use client";

import { createContext, useContext, useMemo } from "react";
import { createT, type Locale, type T } from "@/lib/i18n";

const I18nContext = createContext<{ locale: Locale; t: T }>({
  locale: "en",
  t: createT("en"),
});

/** Makes the current language available to client components via useT(). */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: createT(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Translator + locale for client components. */
export function useT() {
  return useContext(I18nContext);
}
