"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  LangContext,
  translatorFor,
  type Lang,
} from "./i18n";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Read after mount rather than during render: the server has no idea what
  // the visitor picked last time, and reading during render would mismatch.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === "th" || saved === "en") setLangState(saved);
    } catch {
      /* blocked site data: the default is fine */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* see above */
    }
  }, []);

  const value = useMemo(
    () => ({ lang, setLang, t: translatorFor(lang) }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
