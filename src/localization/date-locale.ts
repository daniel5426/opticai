import { enUS, fr, he, type Locale } from "date-fns/locale";
import type { AppLocale } from "./locale";

const dateLocales: Record<AppLocale, Locale> = { he, en: enUS, fr };

export function getDateLocale(locale: AppLocale): Locale {
  return dateLocales[locale];
}
