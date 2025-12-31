from datetime import datetime
from collections import defaultdict


def determine_persona(stats):
    genres = [g[0] for g in stats["top_genres"][:3]]

    if stats["episodes_watched"] > 1000:
        return "The Titan", "You consume anime at a rate that defies logic."

    movie_count = stats["formats"].get("MOVIE", 0)
    total_count = stats["anime_completed"]
    if total_count > 10 and (movie_count / total_count) > 0.3:
        return "The Cinephile", "You prefer the silver screen over the weekly grind."

    if stats["average_score"] >= 8.5 and total_count > 5:
        return "The Connoisseur", "You only accept the absolute peak of fiction."

    if stats["average_score"] < 6.0 and total_count > 20:
        return "The Critic", "You watch everything, just to say you hated it."

    if "Romance" in genres or "Drama" in genres:
        return "The Hopeless Romantic", "You live for the feels and the heartbreak."
    if "Sci-Fi" in genres or "Mecha" in genres:
        return "The Futurist", "You dream of electric sheep and giant robots."
    if "Sports" in genres:
        return "The Athlete", "Training arcs are your daily motivation."
    if "Horror" in genres or "Psychological" in genres:
        return "The Edge Walker", "You stare into the abyss, and it blinks first."
    if "Action" in genres or "Adventure" in genres:
        return (
            "The Shonen Protagonist",
            "You're just one training arc away from greatness.",
        )

    return "The Casual Observer", "You enjoy anime at a healthy, human pace."


