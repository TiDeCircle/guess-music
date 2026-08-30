# Prefer artistId lookups over the Search API

Six of the nine playlists were built by searching iTunes for each artist by name. That endpoint throttles hard: a burst of a few hundred requests left this machine answering `403` to every search for hours, while `lookup` and the chart RSS feeds kept working normally. With a cold cache during a throttle, those six playlists fail outright — we watched it happen.

So artists are resolved to iTunes `artistId` once, checked into `src/data/seeds/artist-ids.ts`, and fetched at play time with `lookup?id=…&entity=song`, which is a single unthrottled request returning up to sixty songs. Artist mode runs on the same call.

## Consequences

- The id map is consulted first and a name-based search remains the fallback, so the map can be filled in an artist at a time without any playlist going dark in between.
- Resolving a name to an id still needs the Search API, but only once, offline, via `scripts/resolve-artist-ids.ts` — never on a player's request.
- The lookup path also returns tracks where the artist is only a guest, credited to somebody else. Those are filtered by `artistId`: in artist mode a differing artist line under one option would point straight at the answer.
