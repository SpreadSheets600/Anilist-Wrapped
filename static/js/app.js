class App {
	constructor() {
		this.api = "/api";
		this.data = null;
		this.dom = {
			gate: document.getElementById("gate"),
			form: document.getElementById("userForm"),
			app: document.getElementById("app"),
			cursorDot: document.getElementById("cursor-dot"),
			cursorOutline: document.getElementById("cursor-outline"),
		};
		this.isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
		if (this.isTouch) {
			document.body.classList.add("touch-device");
			this.dom.cursorDot.style.display = "none";
			this.dom.cursorOutline.style.display = "none";
		}
		this.init();
	}

	init() {
		if (!this.isTouch) this.initCursor();
		this.initGateAnimation();
		this.dom.form.addEventListener("submit", (e) => this.handleSubmit(e));
		this.lenis = new Lenis({
			duration: 1.2,
			easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
			direction: "vertical",
			gestureDirection: "vertical",
			smooth: true,
			mouseMultiplier: 1,
			smoothTouch: false,
			touchMultiplier: 2,
		});
		const raf = (time) => {
			this.lenis.raf(time);
			requestAnimationFrame(raf);
		};
		requestAnimationFrame(raf);
	}

	initCursor() {
		window.addEventListener("mousemove", (e) => {
			const posX = e.clientX;
			const posY = e.clientY;
			this.dom.cursorDot.style.left = `${posX}px`;
			this.dom.cursorDot.style.top = `${posY}px`;
			this.dom.cursorOutline.animate({ left: `${posX}px`, top: `${posY}px` }, { duration: 500, fill: "forwards" });
		});
		document.addEventListener("mouseover", (e) => {
			if (e.target.closest("a, button, input, .hover-target")) document.body.classList.add("hover-target");
			else document.body.classList.remove("hover-target");
		});
	}

	initGateAnimation() {
		gsap.to("#gateTitle", { opacity: 1, duration: 2, delay: 0.5, ease: "power2.out" });
		gsap.to("#userForm", { opacity: 1, duration: 2, delay: 1, ease: "power2.out" });
		const params = new URLSearchParams(window.location.search);
		if (params.get("username")) document.getElementById("username").value = params.get("username");
		const yearInput = document.getElementById("year");
		if (params.get("year")) yearInput.value = params.get("year");
		else yearInput.value = new Date().getFullYear();
	}

	// ---------- AniList direct fetch (bypasses Cloudflare IP block) ----------
	ANIME_QUERY = `query ($username: String) { MediaListCollection(userName: $username, type: ANIME) { lists { entries { score progress repeat status updatedAt completedAt { year month } media { title { english romaji native } duration format genres bannerImage coverImage { large } studios(isMain: true) { nodes { name } } } } } } }`;
	MANGA_QUERY = `query ($username: String) { MediaListCollection(userName: $username, type: MANGA) { lists { entries { score progress progressVolumes repeat status updatedAt completedAt { year month } media { title { english romaji native } countryOfOrigin genres bannerImage coverImage { large } } } } } }`;
	FAVS_QUERY = `query ($username: String) { User(name: $username) { favourites { characters(page: 1, perPage: 10) { nodes { name { full } image { large } } } staff(page: 1, perPage: 10) { nodes { name { full } image { large } primaryOccupations } } } } }`;

	async fetchGql(query, variables) {
		const r = await fetch("https://graphql.anilist.co", {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({ query, variables }),
		});
		if (!r.ok) {
			const t = await r.text();
			throw new Error(`AniList ${r.status}: ${t.slice(0, 400)}`);
		}
		const j = await r.json();
		if (j.errors) throw new Error(j.errors[0].message);
		return j.data;
	}

	determinePersona(stats) {
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

	buildRewind(animeData, mangaData, favoritesData, year) {
		const overall = { anime_completed: 0, manga_completed: 0, episodes_watched: 0, minutes_watched: 0, chapters_read: 0, volumes_read: 0, rewatches: 0, rereads: 0, scores: [], genres: {}, studios: {}, formats: {}, countries: {} };
		const monthly = {};
		const ongoing = { anime: [], manga: [] };
		const inc = (obj, k, v = 1) => (obj[k] = (obj[k] || 0) + v);
		const getMonthly = (m) => { if (!monthly[m]) monthly[m] = { anime: [], manga: [], genres: {} }; return monthly[m]; };
		const wasActiveInYear = (ts) => ts ? new Date(ts * 1000).getUTCFullYear() === year : false;
		const titleOf = (t) => t?.english || t?.romaji || t?.native || "Unknown";
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
				const obj = { title: titleOf(media.title), score: e.score, cover_image: media.coverImage?.large, banner_image: media.bannerImage, format: media.format || "UNKNOWN", studios: media.studios?.nodes || [] };
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
		const [pTitle, pDesc] = this.determinePersona({ episodes_watched: overall.episodes_watched, anime_completed: overall.anime_completed, formats: overall.formats, average_score: avg, top_genres: topGenresList });
		const covers = new Set();
		for (const m of Object.values(monthly)) { for (const a of m.anime) if (a.cover_image) covers.add(a.cover_image); for (const mg of m.manga) if (mg.cover_image) covers.add(mg.cover_image); }
		ongoing.anime.sort((a, b) => b.progress - a.progress);
		ongoing.manga.sort((a, b) => b.progress - a.progress);
		const sortedStudios = Object.entries(overall.studios).sort((a, b) => b[1] - a[1]).slice(0, 5);
		const sortedFormats = Object.entries(overall.formats).sort((a, b) => b[1] - a[1]);
		const sortedCountries = Object.entries(overall.countries).sort((a, b) => b[1] - a[1]);
		return {
			year, persona: { title: pTitle, description: pDesc },
			overall: {
				anime_completed: overall.anime_completed, manga_completed: overall.manga_completed, episodes_watched: overall.episodes_watched, minutes_watched: overall.minutes_watched, total_days_watched: +(overall.minutes_watched / 1440).toFixed(1),
				chapters_read: overall.chapters_read, volumes_read: overall.volumes_read, rewatches: overall.rewatches, rereads: overall.rereads,
				average_score: avg, anime_avg_score: animeAvg, manga_avg_score: mangaAvg,
				top_genres: Object.fromEntries(topGenresList), top_studios: Object.fromEntries(sortedStudios), formats: Object.fromEntries(sortedFormats), countries: Object.fromEntries(sortedCountries),
				score_distribution: scoreDist, best_anime: bestAnime, best_manga: bestManga, top_anime_list: allAnime.slice(0, 3), top_manga_list: allManga.slice(0, 3), collage_covers: [...covers].slice(0, 50), activity_counts: activityCounts,
			},
			ongoing, highlights: { peak_month: peak }, favorites: favoritesData, monthly_overview: monthlyOverview,
		};
	}

	async fetchDirect(username, year) {
		const [animeRes, mangaRes, favRes] = await Promise.all([
			this.fetchGql(this.ANIME_QUERY, { username }).then(d => d.MediaListCollection).catch(() => ({ lists: [] })),
			this.fetchGql(this.MANGA_QUERY, { username }).then(d => d.MediaListCollection).catch(() => ({ lists: [] })),
			this.fetchGql(this.FAVS_QUERY, { username }).then(d => ({ characters: d.User?.favourites?.characters?.nodes || [], staff: d.User?.favourites?.staff?.nodes || [] })).catch(() => ({ characters: [], staff: [] })),
		]);
		const result = this.buildRewind(animeRes, mangaRes, favRes, year);
		result.username = username;
		result.shareId = Math.random().toString(36).slice(2, 10);
		result.generatedAt = new Date().toISOString();
		return result;
	}

	async handleSubmit(e) {
		e.preventDefault();
		const username = document.getElementById("username").value.trim();
		const year = parseInt(document.getElementById("year").value, 10);
		const loader = document.getElementById("loader");
		const errorEl = document.getElementById("error");
		if (!username) return;
		loader.classList.remove("hidden");
		errorEl.classList.add("hidden");
		errorEl.textContent = "";
		try {
			let result, html;
			// Try server first (works for local Flask, may be blocked on Cloudflare)
			try {
				const res = await fetch(`${this.api}/rewind?username=${encodeURIComponent(username)}&year=${encodeURIComponent(year)}`);
				const json = await res.json();
				if (res.ok && json.data && (json.data.overall.anime_completed > 0 || json.data.overall.manga_completed > 0)) {
					result = json;
					this.data = result.data;
					html = result.html;
				} else if (res.ok && json.data) {
					// Server returned 0 data -> fallback to client direct (AniList) to double-check
					throw new Error("server_empty");
				} else {
					throw new Error(json.error || "server_error");
				}
			} catch (serverErr) {
				// Fallback: direct browser fetch to AniList (bypasses Cloudflare IP block)
				if (String(serverErr).includes("manually blocked") || String(serverErr).includes("server_")) {
					console.log("Server blocked/empty, falling back to direct AniList fetch");
				}
				const data = await this.fetchDirect(username, year);
				if (data.overall.anime_completed === 0 && data.overall.manga_completed === 0) {
					throw new Error(`No completed anime/manga found for ${username} in ${year}. Try a different year or check if lists are public.`);
				}
				this.data = data;
				// Generate HTML client-side by fetching rendered HTML from server if possible, else use minimal client render
				try {
					// Try to get server HTML for enriched layout; if fails, use client fallback
					const htmlRes = await fetch(`${this.api}/rewind?username=${encodeURIComponent(username)}&year=${encodeURIComponent(year)}&client=1`);
					if (htmlRes.ok) {
						const j = await htmlRes.json();
						html = j.html;
					}
				} catch {}
				if (!html) {
					// Minimal client-side HTML fallback - request server to render via /api/rewind with data? Instead fetch via debug
					// As fallback, use server's html if available, else show data-driven minimal view
					html = `<section class="scroll-section h-screen items-center text-center justify-center"><div class="z-10"><h1 class="hero-title text-6xl">${username}</h1><p class="font-mono text-gray-400 mt-4">${data.persona.title} - ${data.persona.description}</p><p class="font-mono text-sm text-gray-500 mt-8">${data.overall.anime_completed} anime • ${data.overall.manga_completed} manga • ${data.overall.episodes_watched} episodes</p></div></section>`;
					// For now, try to use server's html generation via direct POST to render (if server supports)
					// Actually we can just use the data and let render() handle charts - but we need full report html
					// To avoid duplicating large template, we will fetch server html via a new endpoint that accepts POST data (not yet implemented)
					// So we will generate a simple html and let the rest of the app handle it via direct data
					// Instead, we will store data and render via client-side method that builds same layout as server (simplified)
					// For now, if server html unavailable, we will show error and ask to retry
					if (!html || html.includes("The Casual Observer") && data.overall.anime_completed === 0) {
						// Try to build html via worker's render - we duplicate minimal version here
						html = await this.buildClientHtml(data);
					}
				}
				result = { data, html };
			}
			const url = new URL(window.location);
			url.searchParams.set("username", username);
			url.searchParams.set("year", String(year));
			history.replaceState({}, "", url);
			gsap.to(this.dom.gate, { yPercent: -100, duration: 1.5, ease: "power4.inOut", onComplete: () => this.render(result.html) });
		} catch (err) {
			errorEl.textContent = err.message;
			errorEl.classList.remove("hidden");
		} finally {
			loader.classList.add("hidden");
		}
	}

	async buildClientHtml(data) {
		// Fallback: fetch server's html rendering via POSTing data to /api/render (not implemented) -> generate minimal
		// For now, request the server's html by re-calling /api/rewind with a different username that will be cached? Instead we just return a placeholder that still allows charts to render
		// We will generate a basic report html that matches server's structure enough for charts
		const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		const o = data.overall;
		return `
		<section class="scroll-section h-screen items-center text-center justify-center relative overflow-hidden">
			<div class="z-10 relative px-4"><div class="font-mono text-xs tracking-[0.5em] mb-4 text-accent">The Anime Archive // ${data.year}</div><h1 class="hero-title text-6xl md:text-8xl">${esc(data.username)}</h1><div class="mt-8 font-display text-3xl italic text-gray-400">${esc(data.persona.title)}</div><p class="mt-4 font-mono text-gray-500 max-w-md mx-auto text-sm">${esc(data.persona.description)}</p></div>
		</section>
		<section class="scroll-section bg-[#030303] py-12"><div class="max-w-[1600px] mx-auto px-6"><div class="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12"><div class="text-center"><div class="font-display text-5xl font-bold">${o.anime_completed}</div><div class="font-mono text-xs text-accent">ANIME</div></div><div class="text-center"><div class="font-display text-5xl font-bold">${o.manga_completed}</div><div class="font-mono text-xs text-accent">MANGA</div></div><div class="text-center"><div class="font-display text-5xl font-bold">${o.episodes_watched}</div><div class="font-mono text-xs text-accent">EPISODES</div></div><div class="text-center"><div class="font-display text-5xl font-bold">${o.average_score}</div><div class="font-mono text-xs text-accent">SCORE</div></div></div></div></section>
		<section class="scroll-section"><div class="max-w-[1400px] mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-6"><div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[300px]"><h2 class="section-title text-2xl mb-4 text-center">Format<br><span class="text-accent">Distribution</span></h2><div class="relative w-full flex-1 min-h-[200px]"><canvas id="formatChart"></canvas></div></div><div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-center min-h-[300px]"><h2 class="section-title text-2xl mb-4 text-center">Score<br><span class="text-[#ff8080]">Frequency</span></h2><div class="relative w-full flex-1 min-h-[200px]"><canvas id="scoreChart"></canvas></div></div><div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center min-h-[300px]"><h2 class="section-title text-2xl mb-4 text-center">Genre<br><span class="text-blue-400">Spectrum</span></h2><div class="relative w-full flex-1 min-h-[200px]"><canvas id="genreChart"></canvas></div></div><div class="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-center min-h-[300px]"><h2 class="section-title text-2xl mb-4 text-center">Monthly<br><span class="text-purple-400">Rhythm</span></h2><div class="relative w-full flex-1 min-h-[200px]"><canvas id="activityChart"></canvas></div></div></div></section>
		<section class="scroll-section h-screen items-center justify-center bg-[#050505] text-center px-4"><h2 class="font-display text-4xl md:text-6xl mb-4">Your ${data.year}.<br>Captured.</h2><p class="font-mono text-sm text-gray-500">Data fetched directly from AniList (bypassing Cloudflare block).</p></section>`;
	}

	render(htmlContent) {
		this.dom.app.innerHTML = htmlContent;
		gsap.set(this.dom.app, { opacity: 1 });
		setTimeout(() => this.initVisuals(), 100);
		setTimeout(() => this.renderCharts(), 500);
	}

	statItem(value, label) {
		return `<div class="text-center stat-anim opacity-0 translate-y-10"><div class="font-display text-4xl md:text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">${value}</div><div class="font-mono text-xs md:text-sm text-accent tracking-widest mt-2 border-t border-white/10 inline-block pt-2 px-4">${label}</div></div>`;
	}

	card3D(item, label) {
		if (!item) return "";
		return `<div class="card-3d-wrapper w-full max-w-[300px] md:max-w-[320px] h-[450px] md:h-[550px] hover-target"><div class="card-3d relative w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-[#0a0a0a] group border border-white/5"><img src="${item.cover_image}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500"><div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div><div class="glare"></div><div class="absolute bottom-0 left-0 w-full p-6 md:p-8 translate-y-4 group-hover:translate-y-0 transition-transform duration-500"><div class="font-mono text-[10px] text-accent mb-3 tracking-[0.2em] uppercase border-l-2 border-accent pl-2">${label}</div><h3 class="font-display text-3xl md:text-4xl font-bold leading-none mb-3 line-clamp-2 shadow-black drop-shadow-lg">${item.title}</h3><div class="flex items-center gap-2"><span class="text-2xl font-bold">${item.score}</span><span class="text-xs text-gray-400 font-mono">SCORE</span></div></div></div></div>`;
	}

	monthSection(m, index) {
		if (m.activity_summary.total_titles_completed === 0) return "";
		const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
		const bg = m.top_anime?.banner_image || m.top_anime?.cover_image || "";
		const alignRight = index % 2 !== 0;
		const genrePills = m.top_genres.slice(0, 3).map((g) => `<span class="text-[10px] md:text-xs font-mono border border-white/20 px-2 py-1 rounded-full text-gray-400">${g}</span>`).join("");
		return `<section class="min-h-[50vh] md:min-h-[70vh] relative overflow-hidden group flex items-center py-12 md:py-0"><div class="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none"><img src="${bg}" class="w-full h-full object-cover grayscale blur-sm scale-110 group-hover:scale-100 transition-transform duration-[2s]"></div><div class="relative z-10 px-6 md:px-8 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24 items-center"><div class="${alignRight ? "md:order-2 md:text-right" : ""}"><div class="font-mono text-accent mb-2 text-xl md:text-2xl opacity-50">0${m.month}</div><h3 class="font-display text-5xl md:text-9xl font-bold mb-4 opacity-10 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0 text-white">${months[m.month - 1]}</h3><div class="flex flex-col ${alignRight ? "md:items-end" : "items-start"} gap-2"><div class="font-mono text-gray-400 text-sm md:text-base border-l-2 border-white/20 pl-4 ${alignRight ? "md:border-l-0 md:border-r-2 md:pl-0 md:pr-4" : ""}">${m.activity_summary.total_titles_completed} TITLES CONSUMED</div><div class="flex gap-2 mt-2 flex-wrap">${genrePills}</div></div></div><div class="flex gap-4 overflow-x-auto pb-4 ${alignRight ? "md:justify-start" : "md:justify-end"} no-scrollbar">${this.miniCard(m.top_anime, "ANIME")}${this.miniCard(m.top_manga, "MANGA")}</div></div></section>`;
	}

	miniCard(item, type) {
		if (!item) return "";
		return `<div class="w-32 md:w-48 flex-shrink-0 hover-target cursor-none group"><div class="aspect-[2/3] overflow-hidden rounded-lg mb-3 bg-white/5 relative"><img src="${item.cover_image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"><div class="absolute inset-0 ring-1 ring-inset ring-white/10 group-hover:ring-accent transition-all"></div></div><div class="font-bold truncate text-xs md:text-sm">${item.title}</div><div class="text-[10px] text-gray-500 font-mono tracking-wider">${type}</div></div>`;
	}

	renderCharts() {
		const formatCtx = document.getElementById("formatChart");
		if (formatCtx) {
			const formats = this.data.overall.formats;
			const labels = Object.keys(formats);
			const data = Object.values(formats);
			new Chart(formatCtx, { type: "doughnut", data: { labels, datasets: [{ data, backgroundColor: ["rgba(180,180,255,0.7)", "rgba(245,87,108,0.7)", "rgba(0,210,255,0.7)", "rgba(255,215,0,0.7)", "rgba(157,78,221,0.7)", "rgba(255,255,255,0.7)"], borderWidth: 0, hoverOffset: 10 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#888", font: { family: "JetBrains Mono", size: 10 }, boxWidth: 10, padding: 15 } } } } });
		}
		const scoreCtx = document.getElementById("scoreChart");
		if (scoreCtx) {
			const scores = this.data.overall.score_distribution;
			const labels = Object.keys(scores).map((k) => k + "+");
			const data = Object.values(scores);
			new Chart(scoreCtx, { type: "bar", data: { labels, datasets: [{ label: "Titles", data, backgroundColor: "#ff8080", borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: { color: "#888", font: { size: 10 } } }, y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888" } } }, plugins: { legend: { display: false } } } });
		}
		const genreCtx = document.getElementById("genreChart");
		if (genreCtx) {
			const genres = this.data.overall.top_genres;
			const labels = Object.keys(genres).slice(0, 6);
			const data = Object.values(genres).slice(0, 6);
			new Chart(genreCtx, { type: "polarArea", data: { labels, datasets: [{ data, backgroundColor: ["rgba(120,119,198,0.7)", "rgba(245,87,108,0.7)", "rgba(0,210,255,0.7)", "rgba(255,215,0,0.7)", "rgba(157,78,221,0.7)", "rgba(255,255,255,0.7)"], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { display: false, backdropColor: "transparent" }, pointLabels: { display: false } } }, plugins: { legend: { position: "bottom", labels: { color: "#888", font: { family: "JetBrains Mono", size: 10 }, boxWidth: 10, padding: 15 } } } } });
		}
		const activityCtx = document.getElementById("activityChart");
		if (activityCtx) {
			const counts = this.data.overall.activity_counts;
			const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			new Chart(activityCtx, { type: "bar", data: { labels, datasets: [{ label: "Activity", data: counts, backgroundColor: "#c084fc", borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, ticks: { color: "#888", font: { size: 10 } } }, y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888" } } }, plugins: { legend: { display: false } } } });
		}
	}

	initVisuals() {
		const splitTypes = document.querySelectorAll(".split-text");
		splitTypes.forEach((char) => {
			const text = new SplitType(char, { types: "chars,words" });
			gsap.from(text.chars, { scrollTrigger: { trigger: char, start: "top 80%" }, y: 50, opacity: 0, stagger: 0.02, duration: 1, ease: "power3.out" });
		});
		gsap.utils.toArray(".gs-reveal-up").forEach((elem) => { gsap.from(elem, { scrollTrigger: { trigger: elem, start: "top 85%", toggleActions: "play none none none" }, y: 60, opacity: 0, duration: 0.8, ease: "power3.out" }); });
		gsap.utils.toArray(".gs-reveal-left").forEach((elem) => { gsap.from(elem, { scrollTrigger: { trigger: elem, start: "top 80%", toggleActions: "play none none none" }, x: -100, opacity: 0, duration: 1, ease: "power3.out" }); });
		gsap.utils.toArray(".gs-reveal-right").forEach((elem) => { gsap.from(elem, { scrollTrigger: { trigger: elem, start: "top 80%", toggleActions: "play none none none" }, x: 100, opacity: 0, duration: 1, ease: "power3.out" }); });
		gsap.utils.toArray(".stat-anim").forEach((elem) => { gsap.to(elem, { scrollTrigger: { trigger: elem, start: "top 90%" }, y: 0, x: 0, opacity: 1, duration: 1, ease: "power3.out" }); });
		if (!this.isTouch) {
			const cards = document.querySelectorAll(".card-3d-wrapper");
			cards.forEach((wrapper) => {
				const card = wrapper.querySelector(".card-3d");
				const glare = wrapper.querySelector(".glare");
				wrapper.addEventListener("mousemove", (e) => {
					const rect = wrapper.getBoundingClientRect();
					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;
					const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -8;
					const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 8;
					gsap.to(card, { rotateX, rotateY, duration: 0.5, ease: "power2.out" });
					gsap.to(glare, { opacity: 0.6, backgroundPosition: `${(x / rect.width) * 100}% ${(y / rect.height) * 100}%`, duration: 0.5 });
				});
				wrapper.addEventListener("mouseleave", () => {
					gsap.to(card, { rotateX: 0, rotateY: 0, duration: 1, ease: "elastic.out(1, 0.5)" });
					gsap.to(glare, { opacity: 0, duration: 1 });
				});
			});
		}
		const grindCards = document.querySelectorAll(".grind-card");
		const grindBg = document.getElementById("grindBg");
		if (grindCards.length && grindBg) {
			let rafId = null;
			grindCards.forEach((card) => {
				card.addEventListener("mouseenter", () => {
					const img = card.getAttribute("data-cover");
					if (rafId) cancelAnimationFrame(rafId);
					rafId = requestAnimationFrame(() => {
						grindBg.style.backgroundImage = `url('${img}')`;
						grindBg.style.opacity = "0.5";
						grindBg.style.transform = "scale(1.1)";
					});
				});
			});
		}
		if (document.querySelector(".collage-bg")) {
			gsap.to(".collage-bg", { yPercent: -30, scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: 1 } });
		}
	}
}

const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/chart.js";
document.head.appendChild(script);
document.addEventListener("DOMContentLoaded", () => new App());
