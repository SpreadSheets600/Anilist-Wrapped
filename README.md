# AniList Wrapped

A modern, shareable AniList Wrapped experience that generates beautiful visualizations of your anime and manga consumption throughout the year.

## Features

- 🎨 Modern, responsive design with smooth animations
- 📱 Mobile-friendly interface
- 🔗 Shareable links for your wrapped data
- ⚡ Caching for improved performance (Cache API, 1h)
- 🎭 Beautiful typography and visual effects

## Cloudflare Workers Deployment (Recommended)

This project is now deployed on **Cloudflare Workers** via `worker.js` (JS port of `rewind.py` + Flask routes).

```bash
# Login (once)
npx wrangler login

# Deploy
npx wrangler deploy
```

Live: `https://anilist-wrapped.fluxoristudios.workers.dev`

**Required files for deployment:**
- `worker.js` – main Worker (handles `/`, `/health`, `/api/rewind`, `/api/share`, `/api/proxy`)
- `wrangler.toml` – `name`, `compatibility_date`, `assets.directory = "./static"`
- `static/` – `css/styles.css`, `js/app.js` (served via `ASSETS` binding)

No KV, no Pillow, no Python deps needed for edge deployment.

## Local Development (Flask, optional)

```bash
pip install -r requirements.txt
python app.py
# http://localhost:2110
```

## API Endpoints

- `GET /` – App shell
- `GET /health` – Health check
- `GET /api/rewind?username={username}&year={year}` – Generate wrapped data (cached 1h)
- `GET /api/share?shareId={shareId}` – Get shared wrapped data (Cache API)
- `GET /api/proxy?url={url}` – Image proxy

## Tech Stack

- AniList GraphQL API
- Cloudflare Workers + Assets (production) / Flask (local dev)
- Vanilla JavaScript (ES6+), GSAP, Lenis, Chart.js
- Tailwind CSS
- Modern CSS with custom properties

## Contributors

- [@aritramondal0300](https://github.com/aritramondal0300)
- [@SpreadSheets600](https://github.com/SpreadSheets600)
