"use client";

import { createContext, useContext } from "react";

export type Lang = "th" | "en";

export const LANGS: Lang[] = ["th", "en"];
export const DEFAULT_LANG: Lang = "th";
export const LANG_STORAGE_KEY = "guess-music.lang";

/**
 * The whole UI vocabulary, both languages side by side.
 *
 * A flat object rather than a library: the copy here is a few dozen short
 * strings that mostly read as labels on a poster, and keeping both languages on
 * one line makes it obvious when one of them drifts.
 */
export const STRINGS = {
  appName: { th: "ทายเพลง", en: "Guess Music" },
  tagline: {
    th: "ฟังคลิป ทายชื่อเพลง แข่งกับเพื่อนแบบเรียลไทม์",
    en: "Hear a clip. Name the song. Race your friends in real time.",
  },

  yourName: { th: "ชื่อของคุณ", en: "Your name" },
  namePlaceholder: { th: "ใส่ชื่อเล่น", en: "Enter a nickname" },
  createRoom: { th: "สร้างห้อง", en: "Create room" },
  joinRoom: { th: "เข้าห้อง", en: "Join room" },
  roomCode: { th: "รหัสห้อง", en: "Room code" },
  codePlaceholder: { th: "รหัส 4 ตัว", en: "4 letters" },

  lobby: { th: "ห้องรอ", en: "Lobby" },
  players: { th: "ผู้เล่น", en: "Players" },
  host: { th: "หัวห้อง", en: "Host" },
  you: { th: "คุณ", en: "You" },
  waitingForHost: { th: "รอหัวห้องเริ่มเกม", en: "Waiting for the host" },
  startMatch: { th: "เริ่มเกม", en: "Start match" },
  backToLobby: { th: "กลับห้องรอ", en: "Back to lobby" },
  leave: { th: "ออก", en: "Leave" },
  copied: { th: "คัดลอกแล้ว", en: "Copied" },
  shareHint: {
    th: "ส่งรหัสนี้ให้เพื่อน แล้วให้กดเข้าห้อง",
    en: "Send this code to your friends",
  },

  category: { th: "หมวดเพลง", en: "Category" },
  categoryThai: { th: "เพลงไทย", en: "Thai" },
  categoryIntl: { th: "เพลงสากล", en: "International" },
  categoryKpop: { th: "เคป็อป", en: "K-pop" },

  difficulty: { th: "ความยาก", en: "Difficulty" },
  difficultyEasy: { th: "ง่าย", en: "Easy" },
  difficultyMedium: { th: "ปานกลาง", en: "Medium" },
  difficultyHard: { th: "ยาก", en: "Hard" },
  difficultyExtreme: { th: "ยากมาก", en: "Extreme" },
  clipLength: { th: "ความยาวคลิป", en: "Clip" },
  multiplier: { th: "ตัวคูณคะแนน", en: "Multiplier" },
  rounds: { th: "จำนวนข้อ", en: "Rounds" },

  unlockAudio: { th: "แตะเพื่อเปิดเสียง", en: "Tap to enable sound" },
  unlockHint: {
    th: "เบราว์เซอร์ต้องให้แตะหนึ่งครั้งก่อนถึงจะเล่นเสียงได้",
    en: "Browsers need one tap before they will play audio",
  },
  loadingAudio: { th: "กำลังโหลดเพลง", en: "Loading audio" },
  loadingTracks: { th: "กำลังเลือกเพลง", en: "Picking songs" },

  round: { th: "ข้อ", en: "Round" },
  whichSong: { th: "เพลงอะไร", en: "Which song?" },
  answered: { th: "ตอบแล้ว", en: "Answered" },
  waitingOthers: { th: "รอคนอื่น", en: "Waiting for others" },
  correct: { th: "ถูก", en: "Correct" },
  wrong: { th: "ผิด", en: "Wrong" },
  noAnswer: { th: "ไม่ได้ตอบ", en: "No answer" },
  theAnswer: { th: "คำตอบ", en: "Answer" },

  finalScore: { th: "คะแนนรวม", en: "Final score" },
  standings: { th: "อันดับ", en: "Standings" },
  playAgain: { th: "เล่นอีกครั้ง", en: "Play again" },

  connecting: { th: "กำลังเชื่อมต่อ", en: "Connecting" },
  disconnected: { th: "หลุดการเชื่อมต่อ", en: "Disconnected" },
  reconnecting: { th: "กำลังเชื่อมต่อใหม่", en: "Reconnecting" },
  roomClosed: { th: "ห้องถูกปิดแล้ว", en: "This room has closed" },
  offline: { th: "ออฟไลน์", en: "Offline" },
} as const;

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
