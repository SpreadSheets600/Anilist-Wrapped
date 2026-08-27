/* Cloudflare Worker for AniList Wrapped
   - Serves static assets via ASSETS binding (./public)
   - Implements /api/rewind, /api/share, /api/proxy
   - No server-side card generation (removed)
*/

/* ---------- in-memory share cache (per-isolate) ---------- */
const shareCache = new Map();

/* ---------- AniList GraphQL queries ---------- */
const ANIME_QUERY = `
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
          title { english native romaji }
          duration
          format
          genres
          bannerImage
          coverImage { large }
          studios(isMain: true) { nodes { name } }
        }
      }
    }
  }
}
`;
const MANGA_QUERY = `
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
          title { english native romaji }
          countryOfOrigin
          genres
          bannerImage
          coverImage { large }
        }
      }
    }
  }
}
`;
const FAVS_QUERY = `
query ($username: String) {
  User(name: $username) {
    favourites {
      characters(page: 1, perPage: 10) { nodes { name { full } image { large } } }
      staff(page: 1, perPage: 10) { nodes { name { full } image { large } primaryOccupations } }
    }
  }
}
`;

async function fetchGql(query, variables) {
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AniList ${r.status}: ${t.slice(0, 300)}`);
  }
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data;
}

/* ---------- rewind logic (port of rewind.py) ---------- */
function determinePersona(stats) {
  const genres = (stats.top_genres || []).slice(0, 3).map((g) => g[0]);
  if (stats.episodes_watched > 1000) return ["The Titan", "You consume anime at a rate that defies logic."];
  const movieCount = stats.formats?.["MOVIE"] || 0;
  const total = stats.anime_completed || 0;
  if (total > 10 && movieCount / total > 0.3) return ["The Cinephile", "You prefer the silver screen over the weekly grind."];
  if (stats.average_score >= 8.5 && total > 5) return ["The Connoisseur", "You only accept the absolute peak of fiction."];
  if (stats.average_score < 6.0 && total > 20) return ["The Critic", "You watch everything, just to say you hated it."];
  if (genres.includes("Romance") || genres.includes("Drama")) return ["The Hopeless Romantic", "You live for the feels and the heartbreak."];
  if (genres.includes("Sci-Fi") || genres.includes("Mecha")) return ["The Futurist", "You dream of electric sheep and giant robots."];
  if (genres.includes("Sports")) return ["The Athlete", "Training arcs are your daily motivation."];
  if (genres.includes("Horror") || genres.includes("Psychological")) return ["The Edge Walker", "You stare into the abyss, and it blinks first."];
  if (genres.includes("Action") || genres.includes("Adventure")) return ["The Shonen Protagonist", "You're just one training arc away from greatness."];
  return ["The Casual Observer", "You enjoy anime at a healthy, human pace."];
}

function buildRewind(animeData, mangaData, favoritesData, year) {
  const overall = {
    anime_completed: 0, manga_completed: 0, episodes_watched: 0, minutes_watched: 0,
    chapters_read: 0, volumes_read: 0, rewatches: 0, rereads: 0,
    scores: [], genres: {}, studios: {}, formats: {}, countries: {},
  };
  const monthly = {};
  const ongoing = { anime: [], manga: [] };
  const inc = (obj, k, v = 1) => (obj[k] = (obj[k] || 0) + v);

  function getMonthly(m) {
    if (!monthly[m]) monthly[m] = { anime: [], manga: [], genres: {} };
    return monthly[m];
  }
  function wasActiveInYear(ts) {
    if (!ts) return false;
    return new Date(ts * 1000).getUTCFullYear() === year;
  }
  function titleOf(t) { return t?.english || t?.romaji || t?.native || "Unknown"; }

  for (const lst of animeData?.lists || []) {
    for (const e of lst.entries || []) {
      const media = e.media;
      if (["CURRENT", "REPEATING"].includes(e.status) && wasActiveInYear(e.updatedAt)) {
        ongoing.anime.push({ title: titleOf(media.title), cover_image: media.coverImage?.large, progress: e.progress || 0, score: e.score });
      }
      const c = e.completedAt;
      if (!c || c.year !== year) continue;
      const m = c.month;
      overall.anime_completed++;
      const progress = e.progress || 0;
      overall.episodes_watched += progress;
      const duration = media.duration || 24;
      overall.minutes_watched += progress * duration;
      overall.rewatches += e.repeat || 0;
      if (e.score > 0) overall.scores.push(e.score);
      inc(overall.formats, media.format || "UNKNOWN");
      for (const s of media.studios?.nodes || []) inc(overall.studios, s.name);
      const obj = {
        title: titleOf(media.title), score: e.score, cover_image: media.coverImage?.large,
        banner_image: media.bannerImage, format: media.format || "UNKNOWN", studios: media.studios?.nodes || [],
      };
      getMonthly(m).anime.push(obj);
      for (const g of media.genres || []) { inc(overall.genres, g); inc(getMonthly(m).genres, g); }
    }
  }
  for (const lst of mangaData?.lists || []) {
    for (const e of lst.entries || []) {
      const media = e.media;
      if (["CURRENT", "REPEATING"].includes(e.status) && wasActiveInYear(e.updatedAt)) {
        ongoing.manga.push({ title: titleOf(media.title), cover_image: media.coverImage?.large, progress: e.progress || 0, score: e.score });
      }
      const c = e.completedAt;
      if (!c || c.year !== year) continue;
      const m = c.month;
      overall.manga_completed++;
      overall.chapters_read += e.progress || 0;
      overall.volumes_read += e.progressVolumes || 0;
      overall.rereads += e.repeat || 0;
      if (e.score > 0) overall.scores.push(e.score);
      inc(overall.countries, media.countryOfOrigin || "JP");
      const obj = { title: titleOf(media.title), score: e.score, cover_image: media.coverImage?.large, banner_image: media.bannerImage };
      getMonthly(m).manga.push(obj);
      for (const g of media.genres || []) { inc(overall.genres, g); inc(getMonthly(m).genres, g); }
    }
  }

  const monthlyOverview = [];
  const activityCounts = Array(12).fill(0);
  for (const month of Object.keys(monthly).map(Number).sort((a, b) => a - b)) {
    const data = monthly[month];
    const total = data.anime.length + data.manga.length;
    if (month >= 1 && month <= 12) activityCounts[month - 1] = total;
    monthlyOverview.push({
      month,
      activity_summary: { anime_completed: data.anime.length, manga_completed: data.manga.length, total_titles_completed: total },
      top_anime: data.anime.reduce((a, b) => (!a || b.score > a.score ? b : a), null),
      top_manga: data.manga.reduce((a, b) => (!a || b.score > a.score ? b : a), null),
      top_genres: Object.entries(data.genres).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k),
    });
  }

  const avg = overall.scores.length ? +(overall.scores.reduce((a, b) => a + b, 0) / overall.scores.length).toFixed(2) : 0;
  const animeScores = Object.values(monthly).flatMap((m) => m.anime.filter((x) => x.score > 0).map((x) => x.score));
  const mangaScores = Object.values(monthly).flatMap((m) => m.manga.filter((x) => x.score > 0).map((x) => x.score));
  const animeAvg = animeScores.length ? +(animeScores.reduce((a, b) => a + b, 0) / animeScores.length).toFixed(2) : 0;
  const mangaAvg = mangaScores.length ? +(mangaScores.reduce((a, b) => a + b, 0) / mangaScores.length).toFixed(2) : 0;

  const topGenresList = Object.entries(overall.genres).sort((a, b) => b[1] - a[1]);
  const allAnime = Object.values(monthly).flatMap((m) => m.anime).sort((a, b) => b.score - a.score);
  const allManga = Object.values(monthly).flatMap((m) => m.manga).sort((a, b) => b.score - a.score);
  const bestAnime = allAnime[0] || null;
  const bestManga = allManga[0] || null;

  const scoreDist = {};
  for (let k = 10; k <= 100; k += 10) scoreDist[k] = 0;
  for (const s of overall.scores) if (s > 0) { let bin = Math.floor(s / 10) * 10; if (bin === 100) bin = 90; if (scoreDist[bin] !== undefined) scoreDist[bin]++; }

  const peak = monthlyOverview.length ? monthlyOverview.reduce((a, b) => (b.activity_summary.total_titles_completed > a.activity_summary.total_titles_completed ? b : a)) : null;

  const [pTitle, pDesc] = determinePersona({
    episodes_watched: overall.episodes_watched,
    anime_completed: overall.anime_completed,
    formats: overall.formats,
    average_score: avg,
    top_genres: topGenresList,
  });

  const covers = new Set();
  for (const m of Object.values(monthly)) { for (const a of m.anime) if (a.cover_image) covers.add(a.cover_image); for (const mg of m.manga) if (mg.cover_image) covers.add(mg.cover_image); }

  ongoing.anime.sort((a, b) => b.progress - a.progress);
  ongoing.manga.sort((a, b) => b.progress - a.progress);

  const sortedStudios = Object.entries(overall.studios).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sortedFormats = Object.entries(overall.formats).sort((a, b) => b[1] - a[1]);
  const sortedCountries = Object.entries(overall.countries).sort((a, b) => b[1] - a[1]);

  return {
    year,
    persona: { title: pTitle, description: pDesc },
    overall: {
      anime_completed: overall.anime_completed, manga_completed: overall.manga_completed,
      episodes_watched: overall.episodes_watched, minutes_watched: overall.minutes_watched,
      total_days_watched: +(overall.minutes_watched / 1440).toFixed(1),
      chapters_read: overall.chapters_read, volumes_read: overall.volumes_read,
      rewatches: overall.rewatches, rereads: overall.rereads,
      average_score: avg, anime_avg_score: animeAvg, manga_avg_score: mangaAvg,
      top_genres: Object.fromEntries(topGenresList),
      top_studios: Object.fromEntries(sortedStudios),
      formats: Object.fromEntries(sortedFormats),
      countries: Object.fromEntries(sortedCountries),
      score_distribution: scoreDist,
      best_anime: bestAnime, best_manga: bestManga,
      top_anime_list: allAnime.slice(0, 3), top_manga_list: allManga.slice(0, 3),
      collage_covers: [...covers].slice(0, 50),
      activity_counts: activityCounts,
    },
    ongoing,
    highlights: { peak_month: peak },
    favorites: favoritesData,
    monthly_overview: monthlyOverview,
  };
}

/* ---------- HTML rendering (port of report_content.html) ---------- */
function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function renderReportContent(data) {
  const { year, persona, overall, ongoing, favorites, monthly_overview } = data;
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  const topGenre = Object.keys(overall.top_genres)[0] || "N/A";
  const topStudio = Object.keys(overall.top_studios)[0] || "N/A";
  const topRegion = Object.keys(overall.countries)[0] || "JP";
  const topFormat = Object.keys(overall.formats)[0] || "N/A";

  function card3D(item, label) {
    if (!item) return "";
    const studio = item.studios?.[0]?.name ? `<span class="truncate max-w-[120px] text-accent">${esc(item.studios[0].name)}</span><span class="w-1 h-1 bg-gray-500 rounded-full"></span>` : "";
    return `<div class="card-3d-wrapper w-full max-w-[320px] md:max-w-[360px] aspect-[2/3] mx-auto hover-target group perspective-1000">
      <div class="card-3d relative w-full h-full rounded-[2rem] overflow-hidden shadow-2xl bg-[#0a0a0a] border border-white/10">
        <img src="${esc(item.cover_image)}" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
        <div class="absolute inset-x-0 bottom-0 p-6 md:p-8 flex flex-col justify-end h-full z-20">
          <div class="absolute top-6 right-6"><span class="bg-accent/10 backdrop-blur-md border border-accent/20 text-accent px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase">${esc(label)}</span></div>
          <div class="space-y-3">
            <h3 class="font-display text-2xl md:text-4xl font-bold leading-[1.1] text-white line-clamp-3">${esc(item.title)}</h3>
            <div class="flex items-center gap-3 text-xs font-mono text-gray-300 border-t border-white/20 pt-3">${studio}<span class="uppercase tracking-wider">${esc(item.format||"MANGA")}</span></div>
            <div class="flex items-baseline gap-1"><span class="text-4xl md:text-5xl font-bold text-white">${esc(item.score)}</span><span class="text-[10px] text-gray-400 font-mono">/100</span></div>
          </div>
        </div>
      </div>
    </div>`;
  }
  function miniCard(item, type) {
    if (!item) return "";
    return `<div class="w-32 md:w-48 flex-shrink-0 group"><div class="aspect-[2/3] overflow-hidden rounded-lg mb-3 bg-white/5 relative"><img src="${esc(item.cover_image)}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /></div><div class="font-bold truncate text-xs md:text-sm">${esc(item.title)}</div><div class="text-[10px] text-gray-500 font-mono tracking-wider">${esc(type)}</div></div>`;
  }

  const collage = overall.collage_covers?.length ? `<div class="collage-bg">${overall.collage_covers.map(s=>`<div class="collage-item" style="background-image:url('${esc(s)}')"></div>`).join("")}</div>` : "";
  const ongoingSection = (ongoing.anime.length || ongoing.manga.length) ? `
  <section class="scroll-section relative overflow-hidden" id="grindSection">
    <div id="grindBg" class="absolute inset-0 bg-[#050505] bg-cover bg-center opacity-30 blur-sm scale-105" style="background-image:url('${esc((ongoing.anime[0]||ongoing.manga[0])?.cover_image||"")}')"></div>
    <div class="absolute inset-0 bg-gradient-to-b from-[#030303] via-transparent to-[#030303]"></div>
    <div class="relative z-10 px-6 md:px-16 mb-8"><h2 class="section-title text-4xl md:text-6xl">The Grind</h2><p class="font-mono text-gray-400 mt-4 text-sm">Ongoing obsessions.</p></div>
    <div class="relative z-10 flex gap-4 md:gap-8 px-6 md:px-16 overflow-x-auto no-scrollbar pb-12 snap-x items-end min-h-[400px]">
      ${[...ongoing.anime, ...ongoing.manga].slice(0,15).map((item,i)=>`
        <div class="grind-card flex-shrink-0 w-60 md:w-72 group snap-start" data-cover="${esc(item.cover_image)}" style="animation:fadeInUp 0.6s ease-out forwards;animation-delay:${i*0.1}s">
          <div class="aspect-[3/4] overflow-hidden rounded-[2rem] mb-4 relative shadow-2xl border-2 border-white/5 group-hover:border-accent transition-all">
            <img src="${esc(item.cover_image)}" class="w-full h-full object-cover" loading="lazy" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
            <div class="absolute bottom-6 left-6 right-6">
              <div class="text-white font-display font-bold text-3xl md:text-4xl leading-none mb-2">${esc(item.progress)}</div>
              <div class="flex items-center justify-between"><div class="text-[10px] text-accent font-mono tracking-[0.2em] uppercase">${item.progress>100?"Episodes":"Chapters"}</div><div class="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold">${esc(item.score||"-")}</div></div>
            </div>
          </div>
          <div class="font-bold truncate text-lg md:text-xl text-center text-gray-400 group-hover:text-white px-2">${esc(item.title)}</div>
        </div>`).join("")}
    </div>
  </section>` : "";

  const castSection = favorites?.characters?.length ? `
  <section class="scroll-section overflow-hidden">
    <div class="px-6 md:px-16 mb-8"><h2 class="section-title text-4xl md:text-6xl">The Cast</h2></div>
    <div class="flex gap-6 md:gap-8 px-6 md:px-16 overflow-x-auto no-scrollbar pb-12">
      ${favorites.characters.map(c=>`
        <div class="flex-shrink-0 w-40 md:w-64 group">
          <div class="overflow-hidden rounded-lg aspect-[3/4] mb-4 relative"><img src="${esc(c.image.large)}" class="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" /><div class="absolute inset-0 ring-1 ring-inset ring-white/10"></div></div>
          <div class="font-display text-lg md:text-2xl group-hover:text-accent truncate">${esc(c.name.full)}</div>
        </div>`).join("")}
    </div>
  </section>` : "";

  const timeline = monthly_overview.filter(m=>m.activity_summary.total_titles_completed>0).map((m,idx)=>{
    const bg = m.top_anime?.banner_image || m.top_anime?.cover_image || "";
    const alignRight = idx%2!==0;
    return `<section class="min-h-[50vh] md:min-h-[70vh] relative overflow-hidden group flex items-center py-12 md:py-0">
      <div class="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none">${bg?`<img src="${esc(bg)}" class="w-full h-full object-cover grayscale blur-sm scale-110 group-hover:scale-100 transition-transform duration-[2s]" />`:""}</div>
      <div class="relative z-10 px-6 md:px-8 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24 items-center">
        <div class="${alignRight?'md:order-2 md:text-right':''}">
          <div class="font-mono text-accent mb-2 text-xl md:text-2xl opacity-50">0${m.month}</div>
          <h3 class="font-display text-5xl md:text-9xl font-bold mb-4 opacity-10 group-hover:opacity-100 transition-all duration-500 text-white">${months[m.month-1]}</h3>
          <div class="flex flex-col ${alignRight?'md:items-end':'items-start'} gap-2">
            <div class="font-mono text-gray-400 text-sm md:text-base border-l-2 border-white/20 pl-4 ${alignRight?'md:border-l-0 md:border-r-2 md:pl-0 md:pr-4':''}">${m.activity_summary.total_titles_completed} TITLES CONSUMED</div>
            <div class="flex gap-2 mt-2 flex-wrap">${m.top_genres.slice(0,3).map(g=>`<span class="text-[10px] md:text-xs font-mono border border-white/20 px-2 py-1 rounded-full text-gray-400">${esc(g)}</span>`).join("")}</div>
          </div>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-4 ${alignRight?'md:justify-start':'md:justify-end'} no-scrollbar">${miniCard(m.top_anime,"ANIME")}${miniCard(m.top_manga,"MANGA")}</div>
      </div>
    </section>`;
  }).join("");

  return `
<style>@keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}</style>
<section class="scroll-section h-screen items-center text-center overflow-hidden relative justify-center">
  ${collage}
  <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#030303]/80 to-[#030303]"></div>
  <div class="z-10 relative mix-blend-difference px-4 w-full">
    <div class="font-mono text-xs md:text-sm tracking-[0.5em] mb-4 text-accent">The Anime Archive // ${year}</div>
    <h1 class="hero-title break-words text-5xl md:text-9xl lg:text-[12rem] leading-none">${esc(data.username)}</h1>
    <div class="mt-8 font-display text-2xl md:text-5xl italic text-gray-400">${esc(persona.title)}</div>
    <p class="mt-6 font-mono text-gray-500 max-w-md mx-auto text-xs md:text-sm leading-relaxed px-4">${esc(persona.description)}</p>
  </div>
</section>

<section class="scroll-section bg-[#030303] py-12 md:py-24 relative overflow-hidden">
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-radial from-white/5 to-transparent opacity-20 blur-3xl pointer-events-none"></div>
  <div class="max-w-[1600px] mx-auto w-full px-6 relative z-10">
    <div class="text-center mb-24 md:mb-40 relative">
      <h2 class="hero-title text-6xl md:text-[8rem] opacity-[0.03] font-bold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none whitespace-nowrap">YEAR IN REVIEW</h2>
      <h2 class="section-title text-5xl md:text-8xl relative z-10">Highlights</h2>
      <div class="w-px h-24 bg-gradient-to-b from-accent to-transparent mx-auto mt-8"></div>
    </div>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-16 items-stretch">
      <div class="group relative overflow-hidden rounded-[2rem] border border-white/10">
        <div class="absolute inset-0 z-0">${overall.best_anime?.banner_image?`<img src="${esc(overall.best_anime.banner_image)}" class="w-full h-full object-cover opacity-30 blur-sm scale-110" />`:overall.best_anime?.cover_image?`<img src="${esc(overall.best_anime.cover_image)}" class="w-full h-full object-cover opacity-30 blur-md scale-110" />`:`<div class="w-full h-full bg-gradient-to-br from-blue-900/20 to-transparent"></div>`}<div class="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/80 to-transparent"></div><div class="absolute inset-0 bg-gradient-to-r from-[#030303]/90 to-transparent"></div></div>
        <div class="relative z-10 p-8 md:p-12 flex flex-col h-full">
          <h3 class="font-display text-4xl md:text-6xl mb-12 text-white/90 flex items-center gap-4"><span class="w-12 h-1 bg-accent block"></span> ANIME</h3>
          <div class="flex flex-col md:flex-row gap-6 md:gap-12 items-center md:items-start flex-1">
            <div class="shrink-0 flex justify-center w-full md:w-auto" style="min-width:280px">${card3D(overall.best_anime,"AOTY")}</div>
            <div class="flex flex-col gap-8 w-full">
              <div><div class="font-mono text-xs text-accent tracking-widest mb-1 flex items-center gap-2"><span class="w-1 h-1 bg-white rounded-full"></span> TIME LOST</div><div class="font-display text-4xl md:text-5xl font-bold">${Number(overall.minutes_watched).toLocaleString()}<span class="text-lg text-gray-500 ml-2 font-normal italic">min</span></div></div>
              <div><div class="font-mono text-xs text-accent tracking-widest mb-1 flex items-center gap-2"><span class="w-1 h-1 bg-white rounded-full"></span> EPISODES</div><div class="font-display text-4xl md:text-5xl font-bold">${Number(overall.episodes_watched).toLocaleString()}</div></div>
              <div><div class="font-mono text-xs text-accent tracking-widest mb-1 flex items-center gap-2"><span class="w-1 h-1 bg-white rounded-full"></span> AVG SCORE</div><div class="font-display text-4xl md:text-5xl font-bold">${overall.anime_avg_score||"-"}</div></div>
              <div class="mt-auto pt-8 border-t border-white/10"><div class="font-mono text-xs text-gray-400 mb-2">MOST WATCHED GENRE</div><div class="text-2xl font-bold text-white">${esc(topGenre)}</div></div>
            </div>
          </div>
        </div>
      </div>
      <div class="group relative overflow-hidden rounded-[2rem] border border-white/10">
        <div class="absolute inset-0 z-0">${overall.best_manga?.banner_image?`<img src="${esc(overall.best_manga.banner_image)}" class="w-full h-full object-cover opacity-30 blur-sm scale-110" />`:overall.best_manga?.cover_image?`<img src="${esc(overall.best_manga.cover_image)}" class="w-full h-full object-cover opacity-30 blur-md scale-110" />`:`<div class="w-full h-full bg-gradient-to-bl from-red-900/20 to-transparent"></div>`}<div class="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/80 to-transparent"></div><div class="absolute inset-0 bg-gradient-to-l from-[#030303]/90 to-transparent"></div></div>
        <div class="relative z-10 p-8 md:p-12 flex flex-col h-full">
          <h3 class="font-display text-4xl md:text-6xl mb-12 text-white/90 flex items-center justify-end gap-4">MANGA <span class="w-12 h-1 bg-[#ff8080] block"></span></h3>
          <div class="flex flex-col md:flex-row-reverse gap-6 md:gap-12 items-center md:items-start flex-1">
            <div class="shrink-0 flex justify-center w-full md:w-auto" style="min-width:280px">${card3D(overall.best_manga,"MOTY")}</div>
            <div class="flex flex-col gap-8 w-full text-left md:text-right items-start md:items-end">
              <div><div class="font-mono text-xs text-[#ff8080] tracking-widest mb-1 flex items-center gap-2 md:flex-row-reverse"><span class="w-1 h-1 bg-white rounded-full"></span> READING</div><div class="font-display text-4xl md:text-5xl font-bold">${Number(overall.chapters_read).toLocaleString()}<span class="text-lg text-gray-500 ml-2 font-normal italic">ch</span></div></div>
              <div><div class="font-mono text-xs text-[#ff8080] tracking-widest mb-1 flex items-center gap-2 md:flex-row-reverse"><span class="w-1 h-1 bg-white rounded-full"></span> VOLUMES</div><div class="font-display text-4xl md:text-5xl font-bold">${Number(overall.volumes_read).toLocaleString()}</div></div>
              <div><div class="font-mono text-xs text-[#ff8080] tracking-widest mb-1 flex items-center gap-2 md:flex-row-reverse"><span class="w-1 h-1 bg-white rounded-full"></span> AVG SCORE</div><div class="font-display text-4xl md:text-5xl font-bold">${overall.manga_avg_score||"-"}</div></div>
              <div class="mt-auto pt-8 border-t border-white/10 w-full"><div class="font-mono text-xs text-gray-400 mb-2">FAVORITE FORMAT</div><div class="text-2xl font-bold text-white">${esc(topFormat)}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 pt-20 mt-16 relative">
      <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      <div class="text-center"><div class="font-display text-4xl md:text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">${overall.total_days_watched}</div><div class="font-mono text-xs md:text-sm text-accent tracking-widest mt-2 border-t border-white/10 inline-block pt-2 px-4">DAYS LOST</div></div>
      <div class="text-center"><div class="font-display text-4xl md:text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">${overall.average_score}</div><div class="font-mono text-xs md:text-sm text-accent tracking-widest mt-2 border-t border-white/10 inline-block pt-2 px-4">OVERALL SCORE</div></div>
      <div class="text-center"><div class="font-display text-3xl md:text-4xl font-bold tracking-tighter text-accent uppercase line-clamp-1">${esc(topStudio)}</div><div class="font-mono text-xs md:text-sm text-gray-500 tracking-widest mt-2 inline-block px-4">TOP STUDIO</div></div>
      <div class="text-center"><div class="font-display text-3xl md:text-4xl font-bold tracking-tighter text-gray-400 uppercase line-clamp-1">${esc(topRegion)}</div><div class="font-mono text-xs md:text-sm text-gray-500 tracking-widest mt-2 inline-block px-4">TOP REGION</div></div>
    </div>
  </div>
</section>

<section class="scroll-section">
  <div class="max-w-[1400px] mx-auto w-full px-4 md:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-stretch">
    <div class="bg-white/5 border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-8 flex flex-col items-center justify-center min-h-[350px]"><h2 class="section-title text-2xl md:text-3xl mb-8 text-center">Format<br><span class="text-accent">Distribution</span></h2><div class="relative w-full h-full flex-1 min-h-[250px]"><canvas id="formatChart"></canvas></div></div>
    <div class="bg-white/5 border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-8 flex flex-col justify-center min-h-[350px]"><h2 class="section-title text-2xl md:text-3xl mb-8 text-center">Score<br><span class="text-[#ff8080]">Frequency</span></h2><div class="relative w-full h-full flex-1 min-h-[250px]"><canvas id="scoreChart"></canvas></div></div>
    <div class="bg-white/5 border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-8 flex flex-col items-center justify-center min-h-[350px]"><h2 class="section-title text-2xl md:text-3xl mb-8 text-center">Genre<br><span class="text-blue-400">Spectrum</span></h2><div class="relative w-full h-full flex-1 min-h-[250px]"><canvas id="genreChart"></canvas></div></div>
    <div class="bg-white/5 border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-8 flex flex-col justify-center min-h-[350px]"><h2 class="section-title text-2xl md:text-3xl mb-8 text-center">Monthly<br><span class="text-purple-400">Rhythm</span></h2><div class="relative w-full h-full flex-1 min-h-[250px]"><canvas id="activityChart"></canvas></div></div>
  </div>
</section>

${ongoingSection}
${castSection}

<div class="relative py-12 md:py-20">${timeline}</div>

<section class="scroll-section h-screen items-center justify-center bg-[#050505] text-center px-4">
  <h2 class="font-display text-4xl md:text-8xl mb-8">Your ${year}.<br>Captured.</h2>
  <p class="font-mono text-sm text-gray-500 max-w-md mx-auto">Share your Wrapped with friends — link copied from your browser URL.</p>
  <div class="mt-8 font-mono text-xs text-gray-600">Powered by Cloudflare Workers · AniList API</div>
</section>
`;
}

