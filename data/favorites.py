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
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://graphql.anilist.co",
            json={"query": FAVORITES_QUERY, "variables": {"username": username}},
        )
        r.raise_for_status()
        data = r.json()
        if data.get("errors"):
            # User not found -> return empty
            return {"characters": [], "staff": []}
        user = data["data"].get("User")
        if not user or not user.get("favourites"):
            return {"characters": [], "staff": []}
        fav = user["favourites"]
        return {
            "characters": fav.get("characters", {}).get("nodes", []),
            "staff": fav.get("staff", {}).get("nodes", []),
        }
