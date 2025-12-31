import httpx

FAVORITES_QUERY = """
query ($username: String) {
  User(name: $username) {
    favourites {
      characters(page: 1, perPage: 10) {
        nodes {
          name { full }
          image { large }
        }
      }
      staff(page: 1, perPage: 10) {
        nodes {
          name { full }
          image { large }
          primaryOccupations
        }
      }
    }
  }
}
"""


async def fetch_favorites(username: str):
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://graphql.anilist.co",
            json={"query": FAVORITES_QUERY, "variables": {"username": username}},
        )
        r.raise_for_status()
        data = r.json()["data"]["User"]["favourites"]
        return {
            "characters": data["characters"]["nodes"],
            "staff": data["staff"]["nodes"],
        }