/* ---------- index HTML ---------- */
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>AniList Wrapped '25</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/gh/studio-freight/lenis@1.0.29/bundled/lenis.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
<script src="https://unpkg.com/split-type"></script>
<link rel="stylesheet" href="/css/styles.css" />
</head>
<body class="bg-[#030303] text-white">
<div id="cursor-dot"></div><div id="cursor-outline"></div>
<div class="noise-overlay"></div>
<div id="gate" class="fixed inset-0 z-50 bg-[#030303] flex items-center justify-center">
  <div class="text-center space-y-8">
    <h1 class="font-display text-5xl italic opacity-0" id="gateTitle">The Anime Archive</h1>
    <form id="userForm" class="opacity-0">
      <input id="username" type="text" placeholder="USERNAME" class="bg-transparent border-b border-white/30 text-center py-2 font-mono outline-none uppercase tracking-widest focus:border-white transition-colors" />
      <div class="flex items-center justify-center gap-3 mt-6">
        <input id="year" type="number" value="" min="2000" max="2030" class="w-24 bg-transparent border border-white/20 text-center py-2 font-mono outline-none focus:border-white transition-colors text-sm" />
        <span class="font-mono text-xs text-gray-500">YEAR</span>
      </div>
      <button type="submit" class="block mx-auto mt-8 font-mono text-xs border border-white/20 px-6 py-2 hover:bg-white hover:text-black transition-colors">ENTER</button>
    </form>
    <script>document.getElementById('year').value=new Date().getFullYear();const p=new URLSearchParams(location.search);if(p.get('year'))document.getElementById('year').value=p.get('year');if(p.get('username'))document.getElementById('username').value=p.get('username');</script>
    <div id="loader" class="hidden font-mono text-xs text-blue-300 animate-pulse">CONNECTING...</div>
    <div id="error" class="hidden font-mono text-xs text-red-500"></div>
  </div>
