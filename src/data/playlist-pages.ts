import type { PlaylistId } from "@/shared/types";

/**
 * What each Playlist's public page says about it.
 *
 * The heading is the search phrase, written the way people type it —
 * "ทายเพลงลูกทุ่ง", not the picker's "ลูกทุ่ง". The blurb says where the songs
 * come from and has to stay true to the source in src/data/seeds: it names eras
 * and origins, never a song count, which the page works out for itself.
 */
export const PLAYLIST_PAGES: Record<PlaylistId, { heading: string; blurb: string }> = {
  "thai-now": {
    heading: "ทายเพลงไทยฮิตตอนนี้",
    blurb: "เพลงไทยจากชาร์ตเพลงที่คนไทยเปิดฟังมากที่สุดบน Apple Music รายชื่อเปลี่ยนตามชาร์ตทุกวัน",
  },
  "thai-buzz": {
    heading: "ทายเพลงฮิตติดกระแส",
    blurb: "เพลงที่กำลังเป็นกระแส คัดมาเป็นรายเพลงจากเพลย์ลิสต์ฮิต มีเพลงสากลและเคป็อปปนอยู่บ้างตามต้นฉบับ",
  },
  "thai-classic": {
    heading: "ทายเพลงไทยฮิตตลอดกาล",
    blurb: "เพลงไทยที่คนรู้จักกันทุกยุค สุ่มจากศิลปินไทยที่คัดไว้ แต่ละเกมจะได้ศิลปินชุดใหม่",
  },
  "thai-90s": {
    heading: "ทายเพลงไทยยุค 90",
    blurb: "เพลงไทยยุค 90 ถึงต้นยุค 2000 เฉพาะเพลงที่ออกปี 1988–2005 จากศิลปินในยุคนั้น",
  },
  "thai-2000s": {
    heading: "ทายเพลงไทยยุค 2000s",
    blurb: "เพลงไทยยุคสตริง เฉพาะเพลงที่ออกปี 2000–2012 จากศิลปินในยุคนั้น",
  },
  "thai-2020s": {
    heading: "ทายเพลงไทยฮิต 2020s",
    blurb: "เพลงไทยของศิลปินรุ่นใหม่ เฉพาะเพลงที่ออกตั้งแต่ปี 2020 เป็นต้นมา",
  },
  "thai-rap": {
    heading: "ทายเพลงแร็ปไทย",
    blurb: "เพลงแร็ปและฮิปฮอปไทย สุ่มจากแร็ปเปอร์ไทยที่คัดไว้",
  },
  "thai-luk-thung": {
    heading: "ทายเพลงลูกทุ่ง",
    blurb: "เพลงลูกทุ่งที่คัดไว้เป็นรายเพลง",
  },
  "thai-sad": {
    heading: "ทายเพลงเศร้า",
    blurb: "เพลงไทยเศร้า ๆ ที่คัดไว้เป็นรายเพลง",
  },
  "thai-2012-2017": {
    heading: "ทายเพลงไทย 2012–2017",
    blurb: "เพลงไทยที่ฮิตช่วงปี 2012–2017 คัดไว้เป็นรายเพลง",
  },
  "thai-2019-2020": {
    heading: "ทายเพลงไทย 2019–2020",
    blurb: "เพลงไทยที่ฮิตช่วงปี 2019–2020 คัดไว้เป็นรายเพลง",
  },
  "intl-now": {
    heading: "ทายเพลงสากลฮิตตอนนี้",
    blurb: "เพลงจากชาร์ตเพลงที่คนเปิดฟังมากที่สุดบน Apple Music สหรัฐอเมริกา รายชื่อเปลี่ยนตามชาร์ตทุกวัน",
  },
  "intl-classic": {
    heading: "ทายเพลงสากลฮิตตลอดกาล",
    blurb: "เพลงสากลที่คนรู้จักกันทั่วโลก สุ่มจากศิลปินสากลที่คัดไว้",
  },
  "intl-tiktok": {
    heading: "ทายเพลงไวรัล TikTok",
    blurb: "เพลงที่ดังจาก TikTok คัดไว้เป็นรายเพลง",
  },
  "kpop-now": {
    heading: "ทายเพลงเคป็อปฮิตตอนนี้",
    blurb: "เพลงเกาหลีจากชาร์ตเพลงที่คนเปิดฟังมากที่สุดบน Apple Music เกาหลีใต้ รายชื่อเปลี่ยนตามชาร์ตทุกวัน",
  },
  "kpop-classic": {
    heading: "ทายเพลงเคป็อปฮิตตลอดกาล",
    blurb: "เพลงเคป็อปที่คนรู้จัก สุ่มจากศิลปินเกาหลีที่คัดไว้",
  },
  "anime-all": {
    heading: "ทายเพลงอนิเมะ",
    blurb: "เพลงเปิดและเพลงปิดจากอนิเมะ ทายได้ทั้งชื่อเพลง หรือเล่นโหมดทายว่ามาจากเรื่องอะไร",
  },
};
