"use client";

import { createContext, useContext } from "react";
import { STRINGS } from "@/shared/strings";

export type Lang = "th" | "en";

export const LANGS: Lang[] = ["th", "en"];
export const DEFAULT_LANG: Lang = "th";
export const LANG_STORAGE_KEY = "guess-music.lang";

export { STRINGS };

export type StringKey = keyof typeof STRINGS;

export type Translator = (key: StringKey) => string;

export const LangContext = createContext<{
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translator;
}>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => STRINGS[key][DEFAULT_LANG],
});

export function useLang() {
  return useContext(LangContext);
}

export function translatorFor(lang: Lang): Translator {
  return (key) => STRINGS[key][lang];
}
