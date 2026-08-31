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
  openRooms: { th: "ห้องที่เปิดอยู่", en: "Open rooms" },
  noOpenRooms: {
    th: "ยังไม่มีห้องที่เปิดอยู่ — สร้างห้องแรกได้เลย",
    en: "No open rooms yet — make the first one",
  },
  join: { th: "เข้า", en: "Join" },
  roomFull: { th: "เต็ม", en: "Full" },
  inMatch: { th: "กำลังเล่น", en: "Playing" },
  waiting: { th: "รอเริ่ม", en: "Waiting" },
  needNameFirst: { th: "ใส่ชื่อก่อนถึงจะเข้าห้องได้", en: "Enter a name first" },
  lockRoom: { th: "ซ่อนห้องจากรายการ", en: "Hide from room list" },
  lockedHint: {
    th: "ห้องนี้ไม่แสดงในหน้าแรก เข้าได้เฉพาะคนที่มีรหัส",
    en: "Not shown on the home page — only people with the code can join",
  },
  listedHint: {
    th: "ห้องนี้แสดงในหน้าแรก ใครก็กดเข้าได้",
    en: "Shown on the home page — anyone can join",
  },
  players: { th: "ผู้เล่น", en: "Players" },
  host: { th: "หัวห้อง", en: "Host" },
  you: { th: "คุณ", en: "You" },
  waitingForHost: { th: "รอหัวห้องเริ่มเกม", en: "Waiting for the host" },
  startMatch: { th: "เริ่มเกม", en: "Start match" },
  backToLobby: { th: "เปลี่ยนเพลง / ความยาก", en: "Change songs or difficulty" },
  leave: { th: "ออก", en: "Leave" },
  copied: { th: "คัดลอกแล้ว", en: "Copied" },
  shareHint: {
    th: "ส่งรหัสนี้ให้เพื่อน แล้วให้กดเข้าห้อง",
    en: "Send this code to your friends",
  },

  /* --- game modes and the three steps that set a match up --- */
  gameMode: { th: "โหมดการเล่น", en: "Game mode" },
  stepMode: { th: "โหมด", en: "Mode" },
  stepSongs: { th: "เพลง", en: "Songs" },
  stepSettings: { th: "ตั้งค่า", en: "Settings" },
  next: { th: "ถัดไป", en: "Next" },

  "mode.quiz": { th: "ทายเพลง", en: "Guess the song" },
  "mode.quiz.hint": {
    th: "ฟังคลิปสั้น ๆ แล้วเลือกคำตอบ ตอบได้ครั้งเดียว ใครไวกว่าได้แต้มมากกว่า",
    en: "One clip, one answer. The faster you lock it in, the more it pays.",
  },
  "mode.heardle": { th: "Heardle แข่งกัน", en: "Heardle — head to head" },
  "mode.heardle.hint": {
    th: "เพลงยาวขึ้นเรื่อย ๆ แต้มลดลงเรื่อย ๆ ทายผิดได้ 2 ครั้ง แต่เสียแต้ม ต่างคนต่างแต้ม",
    en: "The clip keeps growing and the points keep dropping. Two wrong guesses allowed, each one costs you. Everyone for themselves.",
  },
  "mode.heardle-coop": { th: "Heardle ช่วยกัน", en: "Heardle — co-op" },
  "mode.heardle-coop.hint": {
    th: "กติกาเดียวกัน แต่ทั้งห้องใช้สิทธิ์ทายร่วมกัน 2 ครั้ง และได้แต้มก้อนเดียวกันทุกคน",
    en: "Same rules, but the room shares one pair of guesses — and everyone banks the same points.",
  },

  pointsNow: { th: "แต้มตอนนี้", en: "Worth now" },
  guessesLeft: { th: "ทายผิดได้อีก", en: "Wrong guesses left" },
  guessesLeftTeam: { th: "ทั้งห้องทายผิดได้อีก", en: "Wrong guesses left for the room" },
  struckOut: { th: "ตัดออกแล้ว", en: "Ruled out" },
  keepListening: { th: "ผิด — ฟังต่อแล้วลองใหม่", en: "Wrong — keep listening and try again" },
  outOfGuesses: { th: "หมดสิทธิ์ทายแล้วรอบนี้", en: "Out of guesses this round" },
  teamScore: { th: "คะแนนทีม", en: "Team score" },
  teamName: { th: "ทั้งห้อง", en: "The room" },
  coopWaiting: { th: "ใครก็ได้ในห้องกดตอบ", en: "Anyone in the room can answer" },

  playlist: { th: "เพลย์ลิสต์", en: "Playlist" },
  groupThai: { th: "เพลงไทย", en: "Thai" },
  groupIntl: { th: "เพลงสากล", en: "International" },
  groupKpop: { th: "เคป็อป", en: "K-pop" },

  "playlist.thai-now": { th: "ไทยฮิตตอนนี้", en: "Thai — charting now" },
  "playlist.thai-buzz": { th: "ฮิตติดกระแส", en: "Thai — trending" },
  "playlist.thai-classic": { th: "ไทยฮิตตลอดกาล", en: "Thai — all-time" },
  "playlist.thai-90s": { th: "ไทยยุค 90", en: "Thai — the 90s" },
  "playlist.thai-2000s": { th: "ไทยยุค 2000s", en: "Thai — the 2000s" },
  "playlist.thai-2020s": { th: "ไทยฮิต 2020s", en: "Thai — the 2020s" },
  "playlist.intl-now": { th: "สากลฮิตตอนนี้", en: "Global — charting now" },
  "playlist.intl-classic": { th: "สากลฮิตตลอดกาล", en: "Global — all-time" },
  "playlist.kpop-now": { th: "เคป็อปฮิตตอนนี้", en: "K-pop — charting now" },
  "playlist.kpop-classic": { th: "เคป็อปฮิตตลอดกาล", en: "K-pop — all-time" },

  /* Shown under the chart playlists, which refresh themselves daily. */
  chartHint: { th: "อัปเดตทุกวัน", en: "Refreshed daily" },
  playlistsCount: { th: "เพลย์ลิสต์", en: "playlists" },
  artistsCount: { th: "ศิลปิน", en: "artists" },
  byArtist: { th: "ศิลปิน", en: "By artist" },
  byArtistHint: {
    th: "ทุกตัวเลือกจะเป็นเพลงของศิลปินคนเดียวกัน — ฟังเสียงร้องช่วยไม่ได้",
    en: "Every option is by the same artist — the voice tells you nothing",
  },
  filterArtists: { th: "พิมพ์เพื่อค้นชื่อ", en: "Type to filter" },
  noArtists: { th: "ไม่พบศิลปินที่ตรง", en: "No matching artist" },
  back: { th: "ย้อนกลับ", en: "Back" },

  difficulty: { th: "ความยาก", en: "Difficulty" },
  difficultyEasy: { th: "ง่าย", en: "Easy" },
  difficultyMedium: { th: "ปานกลาง", en: "Medium" },
  difficultyHard: { th: "ยาก", en: "Hard" },
  difficultyExtreme: { th: "ยากมาก", en: "Extreme" },
  clipLength: { th: "ความยาวคลิป", en: "Clip" },
  multiplier: { th: "ตัวคูณคะแนน", en: "Multiplier" },
  rounds: { th: "จำนวนข้อ", en: "Rounds" },
  roundsUnit: { th: "ข้อ", en: "rounds" },

  volume: { th: "ระดับเสียง", en: "Volume" },
  volumeUp: { th: "เพิ่มเสียง", en: "Louder" },
  volumeDown: { th: "ลดเสียง", en: "Quieter" },

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
  timeLeft: { th: "เวลาที่เหลือ", en: "Time left" },
  musicPlaying: { th: "กำลังเล่นเพลง", en: "Music playing" },
  silence: { th: "เพลงหยุดแล้ว ยังตอบได้", en: "Music stopped — still answering" },
  yourRounds: { th: "ผลของคุณ", en: "Your rounds" },
  waitingOthers: { th: "รอคนอื่น", en: "Waiting for others" },
  correct: { th: "ถูก", en: "Correct" },
  wrong: { th: "ผิด", en: "Wrong" },
  noAnswer: { th: "ไม่ได้ตอบ", en: "No answer" },
  theAnswer: { th: "คำตอบ", en: "Answer" },

  finalScore: { th: "คะแนนรวม", en: "Final score" },
  standings: { th: "อันดับ", en: "Standings" },
  playAgain: { th: "เล่นอีกครั้ง", en: "Play again" },
  songsPlayed: { th: "เพลงที่เล่นไป", en: "Songs played" },
  listen: { th: "ฟัง", en: "Play" },
  stopListening: { th: "หยุด", en: "Stop" },

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
