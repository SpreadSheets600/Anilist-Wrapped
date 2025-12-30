from collections import defaultdict


def build_rewind(anime_data, manga_data, year: int):
    overall = {
        "anime_completed": 0,
        "manga_completed": 0,
        "episodes_watched": 0,
        "minutes_watched": 0,
        "chapters_read": 0,
        "volumes_read": 0,
        "rewatches": 0,
        "rereads": 0,
        "scores": [],
        "genres": defaultdict(int),
    }

    monthly = defaultdict(
        lambda: {
            "anime": [],
            "manga": [],
            "genres": defaultdict(int),
        }
    )

    for lst in anime_data["lists"]:
        for e in lst["entries"]:
            c = e.get("completedAt")
            if not c or c["year"] != year:
                continue

            m = c["month"]
            media = e["media"]

            overall["anime_completed"] += 1
            overall["episodes_watched"] += e.get("progress") or 0
            overall["minutes_watched"] += (e.get("progress") or 0) * (
                media.get("duration") or 0
            )
            overall["rewatches"] += e.get("repeat") or 0

            if e["score"] > 0:
                overall["scores"].append(e["score"])

            anime_obj = {
                "title": media["title"]["romaji"],
                "score": e["score"],
                "cover_image": media["coverImage"]["large"],
                "banner_image": media["bannerImage"],
            }

            monthly[m]["anime"].append(anime_obj)

            for g in media.get("genres", []):
                overall["genres"][g] += 1
                monthly[m]["genres"][g] += 1

    for lst in manga_data["lists"]:
        for e in lst["entries"]:
            c = e.get("completedAt")
            if not c or c["year"] != year:
                continue

            m = c["month"]
            media = e["media"]

            overall["manga_completed"] += 1
            overall["chapters_read"] += e.get("progress") or 0
            overall["volumes_read"] += e.get("progressVolumes") or 0
            overall["rereads"] += e.get("repeat") or 0

            if e["score"] > 0:
                overall["scores"].append(e["score"])

            manga_obj = {
                "title": media["title"]["romaji"],
                "score": e["score"],
                "cover_image": media["coverImage"]["large"],
                "banner_image": media["bannerImage"],
            }

            monthly[m]["manga"].append(manga_obj)

            for g in media.get("genres", []):
                overall["genres"][g] += 1
                monthly[m]["genres"][g] += 1

    monthly_overview = []
    for month, data in sorted(monthly.items()):
        monthly_overview.append(
            {
                "month": month,
                "activity_summary": {
                    "anime_completed": len(data["anime"]),
                    "manga_completed": len(data["manga"]),
                    "total_titles_completed": len(data["anime"]) + len(data["manga"]),
                },
                "top_anime": max(data["anime"], key=lambda x: x["score"], default=None),
                "top_manga": max(data["manga"], key=lambda x: x["score"], default=None),
                "top_genres": [
                    g
                    for g, _ in sorted(
                        data["genres"].items(), key=lambda x: x[1], reverse=True
                    )[:3]
                ],
            }
        )

    return {
        "year": year,
        "overall": {
            "anime_completed": overall["anime_completed"],
            "manga_completed": overall["manga_completed"],
            "episodes_watched": overall["episodes_watched"],
            "minutes_watched": overall["minutes_watched"],
            "chapters_read": overall["chapters_read"],
            "volumes_read": overall["volumes_read"],
            "rewatches": overall["rewatches"],
            "rereads": overall["rereads"],
            "average_score": round(sum(overall["scores"]) / len(overall["scores"]), 2)
            if overall["scores"]
            else 0,
            "top_genres": dict(
                sorted(overall["genres"].items(), key=lambda x: x[1], reverse=True)
            ),
        },
        "monthly_overview": monthly_overview,
    }
