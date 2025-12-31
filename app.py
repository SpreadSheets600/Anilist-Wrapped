from flask import (
    Flask,
    jsonify,
    request,
    Response,
    send_file,
    render_template,
)

import os
import sys
import asyncio
import hashlib
from io import BytesIO
from datetime import datetime
from flask_caching import Cache


sys.path.insert(0, os.path.dirname(__file__))

try:
    from rewind import build_rewind
    from data.anime import fetch_anime
    from data.manga import fetch_manga
    from share_card import create_share_card
    from data.favorites import fetch_favorites
except ImportError as e:
    print(f"Import error: {e}")

    async def fetch_anime(username):
        return {"lists": []}

    async def fetch_manga(username):
        return {"lists": []}

    async def fetch_favorites(username):
        return {"characters": []}

    def build_rewind(anime, manga, favorites, year):
        return {"error": "Import failed"}

    def create_share_card(data):
        from PIL import Image

        return Image.new("RGB", (1080, 1350), color="#030303")


app = Flask(__name__)
cache = Cache(config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 3600})
cache.init_app(app)

share_cache = {}


@app.route("/")
def index():
    try:
        return render_template("index.html")
    except Exception as e:
        return jsonify({"error": str(e), "message": "Template error"}), 500


@app.route("/health")
def health():
    return jsonify({"status": "ok", "message": "Server is running"}), 200


@app.route("/api/rewind")
@cache.cached(timeout=3600, query_string=True)
def api_rewind():
    username = request.args.get("username")
    year = request.args.get("year")

    if not username:
        return jsonify({"error": "Username is required"}), 400

    if not year:
        year = datetime.utcnow().year
    else:
        year = int(year)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        anime = loop.run_until_complete(fetch_anime(username))
        manga = loop.run_until_complete(fetch_manga(username))
        favorites = loop.run_until_complete(fetch_favorites(username))

        loop.close()

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
def proxy_image():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "URL is required"}), 400

    try:
        import requests as req

        resp = req.get(url, timeout=10)
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
    app.run(debug=True, host="0.0.0.0", port=2110)
