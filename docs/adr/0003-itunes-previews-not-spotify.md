# iTunes Search API for audio, not Spotify

Spotify is the first thing anyone suggests for a music game, and it does not work here: playing full tracks requires the Web Playback SDK, an OAuth login, and a Premium subscription *per player*, and Spotify stopped issuing `preview_url` to newly created apps.

The iTunes Search API needs no key, no account, and no OAuth. It returns a 30-second preview URL and album art for essentially every song, indexes Thai artists and Thai song titles properly under the TH storefront, and serves both the JSON and the audio with permissive CORS headers.

## Consequences

- Every clip is a 30-second Preview. Full-song playback is not a feature we can add without replacing the audio source entirely.
- Apple asks for roughly 20 requests per minute, so artist lookups are cached for a day (`src/server/itunes.ts`).
- The song pool is whatever the storefront holds, which is why Categories are seeded from a curated artist list rather than from open search.
