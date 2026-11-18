# AniList Wrapped

### Your year in anime and manga, remembered.

[Open the archive](https://anilist-wrapped.spreadsheets600.workers.dev) · [Run locally](#development) · [Data notes](#data-notes)

Enter a public AniList username to revisit your highlights, favourite characters, and the stories that filled your year. No login required.

- An animated cover wall built with React Bits GridMotion.
- Personal milestones, genre breakdowns, and interactive charts.
- A monthly timeline and a shareable recap.
- Cached profiles, loading timeouts, and saved archives for temporary outages.

## Development

Requires Node.js and npm.

```sh
npm ci
npm run build
npx wrangler dev
```

Wrangler runs both the website and its `/api/archive` endpoint. A plain static server only serves the interface.

## Deploy

```sh
npm test
npm run build
npx wrangler deploy
```

Sign in with `npx wrangler login` before your first deployment. The Worker name and asset settings live in `wrangler.toml`.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/` | React cover wall and browser API fallback |
| `static/` | Website, styles, and built assets |
| `server/` | Public AniList queries and caching |
| `tests/` | API reliability checks |

## Data notes

The recap uses recorded completion dates. Fresh visits open the current year, or the latest year with completed titles. Shared links retain their year.

Profiles stay fresh in cache for 15 minutes. Saved snapshots may remain available for up to 24 hours and show their saved time when used as a fallback. Rate-limit delays are respected, and requests have timeouts and cancellation.

Episode totals reflect the current progress of completed titles, rather than episodes watched within that year. Titles without a completion month are excluded from the monthly chart. Share links regenerate the recap and are not permanent snapshots.

Public profile data may be cached in your browser and at Cloudflare. No login credentials are collected.

---

Built with React, React Bits, GSAP, Cloudflare Workers, and the AniList API. Independent of AniList. Artwork belongs to its respective creators.
