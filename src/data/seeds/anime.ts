/**
 * Anime openings and endings, by iTunes track id and the show each is from.
 *
 * Drafted by scripts/draft-anime-playlist.ts out of AnimeThemes.moe and the
 * iTunes catalogue, then cut by hand. src/data/seeds/anime-source.csv holds
 * everything that was considered, including the rows that found no match.
 *
 * Two hand-made decisions are baked in here. Seasons, films and arcs are
 * folded onto one name per show — AnimeThemes lists six separate entries for
 * Kimetsu no Yaiba, and a grid offering two of them would have two right
 * answers. And the shows themselves are picked for a room in Thailand rather
 * than for coverage: a show nobody watched is a round nobody can win.
 *
 * The names are romaji, which is what AnimeThemes provides and what the review
 * read.
 */
export const ANIME_TRACKS: ReadonlyArray<{ id: string; series: string }> = [
  { id: "1538275662", series: "3-gatsu no Lion" }, // Orion — Kenshi Yonezu
  { id: "845152930", series: "Angel Beats!" }, // My Soul, Your Beats! (Gldemo Ver.) — LiSA
  { id: "1537434797", series: "Ao no Exorcist" }, // Core Pride — UVERworld
  { id: "1731959374", series: "Ao no Exorcist" }, // Eye's Sentry — UVERworld
  { id: "1768218701", series: "Ao no Hako" }, // Same Blue — Official HIGE DANdism
  { id: "1769803970", series: "Ao no Hako" }, // Teenage Blue — Eve
  { id: "1771805945", series: "Ao no Miburo" }, // AO — SPYAIR
  { id: "1535518053", series: "BLEACH" }, // Last Moment — SPYAIR
  { id: "1536143519", series: "BLEACH" }, // Repray — Aimer
  { id: "1536394894", series: "BLEACH" }, // After Dark — Asian Kung-Fu Generation
  { id: "1537412888", series: "BLEACH" }, // D-tecnoLife — UVERworld
  { id: "1594292560", series: "BLEACH" }, // Rapport — Tatsuya Kitani
  { id: "1648249282", series: "BLEACH" }, // Scar — Tatsuya Kitani
  { id: "1537923439", series: "Banana Fish" }, // Prayer X — King Gnu
  { id: "1536364102", series: "Boku dake ga Inai Machi" }, // Re:Re: — Asian Kung-Fu Generation
  { id: "1410776543", series: "Boku no Hero Academia" }, // Odd Future — UVERworld
  { id: "1536466358", series: "Boku no Hero Academia" }, // Starmarker — KANA-BOON
  { id: "1537458310", series: "Boku no Hero Academia" }, // Peace Sign — Kenshi Yonezu
  { id: "1537899080", series: "Boku no Hero Academia" }, // Datte Atashino Hero — LiSA
  { id: "1573696011", series: "Boku no Hero Academia" }, // Merry-Go-Round — MAN WITH A MISSION
  { id: "1577315463", series: "Boku no Hero Academia" }, // Empathy — Asian Kung-Fu Generation
  { id: "1659504435", series: "Boku no Hero Academia" }, // Bokurano — Eve
  { id: "1754899924", series: "Boku no Hero Academia" }, // Curtain Call — Yuuri
  { id: "1536458265", series: "Boruto" }, // Diver — KANA-BOON
  { id: "1536496604", series: "Boruto" }, // Baton road — KANA-BOON
  { id: "1650726824", series: "Boruto" }, // Kirarirari — KANA-BOON
  { id: "1647132944", series: "Chainsaw Man" }, // CHAINSAW BLOOD — Vaundy
  { id: "1648272180", series: "Chainsaw Man" }, // KICK BACK — Kenshi Yonezu
  { id: "1652643092", series: "Chainsaw Man" }, // Deep down — Aimer
  { id: "1656433548", series: "Chainsaw Man" }, // FightSong — Eve
  { id: "1837658529", series: "Chainsaw Man" }, // IRIS OUT — Kenshi Yonezu
  { id: "1840081736", series: "Chainsaw Man" }, // JANE DOE — Kenshi Yonezu
  { id: "1770905295", series: "Chi.: Chikyuu no Undou ni Tsuite" }, // Aporia — Yorushika
  { id: "1536479348", series: "Code Geass" }, // Colors — FLOW
  { id: "1536479350", series: "Code Geass" }, // World End — FLOW
  { id: "1537767488", series: "D.Gray-man" }, // Gekidou — UVERworld
  { id: "1771603031", series: "Dandadan" }, // Otonoke — Creepy Nuts
  { id: "1467728599", series: "Dororo" }, // Yamiyo — Eve
  { id: "1538161054", series: "Dororo" }, // Dororo — Asian Kung-Fu Generation
  { id: "1821760203", series: "Dr. Stone" }, // SUPERNOVA — KANA-BOON
  { id: "1887483433", series: "Dr. Stone" }, // Skins — Asian Kung-Fu Generation
  { id: "1538160488", series: "Durarara!!" }, // Steppin' Out — FLOW
  { id: "1471459432", series: "Enen no Shouboutai" }, // Inferno — Mrs. GREEN APPLE
  { id: "1538262061", series: "Enen no Shouboutai" }, // SPARK-AGAIN — Aimer
  { id: "1539133583", series: "Enen no Shouboutai" }, // Torch of Liberty — KANA-BOON
  { id: "1536479135", series: "Eureka Seven" }, // Days — FLOW
  { id: "1440747562", series: "Evangelion" }, // Beautiful World — Hikaru Utada
  { id: "1445016168", series: "Evangelion" }, // Sakura Nagashi — Hikaru Utada
  { id: "1542953977", series: "Evangelion" }, // One Last Kiss — Hikaru Utada
  { id: "1537785552", series: "Fate/Zero" }, // Oath Sign — LiSA
  { id: "1535802270", series: "Fate/stay night" }, // THIS ILLUSION — LiSA
  { id: "1536130474", series: "Fate/stay night" }, // Brave Shine — Aimer
  { id: "1538260051", series: "Fate/stay night" }, // Hana No Uta — Aimer
  { id: "1538894761", series: "Fate/stay night" }, // I beg you — Aimer
  { id: "1536394888", series: "Fullmetal Alchemist" }, // Rewrite — Asian Kung-Fu Generation
  { id: "1566508411", series: "Fumetsu no Anata e" }, // PINK BLOOD — Hikaru Utada
  { id: "1539150967", series: "Gintama" }, // Sakura Mitsutsuki — SPYAIR
  { id: "1544380977", series: "Gintama" }, // I Wanna Be... — SPYAIR
  { id: "1689537512", series: "Gintama" }, // Samurai Heart(Some Like It Hot!!) - New Version - — SPYAIR
  { id: "1769377262", series: "Gintama" }, // Genjou Destruction - From THE FIRST TAKE — SPYAIR
  { id: "1537756981", series: "Golden Kamuy" }, // Winding Road — MAN WITH A MISSION
  { id: "859822147", series: "Haikyuu!!" }, // Imagination — SPYAIR
  { id: "1531754388", series: "Haikyuu!!" }, // One Day — SPYAIR
  { id: "1535541218", series: "Haikyuu!!" }, // I'm a Believer — SPYAIR
  { id: "1728595882", series: "Haikyuu!!" }, // Orange — SPYAIR
  { id: "1532051230", series: "Happy Sugar Life" }, // SWEET HURT - plus unknown — ReoNa
  { id: "1823815962", series: "Hikaru ga Shinda Natsu" }, // saikai — Vaundy
  { id: "1866806793", series: "Jigokuraku" }, // Kasuka na Hana (OP Theme to Hell's Paradise: Jigokuraku Season 2) [feat. BABYMETAL] — Tatsuya Kitani
  { id: "1543126844", series: "Josee to Tora to Sakana-tachi" }, // Ao No Waltz — Eve
  { id: "1542180247", series: "Jujutsu Kaisen" }, // Kaikai Kitan — Eve
  { id: "1597279110", series: "Jujutsu Kaisen" }, // Ichizu — King Gnu
  { id: "1600395740", series: "Jujutsu Kaisen" }, // Sakayume — King Gnu
  { id: "1702823583", series: "Jujutsu Kaisen" }, // SPECIALZ — King Gnu
  { id: "1860538548", series: "Jujutsu Kaisen" }, // AIZO — King Gnu
  { id: "1538160778", series: "Karakuri Circus" }, // Haguruma — KANA-BOON
  { id: "1470204067", series: "Kengan Ashura" }, // King & Ashley — MY FIRST STORY
  { id: "1789465887", series: "Kidou Senshi Gundam: GQuuuuuuX" }, // Plazma — Kenshi Yonezu
  { id: "1531847485", series: "Kimetsu no Yaiba" }, // homura — LiSA
  { id: "1538286723", series: "Kimetsu no Yaiba" }, // Gurenge — LiSA
  { id: "1589411366", series: "Kimetsu no Yaiba" }, // Akeboshi — LiSA
  { id: "1592056444", series: "Kimetsu no Yaiba" }, // Shirogane — LiSA
  { id: "1594814709", series: "Kimetsu no Yaiba" }, // Asa ga kuru — Aimer
  { id: "1678949889", series: "Kimetsu no Yaiba" }, // Kizuna No Kiseki — MAN WITH A MISSION
  { id: "1678949894", series: "Kimetsu no Yaiba" }, // Koi Kogare — milet
  { id: "1742203699", series: "Kimetsu no Yaiba" }, // MUGEN — MY FIRST STORY
  { id: "1434005934", series: "Kimi no Na wa." }, // Nandemonaiya - Movie Ver. — RADWIMPS
  { id: "1538261262", series: "Koi wa Ameagari no You ni" }, // Ref:rain — Aimer
  { id: "6794271993", series: "Koukaku Kidoutai" }, // GO GHOST — King Gnu
  { id: "1537269176", series: "Koutetsujou no Kabaneri" }, // Ninelie (with chelly) — Aimer
  { id: "1804230388", series: "Kusuriya no Hitorigoto" }, // KUSUSHIKI — Mrs. GREEN APPLE
  { id: "1537461567", series: "Log Horizon" }, // Database (feat. TAKUMA) — MAN WITH A MISSION
  { id: "1537788873", series: "Mahouka Koukou no Rettousei" }, // Rising Hope — LiSA
  { id: "1737736349", series: "Mahouka Koukou no Rettousei" }, // Shouted Serenade — LiSA
  { id: "1720332181", series: "Mashle" }, // Bling-Bang-Bang-Born — Creepy Nuts
  { id: "1790607807", series: "Medalist" }, // BOW AND ARROW — Kenshi Yonezu
  { id: "1535622395", series: "Mobile Suit Gundam: Iron-Blooded Orphans" }, // Rage of Dust — SPYAIR
  { id: "1538166939", series: "Mobile Suit Gundam: Iron-Blooded Orphans" }, // Fighter — KANA-BOON
  { id: "1538279150", series: "Mobile Suit Gundam: Iron-Blooded Orphans" }, // Raise your flag — MAN WITH A MISSION
  { id: "1752838890", series: "Monogatari Series" }, // UNDEAD — YOASOBI
  { id: "1335643588", series: "Nanatsu no Taizai" }, // Howling — FLOW
  { id: "1537779521", series: "Nanatsu no Taizai" }, // Rob the Frontier — UVERworld
  { id: "1538279154", series: "Nanatsu no Taizai" }, // Seven Deadly Sins — MAN WITH A MISSION
  { id: "1568292079", series: "Nanatsu no Taizai" }, // NAMELY — UVERworld
  { id: "1781634087", series: "Nanatsu no Taizai" }, // MMH — UVERworld
  { id: "1536394884", series: "Naruto" }, // Haruka Kanata — Asian Kung-Fu Generation
  { id: "1536460672", series: "Naruto" }, // Nijinosora — FLOW
  { id: "1536461315", series: "Naruto" }, // Blood Circulator — Asian Kung-Fu Generation
  { id: "1536479134", series: "Naruto" }, // Go!!! — FLOW
  { id: "1536479347", series: "Naruto" }, // Re:member — FLOW
  { id: "1536479352", series: "Naruto" }, // Sign — FLOW
  { id: "1538157315", series: "Naruto" }, // Silhouette — KANA-BOON
  { id: "1538258967", series: "Natsume Yuujinchou" }, // Akane Sasu — Aimer
  { id: "1658686229", series: "NieR:Automata" }, // escalate — Aimer
  { id: "1753030850", series: "NieR:Automata" }, // Black Box — LiSA
  { id: "1537791346", series: "Nisekoi" }, // Rally Go Round — LiSA
  { id: "1753029825", series: "Ookami to Koushinryou" }, // Sign — Aimer
  { id: "1783371197", series: "Ore dake Level Up na Ken" }, // ReawakeR (feat. Felix of Stray Kids) — LiSA
  { id: "1588362375", series: "Ousama Ranking" }, // BOY — King Gnu
  { id: "1601419197", series: "Ousama Ranking" }, // Flare — milet
  { id: "1694667509", series: "Ousama Ranking" }, // atemonaku — Aimer
  { id: "1545892487", series: "SK∞" }, // Infinity — Yuuri
  { id: "1793301774", series: "Sakamoto Days" }, // Somebody help us — Vaundy
  { id: "1721508564", series: "Shangri-La Frontier" }, // Gajumaru Heaven in the Rain — ReoNa
  { id: "1770716765", series: "Shangri-La Frontier" }, // QUEEN — LiSA
  { id: "1752615606", series: "Shoushimin Series" }, // Sweet Memory — Eve
  { id: "1707001466", series: "Sousou no Frieren" }, // Yuusha — YOASOBI
  { id: "1708333825", series: "Sousou no Frieren" }, // Anytime Anywhere — milet
  { id: "1726309586", series: "Sousou no Frieren" }, // bliss — milet
  { id: "1863631485", series: "Sousou no Frieren" }, // The Story of Us — milet
  { id: "1867354081", series: "Sousou no Frieren" }, // lulu. — Mrs. GREEN APPLE
  { id: "1878095294", series: "Sousou no Frieren" }, // Trace — milet
  { id: "1616586639", series: "Spy x Family" }, // Mixed Nuts — Official HIGE DANdism
  { id: "1708177336", series: "Spy x Family" }, // Kura Kura — Ado
  { id: "1708391001", series: "Spy x Family" }, // Todome no ichigeki (feat. Cory Wong) — Vaundy
  { id: "1717747959", series: "Spy x Family" }, // SOULSOUP — Official HIGE DANdism
  { id: "1651284057", series: "Suzume no Tojimari" }, // Kanata Haluka — RADWIMPS
  { id: "1651284059", series: "Suzume no Tojimari" }, // Suzume (feat. Toaka) — RADWIMPS
  { id: "1529543503", series: "Sword Art Online" }, // Unlasting — LiSA
  { id: "1532050865", series: "Sword Art Online" }, // ANIMA — ReoNa
  { id: "1537785962", series: "Sword Art Online" }, // Crossing Field — LiSA
  { id: "1537789954", series: "Sword Art Online" }, // Shirushi — LiSA
  { id: "1537789955", series: "Sword Art Online" }, // No More Time Machine — LiSA
  { id: "1537798030", series: "Sword Art Online" }, // Catch the Moment — LiSA
  { id: "1537901887", series: "Sword Art Online" }, // ADAMAS — LiSA
  { id: "1538286825", series: "Sword Art Online" }, // forget-me-not — ReoNa
  { id: "1543390524", series: "Sword Art Online" }, // Niji No Kanatani - From THE FIRST TAKE — ReoNa
  { id: "1588049004", series: "Sword Art Online" }, // Yu-Ke — LiSA
  { id: "1770236402", series: "Sword Art Online" }, // GG — ReoNa
  { id: "1563683060", series: "Tokyo Revengers" }, // Cry Baby — Official HIGE DANdism
  { id: "1660219924", series: "Tokyo Revengers" }, // White Noise — Official HIGE DANdism
  { id: "1538261364", series: "Vinland Saga" }, // Torches — Aimer
  { id: "1538265329", series: "Vinland Saga" }, // Drown — milet
  { id: "1538283596", series: "Vinland Saga" }, // Dark Crow — MAN WITH A MISSION
  { id: "1813364855", series: "Witch Watch" }, // Watch me! — YOASOBI
  { id: "1538276685", series: "Yakusoku no Neverland" }, // Touch off — UVERworld
  { id: "1678037141", series: "Yamada-kun to Lv999 no Koi wo Suru" }, // Gradation (feat. Yuho Kitazawa) — KANA-BOON
  { id: "1538108923", series: "Yofukashi no Uta" }, // Yofukashino Uta — Creepy Nuts
  { id: "1631125195", series: "Yofukashi no Uta" }, // Daten — Creepy Nuts
  { id: "1824077739", series: "Yofukashi no Uta" }, // Nemure — Creepy Nuts
  { id: "1824084891", series: "Yofukashi no Uta" }, // Mirage — Creepy Nuts
  { id: "1694665954", series: "Zom 100" }, // Song of the Dead — KANA-BOON
  { id: "1679278167", series: "[Oshi no Ko]" }, // Idol — YOASOBI
];

export const ANIME_TRACK_IDS: readonly string[] = ANIME_TRACKS.map((t) => t.id);

export const ANIME_SERIES: Readonly<Record<string, string>> = Object.fromEntries(
  ANIME_TRACKS.map((t) => [t.id, t.series]),
);
