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
        completedAt { year month }
        media {
          title { romaji }
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
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://graphql.anilist.co",
            json={"query": MANGA_QUERY, "variables": {"username": username}},
        )
        r.raise_for_status()
        return r.json()["data"]["MediaListCollection"]
