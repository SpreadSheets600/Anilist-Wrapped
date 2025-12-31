# AniList Wrapped

A modern, shareable AniList Wrapped experience that generates beautiful visualizations of your anime and manga consumption throughout the year.

## Features

- 🎨 Modern, responsive design with smooth animations
- 📱 Mobile-friendly interface
- 🔗 Shareable links for your wrapped data
- ⚡ Caching for improved performance
- 🎭 Beautiful typography and visual effects
- 🖼️ Python-generated share cards with glassmorphism design

### Local Development

```bash
pip install -r requirements.txt

python app.py
```

Visit <http://localhost:8000>

## API Endpoints

- `/api/rewind?username={username}&year={year}` - Generate wrapped data
- `/api/generate-card?shareId={shareId}` - Generate share card image
- `/api/share?shareId={shareId}` - Get shared wrapped data

## Tech Stack

- AniList GraphQL API
- Flask (Python backend)
- Vanilla JavaScript (ES6+)
- Tailwind CSS for utilities
- Pillow (Share card generation)
- Modern CSS with custom properties
