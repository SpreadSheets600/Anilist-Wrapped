from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import hashlib

from data.anime import fetch_anime
from data.manga import fetch_manga
from data.favorites import fetch_favorites
from rewind import build_rewind

app = FastAPI(title="AniList Unified Rewind")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

cache = {}
share_cache = {}

@app.get("/api/rewind")
async def api_rewind(username: str = Query(...), year: int = Query(None)):
    year = year or datetime.utcnow().year
    cache_key = f"{username}-{year}"
    
    if cache_key in cache:
        return cache[cache_key]
    
    anime = await fetch_anime(username)
    manga = await fetch_manga(username)
    favorites = await fetch_favorites(username)
    
    result = build_rewind(anime, manga, favorites, year)
    
    # Generate share ID
    share_id = hashlib.md5(f"{username}-{year}-{datetime.now()}".encode()).hexdigest()[:8]
    result["shareId"] = share_id
    result["username"] = username
    result["generatedAt"] = datetime.now().isoformat()
    
    cache[cache_key] = result
    share_cache[share_id] = result
    
    return result

@app.get("/api/share")
async def api_share(shareId: str = Query(...)):
    if shareId not in share_cache:
        return {"error": "Share not found"}
    return share_cache[shareId]

import httpx
from fastapi.responses import StreamingResponse

@app.get("/api/proxy")
async def proxy_image(url: str):
    client = httpx.AsyncClient()
    req = client.build_request("GET", url)
    r = await client.send(req, stream=True)
    return StreamingResponse(
        r.aiter_bytes(), 
        media_type=r.headers.get("content-type"),
        headers={"Access-Control-Allow-Origin": "*"}
    )
