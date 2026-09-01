/**
 * Resolved from thai-2019-2020-source.csv by scripts/resolve-csv-playlist.ts.
 *
 * Ids rather than names on purpose: the list names exact recordings, so what
 * plays is what was chosen, and one lookup request fetches the lot.
 *
 * 91 of 99 tracks resolved. The rest are not on the Thai
 * iTunes storefront, or are there under a title too different to match.
 */
export const THAI_2019_2020_TRACK_IDS: readonly string[] = [
  "1686101738", // Better Weather — แค่เท่านั้น
  "439454039", // Better Weather — ยังไม่รู้
  "948345594", // Blue Shade — อยากเจอ (Reason of Loneliness)
  "1829232383", // BOWKYLION — คิดถึงแต่ (Untold)
  "1829232384", // BOWKYLION — ยิ้มมา (Crush)
  "1829232388", // BOWKYLION — ลงใจ
  "1829958971", // F.HERO — จำเก่ง (Slipped Your Mind) [feat. Tilly Birds]
  "1829217006", // F.HERO — จำเลยรัก (Defendant Of Love) [feat. Txrbo]
  "6778622779", // First Anuwat — ถ้าเขาจะรัก (ยืนเฉยๆเขาก็รัก)
  "1502562328", // GUNGUN — วาฬเกยตื้น
  "1871385716", // Indigo — ถ้าฉันเป็นเขา
  "1861534482", // Ink Waruntorn — เกี่ยวกันไหม (You?)
  "1439424602", // Ink Waruntorn — ความลับมีในโลก (Secret)
  "6762745093", // Ink Waruntorn — ฉันต้องคิดถึงเธอแบบไหน (Cloudy)
  "1861524789", // Ink Waruntorn — ดีใจด้วยนะ(Glad)
  "1861520891", // Ink Waruntorn — เธอบอกว่าฉันไม่ดี (BOXX FROM HOME)
  "1861524396", // Ink Waruntorn — รอหรือพอ(STAY)
  "1861522255", // Ink Waruntorn — ลบไม่ได้ช่วยให้ลืม (Erase)
  "1861516784", // Ink Waruntorn — สายตาหลอกกันไม่ได้ (Eyes don't lie)
  "1861522660", // Ink Waruntorn — อยากเริ่มต้นใหม่กับคนเดิม (REPEAT)
  "1871666135", // Jaonaay — ดึกแล้วอย่าเพิ่งกลับ
  "1779813004", // LAZYLOXY — Morning
  "1779813057", // LAZYLOXY — TMRW (feat. OG-ANIC & URBOYTJ)
  "1612699201", // Lipta — เจอแต่คนใจร้าย (feat. Ink Waruntorn)
  "1779813626", // Maiyarap — แฟนใหม่หน้าคุ้น (feat. MILLI)
  "6762708818", // Marc Tatchapon — ยังคิดถึง...(Same)
  "1573005741", // MEAN Band — เป็นอดีต
  "1573005271", // MEAN Band — พอเถอะ
  "1573007614", // MEAN Band — สตรอง
  "1573008136", // MEAN Band — หมายความว่าอะไร
  "1573276380", // MEAN Band — เหมาะสม
  "1792747451", // MEYOU — ภาวนา
  "1696552840", // Mirrr — ชาคริส (feat. T-Biggest) [Try?]
  "1684918542", // Mirrr — นิโคติน
  "1829264529", // Morvasu — Melbourne (feat. TangBadVoice)
  "1675576744", // NAP A LEAN — ไม่คิดถึงเลย
  "1443502414", // Ninja & LAZYLOXY — ยังไง (feat. FRVNKY)
  "1793184168", // Oat Pramote — คิดถึงจัง (มาหาหน่อย)
  "1793140794", // Oat Pramote — เมื่อวาน
  "1344901797", // P-HOT — Bye Bye (feat. Youngohm)
  "1792747897", // Palmy — ซ่อนกลิ่น
  "1540737600", // Polycat — ข่าวดี
  "1792747361", // Pop Pongkool — Happy Ending
  "1792748127", // Pop Pongkool — ปล่อย
  "1792747691", // Pop Pongkool — พรุ่งนี้ค่อย... (CHEAT DAY)
  "1792756076", // Pop Pongkool — ภาพจำ
  "1792752288", // Pop Pongkool — มนุษย์เอ๋ย (HUMAN ERROR) [feat. AUTTA]
  "1675566888", // ROOFTOP — คนเราจะแอบรักใครสักคนได้นานแค่ไหน (feat. AUTTA)
  "1573285464", // Room 39 — Restart
  "1573285458", // Room 39 — ความจริง
  "1573281669", // Room 39 — บอกตัวเอง (feat. โป่ง หินเหล็กไฟ)
  "1573285475", // Room 39 — เป็นทุกอย่าง
  "1573285472", // Room 39 — อย่าให้ฉันคิด
  "1437681026", // Safeplanet — คำตอบ
  "1497294188", // SCRUBB — กลัว
  "554571894", // SCRUBB — ใกล้
  "555751316", // SCRUBB — ทุกอย่าง
  "1861520774", // SERIOUS BACON — พี่ๆ ตัดแว่นให้หน่อย
  "1861520926", // SERIOUS BACON — ไม่อยากฟัง
  "1861524395", // SERIOUS BACON — วังวน(BOXX FROM HOME)
  "1676428911", // Sqweez Animal — คำบางคำ
  "1685018962", // Stamp — แอบดี
  "1677996778", // The Parkinson — แค่นี้...พอ
  "1675569392", // The Parkinson — ไปเถอะ
  "1829884169", // THE TOYS & F.HERO — นอนได้แล้ว (Sleep Now)
  "1829232106", // THE TOYS — 4:00
  "1829232234", // THE TOYS — Stars
  "1829749548", // THE TOYS — TOY
  "1830150038", // THE TOYS — ก่อนฤดูฝน
  "1829232229", // THE TOYS — พูดไม่ออก
  "1829232231", // THE TOYS — ลาลาลอย (100%)
  "1829271370", // THE TOYS — ไวน์ลดา (blurblur)
  "1792748927", // Three Man Down & Tilly Birds — ความคิดถึงที่ฉันได้เคยส่งไปในคืนที่ฝนโปรยลงมา
  "1792752621", // Three Man Down — ถ้าเธอรักฉันจริง
  "1792752632", // Three Man Down — ฝนตกไหม
  "1792762838", // Three Man Down — ฝันถึงแฟนเก่า
  "1792753379", // Three Man Down — เลือกคนที่เขารักเรา
  "1792753544", // Tilly Birds — คิด(แต่ไม่)ถึง (Same Page?)
  "1535646644", // URBOYTJ — กอดได้ไหม
  "1535646638", // URBOYTJ — ช่วยไม่ได้
  "1535646483", // URBOYTJ — อยู่ก่อน (feat. Oat Pramote)
  "1675600737", // Wan Thanakrit — เดคิสุงิ
  "1515272340", // WANYAi — เงา
  "1457836161", // WANYAi — เจ็บจนพอ
  "1473465780", // WANYAi — ไปได้ดี
  "1465260543", // WANYAi — ลืมไป (feat. ปู่จ๋าน ลองไมค์)
  "1482267194", // WANYAi — หัวหิน
  "1831445836", // Whal & Dolph — ใจสลาย (JAI 0)
  "1830974031", // Whal & Dolph — ไม่รู้ทำไม (Skyfall)
  "1675567897", // Zom Marie — รางวัลปลอบใจ (feat. LAZYLOXY)
  "1675570157", // Zom Marie — โลกอีกใบ (feat. โอ๊ต ปราโมทย์)
];
