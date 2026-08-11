import type { i18n } from "i18next";
import {
  applyDocumentLocale,
  getActiveLocale,
  normalizeLocale,
  persistLocale,
  replaceBrowserLocale,
} from "@/localization/locale";

export function setAppLanguage(lang: string, i18n: i18n) {
  const locale = normalizeLocale(lang);
  if (!locale) return;

  persistLocale(locale);
  applyDocumentLocale(locale);
  replaceBrowserLocale(locale);
  void i18n.changeLanguage(locale);
}

export function updateAppLanguage(i18n: i18n) {
  const locale = getActiveLocale();
  applyDocumentLocale(locale);
  void i18n.changeLanguage(locale);
}
