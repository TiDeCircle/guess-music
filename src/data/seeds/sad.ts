/**
 * Resolved from sad-source.csv by scripts/resolve-csv-playlist.ts.
 *
 * Ids rather than names on purpose: the list names exact recordings, so what
 * plays is what was chosen, and one lookup request fetches the lot.
 *
 * 76 of 84 tracks resolved. The rest are not on the Thai
 * iTunes storefront, or are there under a title too different to match.
 */
export const SAD_TRACK_IDS: readonly string[] = [
  "1754330618", // Ake Surachet — พระจันทร์ยิ้ม
  "1572943016", // Alyn Wee — หัวใจเจ้าเอย​ (Not Again)
  "1648087340", // Anatomy Rabbit — ขอให้โลกนี้ใจดีกับเธอ
  "1648088672", // Anatomy Rabbit — แอบหวัง
  "1793035833", // ASIA7 — นักแสวงโชค
  "1792752599", // Atom Chanakan — ทางของฝุ่น (Dust)
  "1792753146", // Atom Chanakan — ปล่อยปาก
  "1663457508", // AYLA's — จากตรงนี้ที่(เคย)สวยงาม
  "1595160344", // AYLA's — เพลงที่เธอ(เคย)ชอบฟัง [Decibel]
  "1595138594", // AYLA's — วิ่งหนีออกไปด้วยความไวสองมัค
  "1736164734", // AYLA's — เอาความเสียใจมาไว้ที่ฉัน (Vasopressin)
  "1684920034", // Bedroom Audio — รักมือสอง
  "1687194155", // Better Weather — อย่าเสียใจคนเดียว
  "1792749659", // Big Ass — ลมเปลี่ยนทิศ
  "1020803871", // Big Ass — หลอกได้หลอกไป
  "1744342419", // BLVCKHEART — WHAT IS LUV (feat. 2T FLOW & K6Y)
  "1604152220", // BLVCKHEART — ฟีโรโมน (feat. 2tflow)
  "1792752793", // Bodyslam — ความรัก
  "1793084948", // BOOM SAHARAT — ฉันมันเป็นคนแบบนี้
  "1829905640", // BOWKYLION — ที่คั่นหนังสือ (Sometimes) [feat. NONT TANONT]
  "1792749205", // Cocktail — ต่างคน
  "1792748254", // Cocktail — เธอทำให้ฉันเสียใจ
  "1792752039", // Cocktail — โปรดเถิดรัก
  "1674759767", // CORNBOI — ก่อนที่... (Moon)
  "1616122080", // Dept — คงต้องบอกลาแล้ว
  "1533771050", // Dept — ฤดู
  "1754153274", // Dr.Fuu — ใจเหลือเหลือ
  "1601152199", // FREEHAND — รสหวาน
  "1784292794", // guncharlie — จากกันโดยสมบูรณ์
  "1872668608", // guncharlie — ไม่ได้ลืมแค่ไม่ได้เจอ (Flashback)
  "1675581067", // Helmetheads — Unfriend
  "1871673725", // Jaonaay — โกงรักไม่ได้ (From "ละครฉลาดเกมส์โกง")
  "1644859514", // Jeff Satur — ลืมไปแล้วว่าลืมยังไง (Fade)
  "1836324804", // Joey Phuwasit — Move On แบบใด
  "1847802066", // Kong Huayrai — ดอกกระเจียวบาน
  "1829219124", // LANDOKMAI — Tsuki (พระจันทร์)
  "1793078707", // Lomosonic — ขอ (WARM EYES)
  "1725101815", // MEAN Band — เราไม่รักกันตอนไหน (Apart)
  "1829228418", // Mirrr — ดอกไม้ไฟ (Firework)
  "1684918542", // Mirrr — นิโคติน
  "1066766950", // Musketeers — ความทรงจำ
  "1066211461", // Musketeers — งานเต้นรำ
  "1861529942", // ONEONE — ฉันจะมีความสุขให้มากกว่าเธอ (Happier) [LIVE SESSION]
  "1871350102", // Plantpot — ให้ฉันเป็นวันที่ดีของเธอ (Acoustic)
  "1793647548", // Pop Pongkool & Wonderframe — Undo
  "1610548268", // PURE KANIN — วิวาห์
  "1803381114", // PURPEECH — กลัวว่าฉันจะไม่เสียใจ (Fear)
  "1580930419", // PURPEECH — ทิ้งไว้อย่างพอใจ
  "1656555882", // PURPEECH — บังเอิญพบทานตะวัน (.png)
  "1600186584", // PURPEECH — ภาพถ่ายวันวาน (1920)
  "1567390364", // PURPEECH — หากจะเพียงขอ
  "1462851266", // Safeplanet — ข้างกาย
  "1846309287", // Season Five — เลือกเองกับมือ (Bad Choices)
  "1681273049", // SHERRY — เธอไม่ได้สอนให้ฉันอยู่คนเดียว
  "1793130459", // Silly Fools — ผิดที่ไว้ใจ
  "1219178754", // Somkiat — ขอวอน (Version 1)
  "1233611352", // SPF — 9 นาฬิกา
  "1676565043", // T_047 — ฤดูใหม่
  "1651138741", // Tattoo Colour — Luv @1 (Optional Lyrics)
  "1221366849", // Tattoo Colour — เจ็บแล้วไม่จำ
  "1652315772", // Tattoo Colour — อย่าร้องอายเค้า
  "1653663517", // tinn — เศษ (Remain) [feat. Earth Patravee]
  "1542923553", // Uncle Ben — อย่าเป็นฉันเลย Tyrion
  "1608489747", // Yented — Her (feat. ARARYOZI & Chocolate - t)
  "1792998842", // Yes'sir days — เจ็บไปรักไป
  "1822223781", // Yes'sir days — ฝากให้เขารัก
  "1549502987", // YEW — Moon
  "1549502993", // YEW — Summertime (feat. Landokmai)
  "1488745048", // YEW — จะมอบความรัก
  "1704128108", // YEW — ปล่อยดาว
  "1633812118", // YEW — ลบเลือน
  "1658238754", // YEW — หมวกเมฆสีรุ้ง
  "1844797800", // YOUNGOHM — ใจฉันตามเธอไป
  "1230879786", // Zeal — เตลิด
  "1569221829", // Zweed n' Roll — ช่วงเวลา
  "1650930318", // เรนิษรา — ผู้ถูกเลือกให้ผิดหวัง (ดอกไม้ฤดูหนาว)
];
