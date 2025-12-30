# AniList Wrapped

A modern, shareable AniList Wrapped experience that generates beautiful visualizations of your anime and manga consumption throughout the year.

## Features

- 🎨 Modern, responsive design with smooth animations
- 📱 Mobile-friendly interface
- 🔗 Shareable links for your wrapped data
- ⚡ Caching for improved performance
- 🌐 Netlify-ready deployment
- 🎭 Beautiful typography and visual effects

## Deployment

### Netlify (Recommended)

1. Connect your repository to Netlify
2. Build settings are automatically configured via `netlify.toml`
3. Deploy!

### Manual Deployment

```bash
npm run build
# Upload dist/ folder to your hosting provider
```

## Development

```bash
# Start development server
npm run dev
```

## API Endpoints

- `/api/rewind?username={username}&year={year}` - Generate wrapped data
- `/api/share?shareId={shareId}` - Get shared wrapped data

## Tech Stack

- Vanilla JavaScript (ES6+)
- Modern CSS with custom properties
- Netlify Functions for serverless backend
- AniList GraphQL API
- Tailwind CSS for utilities

## License

MIT