def build_rewind(anime_data, manga_data, favorites_data, year: int):
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
        "studios": defaultdict(int),
        "formats": defaultdict(int),
        "countries": defaultdict(int),
    }

    monthly = defaultdict(
        lambda: {
            "anime": [],
            "manga": [],
            "genres": defaultdict(int),
        }
    )

    ongoing = {"anime": [], "manga": []}

    def was_active_in_year(ts):
        if not ts:
            return False
        dt = datetime.fromtimestamp(ts)
        return dt.year == year

    for lst in anime_data["lists"]:
        for e in lst["entries"]:
            media = e["media"]

            if e["status"] in ["CURRENT", "REPEATING"] and was_active_in_year(
                e.get("updatedAt")
            ):
                ongoing["anime"].append(
                    {
                        "title": media["title"].get("english")
                        or media["title"]["english"],
                        "cover_image": media["coverImage"]["large"],
                        "progress": e.get("progress") or 0,
                        "score": e["score"],
                    }
                )

            c = e.get("completedAt")
            if not c or c["year"] != year:
                continue

            m = c["month"]

            overall["anime_completed"] += 1
            progress = e.get("progress") or 0
            overall["episodes_watched"] += progress
            duration = media.get("duration") or 24
            overall["minutes_watched"] += progress * duration
            overall["rewatches"] += e.get("repeat") or 0

            if e["score"] > 0:
                overall["scores"].append(e["score"])

            fmt = media.get("format") or "UNKNOWN"
            overall["formats"][fmt] += 1

            studios = media.get("studios", {}).get("nodes", [])
            for s in studios:
                overall["studios"][s["name"]] += 1

            anime_obj = {
                "title": media["title"].get("english") or media["title"]["english"],
                "score": e["score"],
                "cover_image": media["coverImage"]["large"],
                "banner_image": media["bannerImage"],
                "format": fmt,
                "studios": studios,
            }
            monthly[m]["anime"].append(anime_obj)

            for g in media.get("genres", []):
                overall["genres"][g] += 1
                monthly[m]["genres"][g] += 1

    for lst in manga_data["lists"]:
        for e in lst["entries"]:
            media = e["media"]

            if e["status"] in ["CURRENT", "REPEATING"] and was_active_in_year(
                e.get("updatedAt")
            ):
                ongoing["manga"].append(
                    {
                        "title": media["title"].get("english")
                        or media["title"]["english"],
                        "cover_image": media["coverImage"]["large"],
                        "progress": e.get("progress") or 0,
                        "score": e["score"],
                    }
                )

            c = e.get("completedAt")
            if not c or c["year"] != year:
                continue

            m = c["month"]

            overall["manga_completed"] += 1
            overall["chapters_read"] += e.get("progress") or 0
            overall["volumes_read"] += e.get("progressVolumes") or 0
            overall["rereads"] += e.get("repeat") or 0

            if e["score"] > 0:
                overall["scores"].append(e["score"])

            origin = media.get("countryOfOrigin") or "JP"
            overall["countries"][origin] += 1

            manga_obj = {
                "title": media["title"].get("english") or media["title"]["english"],
                "score": e["score"],
                "cover_image": media["coverImage"]["large"],
                "banner_image": media["bannerImage"],
            }
            monthly[m]["manga"].append(manga_obj)

            for g in media.get("genres", []):
                overall["genres"][g] += 1
                monthly[m]["genres"][g] += 1

    monthly_overview = []
    activity_counts = [0] * 12

    for month, data in sorted(monthly.items()):
        total_titles = len(data["anime"]) + len(data["manga"])
        if 1 <= month <= 12:
            activity_counts[month - 1] = total_titles

        monthly_overview.append(
            {
                "month": month,
                "activity_summary": {
                    "anime_completed": len(data["anime"]),
                    "manga_completed": len(data["manga"]),
                    "total_titles_completed": total_titles,
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

    avg_score = (
        round(sum(overall["scores"]) / len(overall["scores"]), 2)
        if overall["scores"]
        else 0
    )

    anime_scores = [
        e["score"] for m in monthly.values() for e in m["anime"] if e["score"] > 0
    ]
    manga_scores = [
        e["score"] for m in monthly.values() for e in m["manga"] if e["score"] > 0
    ]

    anime_avg = round(sum(anime_scores) / len(anime_scores), 2) if anime_scores else 0
    manga_avg = round(sum(manga_scores) / len(manga_scores), 2) if manga_scores else 0

    top_genres_list = sorted(
        overall["genres"].items(), key=lambda x: x[1], reverse=True
    )

    all_completed_anime = []
    for m in monthly.values():
        all_completed_anime.extend(m["anime"])

    all_completed_manga = []
    for m in monthly.values():
        all_completed_manga.extend(m["manga"])

    all_completed_anime.sort(key=lambda x: x["score"], reverse=True)
    all_completed_manga.sort(key=lambda x: x["score"], reverse=True)

    best_anime_year = all_completed_anime[0] if all_completed_anime else None
    best_manga_year = all_completed_manga[0] if all_completed_manga else None

    top_anime_list = all_completed_anime[:3]
    top_manga_list = all_completed_manga[:3]

    score_dist = defaultdict(int)
    for s in overall["scores"]:
        if s > 0:
            bin_key = (s // 10) * 10
            if bin_key == 100:
                bin_key = 90
            score_dist[bin_key] += 1

    final_score_dist = {k: score_dist[k] for k in range(10, 101, 10)}

    peak_month_data = None
    if monthly_overview:
        peak_month_data = max(
            monthly_overview,
            key=lambda x: x["activity_summary"]["total_titles_completed"],
        )

    persona_title, persona_desc = determine_persona(
        {
            "episodes_watched": overall["episodes_watched"],
            "anime_completed": overall["anime_completed"],
            "formats": overall["formats"],
            "average_score": avg_score,
            "top_genres": top_genres_list,
        }
    )

    all_covers = set()
    for m in monthly.values():
        for a in m["anime"]:
            if a.get("cover_image"):
                all_covers.add(a["cover_image"])
        for mg in m["manga"]:
            if mg.get("cover_image"):
                all_covers.add(mg["cover_image"])

    collage_covers = list(all_covers)[:50]

    ongoing["anime"].sort(key=lambda x: x["progress"], reverse=True)
    ongoing["manga"].sort(key=lambda x: x["progress"], reverse=True)

    return {
        "year": year,
        "persona": {"title": persona_title, "description": persona_desc},
        "overall": {
            "anime_completed": overall["anime_completed"],
            "manga_completed": overall["manga_completed"],
            "episodes_watched": overall["episodes_watched"],
            "minutes_watched": overall["minutes_watched"],
            "total_days_watched": round(overall["minutes_watched"] / 1440, 1),
            "chapters_read": overall["chapters_read"],
            "volumes_read": overall["volumes_read"],
            "rewatches": overall["rewatches"],
            "rereads": overall["rereads"],
            "average_score": avg_score,
            "anime_avg_score": anime_avg,
            "manga_avg_score": manga_avg,
            "top_genres": dict(top_genres_list),
            "top_studios": dict(
                sorted(overall["studios"].items(), key=lambda x: x[1], reverse=True)[:5]
            ),
            "formats": dict(
                sorted(overall["formats"].items(), key=lambda x: x[1], reverse=True)
            ),
            "countries": dict(
                sorted(overall["countries"].items(), key=lambda x: x[1], reverse=True)
            ),
            "score_distribution": final_score_dist,
            "best_anime": best_anime_year,
            "best_manga": best_manga_year,
            "top_anime_list": top_anime_list,
            "top_manga_list": top_manga_list,
            "collage_covers": collage_covers,
            "activity_counts": activity_counts,
        },
        "ongoing": ongoing,
        "highlights": {"peak_month": peak_month_data},
        "favorites": favorites_data,
        "monthly_overview": monthly_overview,
    }
