import requests
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageFilter


def download_image(url):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        response = requests.get(url, timeout=15, headers=headers)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content))
        return img.convert("RGB")
    except Exception as e:
        print(f"Error downloading image {url}: {e}")
        placeholder = Image.new("RGB", (280, 400), color="#1a1a1a")
        return placeholder


def round_corners(img, radius):
    mask = Image.new("L", img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), img.size], radius=radius, fill=255)

    output = Image.new("RGBA", img.size, (0, 0, 0, 0))
    output.paste(img, (0, 0))
    output.putalpha(mask)
    return output


def create_share_card(data):
    width, height = 1080, 1350

    img = Image.new("RGB", (width, height), color="#000000")
    draw = ImageDraw.Draw(img, "RGBA")

    for y in range(height):
        ratio = y / height
        r = int(8 + ratio * 12)
        g = int(8 + ratio * 18)
        b = int(15 + ratio * 25)
        draw.rectangle([(0, y), (width, y + 1)], fill=(r, g, b))

    try:
        font_title = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 58
        )
        font_heading = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36
        )
        font_stat = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 62
        )
        font_label = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22
        )
        font_small = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20
        )
        font_tiny = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14
        )
    except Exception:
        font_title = ImageFont.load_default()
        font_heading = font_stat = font_label = font_small = font_tiny = font_title

    overall = data["overall"]
    persona = data["persona"]
    username = data.get("username", "User")
    year = data.get("year", 2024)

    draw.rectangle([(0, 0), (width, 4)], fill="#00d9ff")

    draw.text((45, 30), f"WRAPPED {year}", fill="#00d9ff", font=font_small)
    draw.text((45, 65), username.upper(), fill="#ffffff", font=font_title)

    persona_text = persona["title"].upper()
    bbox = draw.textbbox((0, 0), persona_text, font=font_label)
    persona_width = bbox[2] - bbox[0]
    draw.rounded_rectangle(
        [(width - persona_width - 75, 70), (width - 45, 105)],
        radius=18,
        fill=(0, 217, 255, 180),
    )
    draw.text(
        (width - persona_width - 60, 78), persona_text, fill="#000000", font=font_label
    )

    y_offset = 160

    anime_cover = download_image(overall.get("best_anime", {}).get("cover_image"))
    anime_cover = anime_cover.resize((330, 475), Image.Resampling.LANCZOS)
    anime_rounded = round_corners(anime_cover, 30)

    glow = Image.new("RGBA", (340, 485), (0, 217, 255, 25))
    glow = glow.filter(ImageFilter.GaussianBlur(15))
    img.paste(glow, (55, y_offset - 5), glow)

    img.paste(anime_rounded, (60, y_offset), anime_rounded)

    draw.rounded_rectangle(
        [(75, y_offset + 15), (135, y_offset + 38)], radius=12, fill=(0, 217, 255, 220)
    )
    draw.text((83, y_offset + 20), "AOTY", fill="#000000", font=font_tiny)

    manga_cover = download_image(overall.get("best_manga", {}).get("cover_image"))
    manga_cover = manga_cover.resize((330, 475), Image.Resampling.LANCZOS)
    manga_rounded = round_corners(manga_cover, 30)

    glow = Image.new("RGBA", (340, 485), (255, 128, 128, 25))
    glow = glow.filter(ImageFilter.GaussianBlur(15))
    img.paste(glow, (685, y_offset - 5), glow)

    img.paste(manga_rounded, (690, y_offset), manga_rounded)

    draw.rounded_rectangle(
        [(705, y_offset + 15), (765, y_offset + 38)],
        radius=12,
        fill=(255, 128, 128, 220),
    )
    draw.text((713, y_offset + 20), "MOTY", fill="#000000", font=font_tiny)

    stats_y = y_offset + 515

    draw.rounded_rectangle(
        [(60, stats_y), (510, stats_y + 200)], radius=30, fill=(15, 15, 20, 160)
    )
    draw.rounded_rectangle(
        [(60, stats_y), (510, stats_y + 200)],
        radius=30,
        outline=(0, 217, 255, 100),
        width=2,
    )

    draw.text((85, stats_y + 22), "ANIME", fill="#00d9ff", font=font_heading)
    draw.text(
        (85, stats_y + 75),
        str(overall["anime_completed"]),
        fill="#ffffff",
        font=font_stat,
    )
    draw.text((85, stats_y + 145), "COMPLETED", fill="#888888", font=font_small)
    draw.text(
        (270, stats_y + 75),
        str(overall["episodes_watched"]),
        fill="#ffffff",
        font=font_stat,
    )
    draw.text((270, stats_y + 145), "EPISODES", fill="#888888", font=font_small)

    draw.rounded_rectangle(
        [(570, stats_y), (1020, stats_y + 200)], radius=30, fill=(20, 15, 15, 160)
    )
    draw.rounded_rectangle(
        [(570, stats_y), (1020, stats_y + 200)],
        radius=30,
        outline=(255, 128, 128, 100),
        width=2,
    )

    draw.text((595, stats_y + 22), "MANGA", fill="#ff8080", font=font_heading)
    draw.text(
        (595, stats_y + 75),
        str(overall["manga_completed"]),
        fill="#ffffff",
        font=font_stat,
    )
    draw.text((595, stats_y + 145), "COMPLETED", fill="#888888", font=font_small)
    draw.text(
        (780, stats_y + 75),
        str(overall["chapters_read"]),
        fill="#ffffff",
        font=font_stat,
    )
    draw.text((780, stats_y + 145), "CHAPTERS", fill="#888888", font=font_small)

    genres_y = stats_y + 240
    draw.text((60, genres_y), "TOP GENRES", fill="#999999", font=font_heading)

    genres = list(overall.get("top_genres", {}).keys())[:6]
    colors = [
        (0, 217, 255),
        (255, 128, 128),
        (0, 255, 136),
        (255, 170, 0),
        (138, 43, 226),
        (0, 255, 255),
    ]

    genre_x = 60
    genre_y = genres_y + 55

    for i, genre in enumerate(genres):
        bbox = draw.textbbox((0, 0), genre, font=font_small)
        genre_width = bbox[2] - bbox[0] + 40

        if genre_x + genre_width > width - 60:
            genre_x = 60
            genre_y += 60

        color = colors[i % len(colors)]

        draw.rounded_rectangle(
            [(genre_x, genre_y), (genre_x + genre_width, genre_y + 44)],
            radius=22,
            fill=(*color, 140),
        )
        draw.rounded_rectangle(
            [(genre_x, genre_y), (genre_x + genre_width, genre_y + 44)],
            radius=22,
            outline=(*color, 200),
            width=1,
        )
        draw.text((genre_x + 20, genre_y + 12), genre, fill="#ffffff", font=font_small)
        genre_x += genre_width + 15

    draw.rectangle([(0, height - 4), (width, height)], fill="#ff8080")

    return img
