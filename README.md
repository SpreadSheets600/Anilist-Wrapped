# AniList Wrapped - The Anime Archive

A year in anime and manga for public AniList profiles. The landing page keeps one headline and a username field over the React Bits GridMotion cover wall. The recap includes personal milestones, interactive charts, highlights, favourite characters, and a monthly timeline. Fresh visits select the current completion year, or the most recent completion year when the current year has no finishes. Shared links retain their selected year.

## Development

```sh
npm ci
npm run build
npx wrangler dev
```

The Cloudflare Worker serves `static/` and the same-origin `/api/archive?username=...` endpoint. Use Wrangler for the complete application; a plain static server cannot run the archive API. The original Flask reporting endpoints remain in `app.py` for legacy use.

`src/components/GridMotion.jsx` and its CSS adapt the React Bits component source supplied for this project. `src/grid-island.jsx` mounts it in the landing page and the personal recap. `npm run build` emits the self-contained React bundle and CSS and synchronizes the legacy Flask HTML entrypoint. The 20 landing covers are local assets: opening the home page makes no AniList API request. Animation pauses offscreen, while the tab is hidden, and when the gate is closed; reduced-motion preferences stop the drift.

## API caching and loading

Only fixed public-profile GraphQL queries run on the Worker. Names are normalized and resolve to cached snapshots keyed by AniList user ID. Cloudflare edge caches and browser snapshots stay fresh for 15 minutes; snapshots can be retained for up to 24 hours. Older edge snapshots are served immediately while the Worker refreshes in the background. Saved browser data can reopen a recap during a temporary outage, with its saved time displayed in the report. Cloudflare Cache API entries are local to a data center, not one global cache.

Requests for the same profile share an in-flight fetch within a Worker instance. List chunks are fetched sequentially and checked before saving a complete snapshot. If AniList rejects Cloudflare server egress, a short transport cooldown avoids repeated blocked requests and the browser makes the same fixed public queries directly, using the same browser cache and loading deadline. This fallback is not used for `429` responses. AniList `429` responses set a shared edge cooldown and preserve `Retry-After`; the browser also suppresses requests during that delay. Upstream requests and JSON body reads have a 12-second timeout within a 28-second archive deadline. The browser has a 32-second network deadline and an immediate Cancel control. Loading shows actual stages instead of a simulated percentage.

No login, database, or credentials are needed. Public profile snapshots and last-visit information may be stored in the browser; public snapshots may also be cached at Cloudflare. Errors and incomplete profiles are never stored as successful archives.

## Verification and deployment

```sh
npm test
npm run build
npx wrangler deploy
```

Tests cover normalized/user-ID cache lookups, concurrent requests, pagination, stale refresh, expiry, rate-limit cooldowns, stalled responses, validation, and cache failures. The Worker exposes `/health`.

Check the Cloudflare account and the Worker name in `wrangler.toml` before deployment. This project is independent of AniList. Anime cover artwork belongs to its respective creators; Ghibli stills were obtained from Studio Ghibli’s public gallery.

## What the numbers mean

The recap includes list entries whose recorded completion year matches the selected year. Episode totals reflect the current progress of those titles, rather than a count of episodes watched during that year. Entries without a completion year are excluded; entries without a completion month do not appear in the monthly chart. Share links regenerate public data using the cache policy above and are not permanent snapshots.
