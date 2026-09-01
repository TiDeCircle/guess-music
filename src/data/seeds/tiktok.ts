/**
 * Resolved from tiktok-source.csv by scripts/resolve-csv-playlist.ts.
 *
 * Ids rather than names on purpose: the list names exact recordings, so what
 * plays is what was chosen, and one lookup request fetches the lot.
 *
 * 204 of 241 tracks resolved. The rest are not on the Thai
 * iTunes storefront, or are there under a title too different to match.
 */
export const TIKTOK_TRACK_IDS: readonly string[] = [
  "1762082207", // ¥$, Kanye West & Ty Dolla $ign — CARNIVAL (feat. Rich The Kid, Playboi Carti)
  "1761882830", // ¥$, Kanye West & Ty Dolla $ign — RIVER
  "1559066401", // 24kGoldn — Mood (feat. iann dior)
  "1726992960", // 4batz — Act ii: Date @ 8 (UNIIQU3 Remix) [Mixed]
  "1760428041", // Addison Rae — Diet Pepsi
  "1704375802", // Aden Foyer — The Ballet Girl
  "1732888751", // Alanna Patricio — Moonstruck
  "1793663645", // Alex Warren — Ordinary
  "1873117823", // Allison Amber Hage — Captured My Heart
  "1606235067", // ALTÉGO, Britney Spears & Ginuwine — Toxic Pony
  "1535188321", // Amaarae — SAD GIRLZ LUV MONEY (feat. Moliy)
  "663098056", // Arctic Monkeys — Why'd You Only Call Me When You're High?
  "1800580284", // Ariana Grande — dandelion
  "1736426869", // Artemas — i like the way you kiss me
  "1247704673", // Beach House — Space Song
  "1627054792", // Beach Weather — Sex, Drugs, Etc.
  "6794406933", // Ben Jarvis — SPORTS CAR
  "1486925302", // BENEE — Supalonely (feat. Gus Dapperton)
  "1724488124", // Benson Boone — Beautiful Things
  "1739659142", // Billie Eilish — BIRDS OF A FEATHER
  "1696819855", // Billie Eilish — What Was I Made For? (From The Motion Picture "Barbie")
  "1739659144", // Billie Eilish — WILDFLOWER
  "1824672652", // BLACKPINK — JUMP
  "1440849208", // BØRNS — Electric Love
  "6788533016", // Brett Radachowsky — Fly Away
  "1880928160", // Brie Leigh — Calypso
  "6782248475", // Brie Leigh — Hidden Love
  "1476047741", // Bruno Major — Nothing
  "1866732797", // Bruno Mars — Risk It All
  "1868862384", // BTS — SWIM
  "1620344823", // Cafuné — Tek It
  "1705910871", // cassö & RAYE — Prada (feat. D-Block Europe)
  "1737497080", // Chappell Roan — Good Luck, Babe!
  "1831372120", // Chappell Roan — The Subway
  "1760422257", // Charli xcx & Billie Eilish — Guess featuring Billie Eilish
  "1739080645", // Charli xcx — Apple
  "1630451413", // Charlie Puth & Jung Kook — Left and Right
  "1605257577", // Charlie Puth — Light Switch
  "1659697888", // ChillHop — Mood (Instrumental)
  "1217977755", // Cigarettes After Sex — Apocalypse
  "1585195519", // CKay — love nwantiti (feat. Axel & Dj Yo!) [Remix]
  "1742301428", // Clairo — Juna
  "1210094302", // Clean Bandit — Symphony (feat. Zara Larsson)
  "1122782283", // Coldplay — Yellow
  "1508028869", // DaBaby — ROCKSTAR (feat. Roddy Ricch)
  "1749249442", // Dasha — Austin (Boots Stop Workin') [Stripped]
  "1796004433", // David Kushner — Daylight
  "1628622301", // Disco Lines — Baby Girl
  "1632448108", // Djo — End of Beginning
  "1801820501", // Doechii — Anxiety
  "1796274190", // Doechii — DENIAL IS A RIVER
  "1691821835", // Doechii — What It Is (Solo Version)
  "1707937781", // Doja Cat — Agora Hills
  "1739450800", // Doja Cat — Paint The Town Red
  "1577636695", // Doja Cat — Woman
  "1438243880", // Dominic Fike — Babydoll
  "1718578287", // Dove Cameron — Boyfriend
  "1653012565", // Drake & 21 Savage — Rich Flex
  "1639317828", // Eliza Rose & Interplanetary Criminal — B.O.T.A. (Baddest Of Them All)
  "1440559604", // Ellie Goulding — Lights (Single Version)
  "1863949250", // Elysian Jane — new state of healing
  "1893340067", // Emmalyne — History
  "1736007539", // Flo Milli — Never Lose Me (feat. SZA & Cardi B)
  "1770187510", // Gigi Perez — Sailor Song
  "1508562516", // Glass Animals — Heat Waves
  "1505434799", // Gracie Abrams — I miss you, I’m sorry
  "1775581103", // Gracie Abrams — That’s So True
  "1765520596", // Hanumankind & Kalmi — Big Dawgs
  "1615585008", // Harry Styles — As It Was
  "6767306751", // HAVEN. & Kaitlin Aragon — I Run (Ely Oaks Remix)
  "6791332736", // Henry Thompson — All My Fault
  "1476088817", // Henry Thompson — Lost
  "1617969731", // Hotel Ugly — Shut up My Moms Calling
  "1733904814", // Hozier — Too Sweet
  "6788104421", // Hunter Daily — Tough Act To Follow
  "1834414770", // HUNTR/X, Felicity Kyle Napuli, Venisse Siy, Maronne Cruz & KPop Demon Hunters Cast — Golden (Tagalog Version)
  "1734500896", // ILLIT — Magnetic
  "1748187116", // Imagine Dragons — Enemy (from the series Arcane League of Legends) [feat. JID]
  "1600773036", // J. Cole — No Role Modelz
  "1622624618", // Jack Harlow — First Class
  "1715920580", // Jack Harlow — Lovin On Me
  "1046165672", // Jain — Makeba
  "724885760", // Janet Jackson — Someone To Call My Lover
  "6781777850", // Jarrod L. Edge — So We Can Let It Go
  "6787386269", // Jasmine Rhey — the village is watching
  "1745357781", // Jaxomy & Agatino Romero — Pedro (W&W Remix)
  "1683173591", // Jengi — Bel Mercy
  "1800281048", // JENNIE — like JENNIE
  "1603923360", // JID — Surround Sound (feat. 21 Savage & Baby Tate)
  "1751773093", // Jimin — Who
  "1607186827", // JNR CHOI & Sam Tompkins — TO THE MOON
  "6763676237", // Joe Stephens — Brain Freeze
  "1776741889", // Joji — Glimpse of Us
  "1888531832", // Jude York — Camilla
  "1697147752", // Jung Kook & Latto — Seven
  "1850487672", // Justė, Jaxstyle & Jon — Turn The Lights Off
  "1825994649", // Justin Bieber — DAISIES
  "1645425554", // JVKE — golden hour
  "1582691808", // JVKE — this is what falling in love feels like
  "1665312291", // Kali Uchis — Moonlight
  "1675560578", // Kate Bush — Running Up That Hill (A Deal With God) [2018 Remaster]
  "1811464273", // KATSEYE — Gabriela
  "1753359801", // KATSEYE — Touch
  "1781270323", // Kendrick Lamar — luther
  "1781353929", // Kendrick Lamar — Not Like Us
  "1806672802", // Kevynn Hudsonn — Her Number
  "6792485034", // KXNG LVX — Montagem Spirits (Sped Up)
  "1481092680", // Labrinth — Forever (From "Euphoria: Season 1" Soundtrack)
  "1762656732", // Lady Gaga & Bruno Mars — Die With A Smile
  "1793869710", // Lady Gaga — Abracadabra
  "1688315813", // Lana Del Rey — Say Yes To Heaven
  "1805189288", // Lay Bankz — Tell Ur Girlfriend (Instrumental)
  "1632051544", // LF SYSTEM — Afraid To Feel (Acoustic)
  "1577414972", // Lil Nas X & Jack Harlow — INDUSTRY BABY
  "1559318719", // Lil Nas X — MONTERO (Call Me By Your Name)
  "1586182264", // Lil Nas X — THATS WHAT I WANT
  "1650201274", // Lil Uzi Vert — Just Wanna Rock
  "1799316831", // LISA — Born Again (feat. Doja Cat & RAYE)
  "1746042186", // Lola Young — Messy
  "6792940567", // LØLØ — pretty little wreck
  "1889283021", // Luchino — My Whole Life
  "296393515", // M.I.A. — Paper Planes
  "1729494488", // Madison Beer — Make You Mine
  "1732802340", // Mark Ambor — Belong Together
  "1752950545", // Mark Ambor — Second Best
  "6786778385", // Maxx Nies — Art
  "1752025863", // Megan Thee Stallion — Mamushi (feat. Yuki Chiba)
  "439618071", // Miguel — Sure Thing
  "1674691586", // Miley Cyrus — Flowers
  "1697335814", // Mitski — My Love Mine All Mine
  "1707416065", // Muni Long — Made For Me
  "1663074502", // New West — Those Eyes
  "1695951897", // NewJeans — Super Shy
  "1638814933", // Nicki Minaj — Super Freaky Girl
  "1638182574", // Nicky Youre & hey daisy — Sunroof (24kGoldn Remix)
  "6763028021", // Ocz — Lost in you (feat. Nynne Hansen)
  "1817609509", // Olivia Dean — Man I Need
  "1817609507", // Olivia Dean — So Easy (To Fall In Love)
  "1621817894", // OneRepublic — I Ain't Worried
  "1873356795", // Or Barak — DOING ALRIGHT
  "1719352728", // Paul Russell — Lil Boo Thang (Galantis Remix)
  "652255045", // Pharrell Williams — Just a Cloud Away
  "1674065037", // PinkPantheress & Ice Spice — Boy's a liar Pt. 2 (Mixed)
  "1806614466", // PinkPantheress — Illegal
  "1571157966", // PinkPantheress — Pain
  "1843595808", // PinkPantheress — Stateside (with Zara Larsson)
  "1628224838", // Post Malone — I Like You (A Happier Song) [feat. Doja Cat]
  "1838737598", // RAYE — WHERE IS MY HUSBAND!
  "1606962620", // Rex Orange County — THE SHADE
  "1746247823", // Rosa Linn — SNAP
  "1773452221", // ROSÉ & Bruno Mars — APT.
  "6764270950", // Ruebin Able — Our Story
  "1744253558", // Sabrina Carpenter — Espresso
  "1677892279", // Sabrina Carpenter — Feather
  "1750307079", // Sabrina Carpenter — Taste
  "1819861167", // Sabrina Carpenter — When Did You Get Hot?
  "1106895974", // SALES — Pope Is a Rockstar
  "1852132998", // Sam Austins — Seasons (club mix)
  "1057802890", // Seafret — Atlantis
  "6776035576", // SIDEPIECE & 95 South — Can I Ride
  "1828457660", // Sierra Levesque — AUTHORITY
  "1786481197", // sombr — back to friends
  "1802084938", // sombr — undressed
  "1581702085", // Stephen Sanchez — Until I Found You
  "6788150545", // Steve Lacy — Bad Habit
  "1786259780", // Suitcase Rebel — Go
  "1574318912", // Surf Curse — Disco
  "1657869393", // SZA — Kill Bill
  "1732348414", // SZA — Saturn
  "1832491295", // TackEm — Tidal
  "1842444457", // Tame Impala — Dracula
  "1706942560", // Tate McRae — greedy
  "1779319634", // Tate McRae — Sports car
  "1742057775", // Taylor Swift — Fortnight (feat. Post Malone)
  "1833328845", // Taylor Swift — Opalite
  "1833328840", // Taylor Swift — The Fate of Ophelia
  "1691699836", // Teddy Swims — Lose Control
  "1591327360", // THE ANXIETY, WILLOW & Tyler Cole — Meet Me At Our Spot
  "1574968888", // The Kid LAROI & Justin Bieber — STAY
  "6763128559", // The Kid LAROI — NIGHTS LIKE THIS
  "1623849957", // The King Khan & BBQ Show — Love You So
  "1363310498", // The Weeknd & Gesaffelstein — I Was Never There
  "1770393194", // The Weeknd & Playboi Carti — Timeless
  "1440872304", // The Weeknd — Die For You
  "6767755171", // Tinashe — Nasty
  "1610741754", // Tom Santa — Rainfall (Praise You)
  "1749616863", // Tommy Richman — MILLION DOLLAR BABY
  "1151481747", // Travis Scott — sdp interlude
  "1623923868", // TV Girl — Blue Hair
  "1717680441", // Tyla, Gunna & Skillibeng — Jump
  "1772394895", // Tyla — BACK to YOU
  "1847669777", // Tyla — CHANEL
  "1699082734", // Tyla — Water
  "1828767309", // Tyler, The Creator — Sugar On My Tongue
  "6786243887", // VANO 3000, BADBADNOTGOOD & Samuel T. Herring — Running Away (Vocal Remix)
  "1440924420", // WILLOW — Wait a Minute!
  "966411602", // Wiz Khalifa — See You Again (feat. Charlie Puth)
  "6773300446", // WizTheMc, bees & honey & Tyla — Show Me Love (with Tyla)
  "1892652049", // Wotts — ALOHA!
  "1440917412", // Yeah Yeah Yeahs — Maps
  "1723309988", // YG Marley — Praise Jah In the Moonlight
  "1776246888", // yung kai — blue
  "1201058113", // Zara Larsson — Lush Life
  "6766484790", // zukrassverliebt — In My Heart
];
