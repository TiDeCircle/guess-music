/**
 * Resolved from hits-source.csv by scripts/resolve-csv-playlist.ts.
 *
 * Ids rather than names on purpose: the list names exact recordings, so what
 * plays is what was chosen, and one lookup request fetches the lot.
 *
 * 90 of 100 tracks resolved. The rest are not on the Thai
 * iTunes storefront, or are there under a title too different to match.
 */
export const HITS_TRACK_IDS: readonly string[] = [
  "1803357532", // 2Ectasy — Faded (feat. Z9) [Special Version]
  "1840118550", // 9tokyo — สายไป (feat. BLVCKHEART)
  "1841900014", // ALIE BLACKCOBRA — มือเปล่า (PUT THE GUN DOWN)
  "6763656876", // Ariana Grande — hate that i made you love me
  "6798251269", // ASIA7 — WHO YOU ARE? (ตะโกน!)
  "1792752613", // Atom Chanakan — PLEASE
  "1800427150", // BILLKIN — See You Somewhere (From ซองแดงแต่งผี)
  "1861518340", // BILLKIN & Ink Waruntorn — ลบไม่ได้ช่วยให้ลืม (LIVE SESSION)
  "1785191170", // BLVCKHEART — One Of My Life (feat. K6Y)
  "1814557718", // BLVCKHEART — อยากจะกอดเธอนาน ๆ (HAVE A GOOD TIME)
  "6764229100", // BLVCKHEART — เมื่อไหร่จะมี (มีใจให้กัน)
  "6799371463", // BlvckHeart — ได้โปรดอยู่ตรงนี้ (Upside Down) [feat. PUN]
  "1792752793", // Bodyslam — ความรัก
  "1829905640", // BOWKYLION — ที่คั่นหนังสือ (Sometimes) [feat. NONT TANONT]
  "6784132784", // BOWKYLION — นาฬิกาทราย (sign)
  "1830402788", // BOWKYLION — ลามปาม (circus) [feat. Jeff Satur]
  "1829232507", // BOWKYLION — วิงวอน (ex-change)
  "6767166997", // BUS — ดีใจที่ไม่มีเธอ (happy)
  "6784668766", // BUS — รักมักยาก (Lover Loser)
  "1793466026", // Cocktail — Yours Ever (feat. Q Flure)
  "1871363374", // Etc. & The Parkinson — เมื่อไหร่จะบอก
  "6795878476", // fellow fellow — รักที่พอดี (enough)
  "1819448895", // fellow fellow & PUN — Milky Way
  "6762747698", // FREEHAND — เมื่อถูกค้นพบ (Finally She Found.)
  "1880021410", // GAVIN:D — ได้แค่เดินมาส่ง (The Last Walk) [feat. BLVCKHEART]
  "1801462356", // guncharlie — กลับไปใช้ชีวิตแบบเดิม
  "1784292794", // guncharlie — จากกันโดยสมบูรณ์
  "1872668608", // guncharlie — ไม่ได้ลืมแค่ไม่ได้เจอ (Flashback)
  "1793000560", // HANGMAN — รักเธอหัวทิ่มบ่อ
  "1861524534", // Ink Waruntorn — สักวันฉันจะหายดี
  "6801558655", // Ink Waruntorn — ผลข้างเคียง (Love Effects) [feat. BILLKIN]
  "6764785899", // IRONBOY — Baddie (feat. Justmine JMNK)
  "1822527868", // JayQ — ฝากไว้ให้ Kiss (feat. BLVCKHEART)
  "1850899424", // Jeff Satur — ของขวัญปีใหม่ (Golden Night)
  "6804046964", // JENNIE — HEAVEN
  "6793277028", // JENNIE — Less than a Lover
  "1819420061", // JIGSAW STORY — จักรวาลไหน (feat. MONICA)
  "1836324804", // Joey Phuwasit — Move On แบบใด
  "1793073611", // KLEAR — คำยินดี
  "1793167384", // KLEAR — ถามเพื่ออะไร
  "1803046221", // LITTLE JOHN — ที่ผ่านมาขอบใจจริงๆ
  "1793078707", // Lomosonic — ขอ (WARM EYES)
  "1792750384", // Loso — คืนจันทร์
  "1792755247", // Loso — อะไรก็ยอม
  "1792748152", // Loso — ไม่คิดนอกใจ
  "1862841417", // LUMMUN — ใจบาง Remix
  "1870748665", // Maiyarap — RAIN ZONE (feat. Z9)
  "1738257931", // Malcolm Todd — Earrings
  "1675583920", // Mild — ซาโยนาระ
  "6787021897", // Mirrr — ขึ้นใจ (3am call) [feat. BLVCKHEART]
  "1066766950", // Musketeers — ความทรงจำ
  "6773206872", // Palmy — หลุมอากาศ
  "1807341072", // Palmy — ห้องสี่มุมซ้าย
  "1219179091", // Polycat — เวลาเธอยิ้ม
  "1792747349", // Pop Pongkool — สลักจิต (feat. ดา เอ็นโดรฟิน)
  "1445949267", // Post Malone & Swae Lee — Sunflower (Spider-Man: Into the Spider-Verse)
  "6776809226", // PROXIE — ขี้แง (Boys Don't Cry)
  "1748093799", // PUN — DAY ONE
  "1801128046", // PUN — Living Death
  "1825565565", // PUN — Perfect (feat. 1MILL)
  "6771737104", // PUN — ขอแค่นี้ (Forever n ever)
  "1767346217", // PUN — ที่เดิม
  "1891261032", // PUN — รักให้เธอได้รู้ (Proof.)
  "1803381114", // PURPEECH — กลัวว่าฉันจะไม่เสียใจ (Fear)
  "6764822165", // PURPEECH — ไม่มีวันไหนที่ไม่คิดถึง (starlost.)
  "1860003749", // SARAN — กลัวความเสียใจ (feat. Pearpilincys)
  "1791465735", // SARAN — รออยู่อย่างนั้น (feat. Z9 & SIMON)
  "1840080739", // SEA. — สมดุลรัก (Balance) [feat. Sexski]
  "6798547668", // SEA. & SARAN — อารมณ์สีเทา
  "1814275032", // Season Five — อยากอินเพลงรัก (feat. No One Else)
  "1846309287", // Season Five — เลือกเองกับมือ (Bad Choices)
  "6797921264", // SERIOUS BACON & PP KRIT — คนขี้น้อยใจ (My Fault)
  "1233611352", // SPF — 9 นาฬิกา
  "1794796742", // The Ge — I love you a latte
  "1829271423", // THE TOYS & NONT TANONT — ดอกไม้ที่รอฝน (spring)
  "1805001763", // Three Man Down — รักใครไม่ไหว
  "1792753683", // Three Man Down — เพลงรัก
  "1839462294", // Timethai — พูดเหมือนจำ ทำเหมือนเดิม (SAME AGAIN) [feat. JOEY PHUWASIT] [Live Session]
  "1833162356", // Violette Wautier — wanna be yours (อยากให้เธอรัก)
  "1840357831", // WANYAi — ดาวตก (Wish) [feat. Z9]
  "6787027827", // WILLIAM JAKRAPATR — จำได้ว่าลืม (Flashback)
  "1822223781", // Yes'sir days — ฝากให้เขารัก
  "1844797576", // YOUNGOHM — Benz ดำ
  "1844797797", // YOUNGOHM — Sunset In Pattaya
  "1844797799", // YOUNGOHM — นครดารา
  "1813811665", // YOUNGOHM — เจิดจรัส
  "1844797800", // YOUNGOHM — ใจฉันตามเธอไป
  "1803340603", // Z9 — บทสรุปสุดท้าย
  "6800231939", // Z9 — ไม่รักดีกว่า
  "6771695931", // อูโน่ หลาวทอง — ย้าย่ายะ
];
