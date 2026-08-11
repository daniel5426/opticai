import { useTranslation } from "react-i18next";
import {
  getActiveLocale,
  getDirection,
  normalizeLocale,
  type AppLocale,
} from "./locale";

/** The active UI locale and its document direction for renderer components. */
export function useAppLocale(): {
  locale: AppLocale;
  direction: "rtl" | "ltr";
} {
  const { i18n } = useTranslation();
  const locale =
    normalizeLocale(i18n.resolvedLanguage ?? i18n.language) ??
    getActiveLocale();

  return { locale, direction: getDirection(locale) };
}
