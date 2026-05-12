"use client";

import { useState, useEffect, useCallback } from "react";
import {
  translations,
  SUPPORTED_LOCALES,
  type LocaleCode,
  type Translations,
} from "./translations";

const STORAGE_KEY = "gt-locale";

/** Detect the best matching locale from navigator.language */
function detectLocale(): LocaleCode {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase().split("-")[0];
  const supported = SUPPORTED_LOCALES.map((l) => l.code);
  return (supported.includes(lang as LocaleCode) ? lang : "en") as LocaleCode;
}

/** Read stored preference, fall back to browser detection */
export function resolveLocale(): LocaleCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as LocaleCode | null;
    if (stored && translations[stored]) return stored;
  } catch {
    // localStorage not available (SSR, private mode)
  }
  return detectLocale();
}

interface UseTranslationsReturn {
  t: Translations;
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
}

/**
 * useTranslations — the single hook for all localized strings.
 *
 * Reads language from localStorage (user preference) then falls back to
 * navigator.language (browser/OS setting). Call setLocale() to change and
 * persist the preference.
 *
 * Usage:
 *   const { t, locale, setLocale } = useTranslations();
 *   <p>{t.emergency.title}</p>
 *   <a href={`sms:112?body=${encodeURIComponent(t.emergency.smsBody(mapsUrl, lat, lng))}`}>
 */
export function useTranslations(): UseTranslationsReturn {
  const [locale, setLocaleState] = useState<LocaleCode>("en");

  useEffect(() => {
    setLocaleState(resolveLocale());
  }, []);

  const setLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }, []);

  return {
    t: translations[locale],
    locale,
    setLocale,
  };
}

export { SUPPORTED_LOCALES, type LocaleCode, type Translations };
