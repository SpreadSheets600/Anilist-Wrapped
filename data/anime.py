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
          title { romaji }
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
    async with httpx.AsyncClient() as client:
        r = await client.post(
            ANILIST_API_URL,
            json={"query": ANIME_QUERY, "variables": {"username": username}},
        )
        r.raise_for_status()
        return r.json()["data"]["MediaListCollection"]
