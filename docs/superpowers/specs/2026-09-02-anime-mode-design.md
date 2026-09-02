# Guess the anime: a mode whose answer is a series, not a song

Every mode this game has shipped asks the same question — *which song is this?* — and differs only in how the clip is handed over and who the points land on. Anime mode asks a different question: you hear the opening, and you name the show. That is the first time the answer is not the thing being played, and it is the whole of what makes this more than a new playlist.

## What already works, and what does not

The `GameMode` interface was built for exactly this: the Room machinery asks `judge` what a guess was worth and `shared` who it belongs to, and never branches on which mode is running. A fourth mode drops in without the server learning its name. Round scaffolding is already shared through `buildChoiceRounds`, and a mode that wants a different shape of choice supplies its own builder — that is a designed seam, not a workaround.

Two things do not work, and they are the substance of this design.

**A `Track` has no idea what it is from.** iTunes returns a title, an artist, artwork, a preview and a release date, and nothing that says "Frieren". There is no field to read, no lookup to call, and no heuristic worth trusting — the album name for an anime single is as often the single's own title as the show's. The mapping has to be curated and shipped, like `ARTIST_IDS` and the four CSV-resolved playlists before it.

**Mode and Song Source are orthogonal today, and this mode breaks that.** Any mode plays any playlist, because every mode only ever needed a title. Anime mode needs a pool whose tracks carry a series, and there is no honest way to play it against the luk thung playlist. The coupling is real; the design's job is to make it narrow and explicit rather than pretend it isn't there.

## Series rides on the Track

`Track` gains `series?: string`, set only by playlists that ship a mapping for it.

The alternative — keeping `Track` clean and threading a separate `seriesById` map through `BuildRoundsInput` — is more principled right up until the reveal screen, which must print the show's name and receives a `Track` and nothing else. A parallel pipe would have to be built and kept in sync for data that has to arrive on the Track anyway. One optional field, documented as belonging to series-bearing playlists, is the smaller lie.

The seed file exports pairs rather than bare ids:

```ts
export const ANIME_TRACKS: ReadonlyArray<{ id: string; series: string }> = [...];
```

and `PlaylistSource`'s `tracks` kind gains an optional `series?: Readonly<Record<string, string>>`. `getFixedTracks` stamps it onto each track after the lookup returns. Everything else about the curated-tracks path — the day of caching, the batched lookup, the dedupe — is reused untouched.

## The mode

`src/shared/modes/anime.ts` exports `animeMode` (`shared: false`, `typed: false`), a sibling of `buildChoiceRounds` rather than a parameter to it. Sharing a builder between "four songs" and "four shows" would mean a decoy function that takes a strategy and a key extractor and satisfies neither caller; the two are eighty lines that read straight, and they should stay two.

Building a round:

- Keep only pool tracks that carry a `series`.
- Pick an answer whose series has not been an answer yet in this Match. A show with six openings should not be the answer six times.
- Choices are four **distinct series**: the answer's, plus three others. `Choice.id` and `Choice.title` are both the series name — the name is already unique in the pool, and there is no track id that could stand for a show without inventing one.
- Fewer than four distinct series available means no round, exactly as fewer than four choices does today.

`judge` compares `guess === plan.answer.series`. Right or wrong it is final, and the speed bonus works as it does in Quiz.

Difficulty steers the decoys, not the clock: `easy` and `medium` draw the three wrong shows at random, `hard` and `extreme` prefer shows whose tracks fall within two years of the answer's `Track.year`, so the era stops being a free elimination. The release year of an opening single is the show's year closely enough, and it is already on the Track — a second curated column would earn nothing here. Clip length and answer window come from the same `DifficultySpec` Quiz uses.

## Where the coupling lives

`GameMode` gains `requiresSeries: boolean`.

Naming the requirement rather than the playlist group is the point. A second anime playlist — a 90s one, a movie-themes one — becomes selectable by carrying series data, with nothing in the mode or the picker to update. The rule follows the data.

- `PlaylistGroup` gains `"anime"`; the first playlist is `anime-all`.
- With a `requiresSeries` mode selected, `PlaylistPicker` shows only playlists that supply series, and hides the by-artist tile entirely — an artist pool has no shows in it.
- Selecting the anime mode while a non-series playlist is chosen sends both changes in one config update, so the lobby is never briefly showing an unplayable pair. Switching *away* needs no correction: the anime playlist is a perfectly good pool for "which song is this?".
- **The server enforces the same rule.** `setConfig` rejects a config whose mode requires series against a source that cannot supply it. Hiding the tile is a courtesy to the host; a socket payload is attacker-controlled input, and the check that matters is the one in `rooms.ts`.

A pool that passes the check but still yields no rounds falls through to the existing `rounds.length === 0` path in `startMatch`, which already refuses the match with a message rather than starting a broken one.

## Getting the data

`scripts/draft-anime-playlist.ts`, run once, offline, output reviewed by hand before anything ships.

[AnimeThemes.moe](https://api.animethemes.moe) is free, unauthenticated, reachable from the box, and returns anime name, year, OP/ED, song title and artist. Years 2019–2024 alone hold 3,260 themes across 1,294 shows.

It does not join cleanly to iTunes. AnimeThemes writes song titles in romaji (`Chiisana Omoi`); the storefront lists them in Japanese (`小さな想い`). A naive normalised-title match across the six most prolific artists in that window scored 41/148 — 28%. Their `resources` links reach Spotify and YouTube Music, never Apple Music, so there is no id bridge to borrow.

The measured 28% is close to a worst case: those six were voice actors with long tails of obscure theme songs. The script therefore goes artist-first, over a shortlist of acts whose anime work is the work people would recognise —

- Pull each artist's full iTunes catalogue by `artistId` through `getArtistTracksById`, the endpoint that does not throttle into 403s (ADR 0005).
- Pull the same artist's themes from AnimeThemes.
- Match, and write every pair — matched and missed — to a CSV for review.

The shortlist gets proposed and agreed before the script runs. The CSV gets edited before it becomes a seed. A show nobody in the room has watched is a dead round, and that judgement is not the script's to make.

## Consequences

- `Track.series` is optional and almost always absent. Anything reading it must handle `undefined`, and the reveal screen shows the line only when there is one.
- Anime mode and Song Source are no longer independent. That is a real constraint on a system that had none, and it is worth the narrowest possible expression: one boolean on the mode, one filter in the picker, one guard on the server.
- The mode picker goes to three cards, and the home screen's mode count with it.
- The anime playlist is playable in Heardle, but without its typing aid: `public/song-index.json` is built from the shipped artist seeds, which do not include these acts. Free text still grades correctly (ADR 0006), so it works and merely feels unassisted. Adding the shortlist to `scripts/build-song-index.ts` would fix it and is deliberately out of scope here.
- Series names ship in one language. Romaji is what AnimeThemes provides and what the review pass will be reading; a Thai or English name per show would be a second curated column, and is not in this version.
- A show with many openings is over-represented in the pool but capped at one answer per Match, so it shows up mostly as a decoy. That is the right bias — a familiar wrong option is what makes a guess a guess.
