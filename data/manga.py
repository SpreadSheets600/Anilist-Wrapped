import httpx

MANGA_QUERY = """
query ($username: String) {
  MediaListCollection(userName: $username, type: MANGA) {
    lists {
      entries {
        score
        progress
        progressVolumes
        repeat
        status
        updatedAt
        completedAt { year month }
        media {
          title { english romaji native }
          countryOfOrigin
          genres
          bannerImage
          coverImage { large }
        }
      }
    }
  }
}
"""


async def fetch_manga(username: str):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://graphql.anilist.co",
            json={"query": MANGA_QUERY, "variables": {"username": username}},
        )
        r.raise_for_status()
        data = r.json()
        if data.get("errors"):
            raise Exception(data["errors"][0].get("message", "AniList error"))
        col = data["data"]["MediaListCollection"]
        if col is None:
            return {"lists": []}
        return col