</div>
<main id="app" class="opacity-0"></main>
<script src="/js/app.js"></script>
</body>
</html>`;

/* ---------- fetch handler ---------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (path === "/health") return new Response(JSON.stringify({ status: "ok", message: "Server is running on Cloudflare Workers" }), { headers: { "Content-Type": "application/json", ...cors } });

    if (path === "/" || path === "/index.html") {
      return new Response(INDEX_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", ...cors } });
    }

    if (path === "/api/rewind") {
      const username = url.searchParams.get("username");
      const yearParam = url.searchParams.get("year");
      const year = yearParam ? parseInt(yearParam, 10) : new Date().getUTCFullYear();
      if (!username) return new Response(JSON.stringify({ error: "Username is required" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });

      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      const cached = await cache.match(cacheKey);
      if (cached) {
        const hdr = new Headers(cached.headers); hdr.set("X-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers: hdr });
      }

      try {
        const [animeRes, mangaRes, favRes] = await Promise.all([
          fetchGql(ANIME_QUERY, { username }).then(d => d.MediaListCollection).catch(() => ({ lists: [] })),
          fetchGql(MANGA_QUERY, { username }).then(d => d.MediaListCollection).catch(() => ({ lists: [] })),
          fetchGql(FAVS_QUERY, { username }).then(d => ({ characters: d.User.favourites.characters.nodes, staff: d.User.favourites.staff.nodes })).catch(() => ({ characters: [], staff: [] })),
        ]);
        const result = buildRewind(animeRes, mangaRes, favRes, year);
        const shareId = Math.random().toString(36).slice(2, 10);
        result.shareId = shareId;
        result.username = username;
        result.generatedAt = new Date().toISOString();
        shareCache.set(shareId, result);

        const shareCacheUrl = new URL(request.url);
        shareCacheUrl.pathname = "/api/share";
        shareCacheUrl.search = `?shareId=${shareId}`;
        try { await caches.default.put(new Request(shareCacheUrl.toString()), new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } })); } catch(e) {}

        const html = renderReportContent(result);
        const body = JSON.stringify({ html, data: result });
        const resp = new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600", ...cors } });
        ctx.waitUntil(cache.put(cacheKey, resp.clone()));
        return resp;
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
      }
    }

    if (path === "/api/share") {
      const shareId = url.searchParams.get("shareId");
      let data = shareCache.get(shareId);
      if (!data) {
        const cached = await caches.default.match(new Request(url.toString()));
        if (cached) { try { data = JSON.parse(await cached.text()); shareCache.set(shareId, data); } catch(_){} }
      }
      if (!data) return new Response(JSON.stringify({ error: "Share not found" }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", ...cors } });
    }

    if (path === "/api/proxy") {
      const target = url.searchParams.get("url");
      if (!target) return new Response(JSON.stringify({ error: "URL is required" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
      try {
        const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
        const buf = await r.arrayBuffer();
        return new Response(buf, { headers: { "Content-Type": r.headers.get("content-type") || "image/jpeg", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400" } });
      } catch (e) { return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json", ...cors } }); }
    }

    if (env.ASSETS) {
      try {
        const assetResp = await env.ASSETS.fetch(request);
        if (assetResp.status !== 404) return assetResp;
      } catch (_) {}
    }

    return new Response(JSON.stringify({ error: "Not found", path }), { status: 404, headers: { "Content-Type": "application/json", ...cors } });
  },
};
