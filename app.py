from flask import (
    Flask,
    jsonify,
    request,
    Response,
    send_file,
    render_template,
)
import httpx
import hashlib
import asyncio
from io import BytesIO
from datetime import datetime
from flask_caching import Cache

from rewind import build_rewind
from data.anime import fetch_anime
from data.manga import fetch_manga
from share_card import create_share_card
from data.favorites import fetch_favorites

app = Flask(__name__)
cache = Cache(config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 3600})
cache.init_app(app)

share_cache = {}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/rewind")
@cache.cached(timeout=3600, query_string=True)
async def api_rewind():
    username = request.args.get("username")
    year = request.args.get("year")

    if not username:
        return jsonify({"error": "Username is required"}), 400

    if not year:
        year = datetime.utcnow().year
    else:
        year = int(year)

    try:
        anime_task = fetch_anime(username)
        manga_task = fetch_manga(username)
        favorites_task = fetch_favorites(username)

        anime, manga, favorites = await asyncio.gather(
            anime_task, manga_task, favorites_task
        )

        result = build_rewind(anime, manga, favorites, year)

        share_id = hashlib.md5(
            f"{username}-{year}-{datetime.now()}".encode()
        ).hexdigest()[:8]
        result["shareId"] = share_id
        result["username"] = username
        result["generatedAt"] = datetime.now().isoformat()

        share_cache[share_id] = result

        html_content = render_template("report_content.html", **result)

        return jsonify({"html": html_content, "data": result})

    except Exception as e:
        app.logger.error(f"Error fetching data: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/share")
def api_share():
    share_id = request.args.get("shareId")
    if share_id not in share_cache:
        return jsonify({"error": "Share not found"}), 404
    return jsonify(share_cache[share_id])


@app.route("/api/proxy")
async def proxy_image():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "URL is required"}), 400

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            return Response(
                resp.content,
                mimetype=resp.headers.get("content-type"),
                headers={"Access-Control-Allow-Origin": "*"},
            )
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route("/api/generate-card")
def generate_card():
    share_id = request.args.get("shareId")
    if not share_id or share_id not in share_cache:
        return jsonify({"error": "Share not found"}), 404

    try:
        data = share_cache[share_id]
        img = create_share_card(data)

        img_io = BytesIO()
        img.save(img_io, "PNG", quality=95)
        img_io.seek(0)

        return send_file(
            img_io,
            mimetype="image/png",
            as_attachment=True,
            download_name=f"Wrapped-{data.get('username', 'User')}-{data.get('year', 2024)}.png",
        )
    except Exception as e:
        app.logger.error(f"Error generating card: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=8000)

# For Vercel
app = app
