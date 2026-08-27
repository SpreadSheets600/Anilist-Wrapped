import httpx

ANILIST_API_URL = "https://graphql.anilist.co"

ANIME_QUERY = """
query ($username: String) {
  MediaListCollection(userName: $username, type: ANIME) {
    lists {
      entries {
        score
        progress
        repeat
        status
        updatedAt
        completedAt { year month }
        media {
          title { english romaji native }
          duration
          format
          genres
          bannerImage
          coverImage { large }
          studios(isMain: true) {
            nodes {
              name
            }
          }
        }
      }
    }
  }
}
"""


async def fetch_anime(username: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            ANILIST_API_URL,
            json={"query": ANIME_QUERY, "variables": {"username": username}},
        )
        r.raise_for_status()
        data = r.json()
        if data.get("errors"):
            raise Exception(data["errors"][0].get("message", "AniList error"))
        col = data["data"]["MediaListCollection"]
        # Private or not found returns None
        if col is None:
            return {"lists": []}
        return col
