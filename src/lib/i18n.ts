// Language + theme preferences, both kept in plain cookies so the server
// can render the right <html lang> / .dark class on the first paint.

export const LOCALES = ["en", "nl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";

export function toLocale(value: string | undefined): Locale {
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}

export function toTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
};

// Strings for the shared onboarding chrome (header + sidebar). Page
// content isn't translated yet.
const DICTIONARY = {
  en: {
    "header.language": "Language",
    "header.theme.toDark": "Switch to dark mode",
    "header.theme.toLight": "Switch to light mode",
    "header.logout": "Log out",
    "sidebar.title": "Onboarding",
    "step.personal": "Personal info",
    "step.organisation": "Organisation info",
    "step.new-organisation": "New organisation",
    "step.company-information": "Company information",
    "step.business-activity": "Business activity",
    "step.contact-details": "Contact details",
    "step.adyen": "Adyen verification",
    "step.subscription": "Subscription",
  },
  nl: {
    "header.language": "Taal",
    "header.theme.toDark": "Donkere modus",
    "header.theme.toLight": "Lichte modus",
    "header.logout": "Uitloggen",
    "sidebar.title": "Onboarding",
    "step.personal": "Persoonlijke gegevens",
    "step.organisation": "Organisatiegegevens",
    "step.new-organisation": "Nieuwe organisatie",
    "step.company-information": "Bedrijfsinformatie",
    "step.business-activity": "Bedrijfsactiviteit",
    "step.contact-details": "Contactgegevens",
    "step.adyen": "Adyen-verificatie",
    "step.subscription": "Abonnement",
  },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof DICTIONARY)["en"];
export type Messages = Record<MessageKey, string>;

export function getMessages(locale: Locale): Messages {
  return DICTIONARY[locale];
}
