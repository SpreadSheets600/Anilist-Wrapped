'use strict';
/* ════════════ THE ANIME ARCHIVE ════════════ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = {
  gate: $('#gate'), form: $('#form'), user: $('#username'), submit: $('#submit'),
  msg: $('#message'), loader: $('#loader'), loadLine: $('#loadLine'),
  app: $('#app'), hud: $('#hud'), hudBar: $('#hudProgress'),
  hudNum: $('#hudNum'), hudLabel: $('#hudLabel'), hudHome: $('#hudHome'),
};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const G = window.gsap && window.ScrollTrigger ? window.gsap : null;
if (G) G.registerPlugin(ScrollTrigger);
if (!G) document.documentElement.classList.add('static');
const NOW = new Date(), THIS_YEAR = NOW.getFullYear();
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON = MONTHS.map(m => m.slice(0, 3).toUpperCase());

/* ── utils ── */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (typeof u === 'string' && /^https:\/\/[^\s'"()<>]+$/.test(u)) ? u : '';
const fmt = n => Math.round(n).toLocaleString();
const plural = (n, one, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;
const sortMap = m => Object.entries(m).sort((a, b) => b[1] - a[1]);
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
const dayNo = d => (d?.year && d.month && d.day) ? Date.UTC(d.year, d.month - 1, d.day) / 864e5 : null;
const pretty = s => String(s || '').replaceAll('_', ' ');
const COUNTRY = { JP: 'Japan', KR: 'Korea', CN: 'China', TW: 'Taiwan' };

/* ── memory: what makes it yours ── */
const STORE = 'archive:v1';
const mem = {
  get() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* private mode */ } },
};

/* ════════════ ANILIST ════════════ */
/* ════════════ DATA → STORY ════════════ */
function completedIn(col, year) {
  const seen = new Set();
  return (col?.lists || []).flatMap(l => l.entries).filter(e => {
    if (!e.media || e.completedAt?.year !== year || seen.has(e.media.id)) return false;
    seen.add(e.media.id); return true;
  });
}
function activeYears(...cols) {
  const s = new Set();
  for (const c of cols) for (const l of c?.lists || []) for (const e of l.entries) if (e.completedAt?.year) s.add(e.completedAt.year);
  return [...s].sort((a, b) => b - a);
}

function persona(st) {
  const g = st.genres.slice(0, 3).map(x => x[0]);
  const movies = st.formats.find(f => f[0] === 'MOVIE')?.[1] || 0;
  let p;
  if (st.episodes > 1000) p = ['The Titan', 'You made a little room for a thousand different worlds.'];
  else if (st.a.length > 10 && movies / st.a.length > .3) p = ['The Cinephile', 'You find whole worlds in the space of a film.'];
  else if (st.avg >= 85 && st.all.length > 5) p = ['The Connoisseur', 'You know the feeling of finding a story that stays.'];
  else if (st.avg && st.avg < 60 && st.all.length > 20) p = ['The Critic', 'You know what moves you. And you’re honest when a story doesn’t.'];
  else if (g.includes('Romance') || g.includes('Drama')) p = ['The Hopeless Romantic', 'Somewhere between the little moments and the goodbyes, you found yourself.'];
  else if (g.includes('Sci-Fi') || g.includes('Mecha')) p = ['The Futurist', 'You dream of electric sheep and giant robots.'];
  else if (g.includes('Sports')) p = ['The Athlete', 'Training arcs are your daily motivation.'];
  else if (g.includes('Horror') || g.includes('Psychological')) p = ['The Edge Walker', 'You stare into the abyss, and it blinks first.'];
  else if (g.includes('Action') || g.includes('Adventure')) p = ['The Shonen Protagonist', 'You’re just one training arc away from greatness.'];
  else if (g.includes('Comedy') || g.includes('Slice of Life')) p = ['The Comfort Seeker', 'Small, warm stories. Big, quiet feelings.'];
  else p = ['The Casual Observer', 'You made room for the stories that found you.'];
  const t = [];
  if (st.binge && st.binge.days / st.binge.size < .5) t.push('Binge-capable');
  if (st.m.length > st.a.length) t.push('Page-turner');
  if (st.a.length >= 3 * Math.max(1, st.m.length) && st.a.length > 3) t.push('Screen-first');
  if (st.avg >= 80) t.push('Generous scorer');
  if (st.avg && st.avg < 65) t.push('Tough critic');
  if (st.genres.length >= 12) t.push('Genre-hopper');
  if (st.monthly.filter(x => x.length).length >= 10) t.push('Never not watching');
  if (st.rewatches + st.rereads > 0) t.push('Comes back to favourites');
  if (st.ongoing.length >= 8) t.push('Too many tabs open');
  return { name: p[0], desc: p[1], traits: (t.length ? t : ['One of a kind']).slice(0, 5) };
}

function build(data, year) {
  const { anime, manga, user } = data;
  const a = completedIn(anime, year), m = completedIn(manga, year), all = [...a, ...m];
  const monthly = Array.from({ length: 12 }, () => []);
  const genres = {}, formats = {}, studios = {}, countries = {}, mGenres = Array.from({ length: 12 }, () => ({}));
  let minutes = 0, episodes = 0, chapters = 0, volumes = 0, rewatches = 0, rereads = 0;
  for (const e of all) {
    const md = e.media, mo = e.completedAt.month;
    if (mo >= 1 && mo <= 12) monthly[mo - 1].push(e);
    for (const g of md.genres || []) { inc(genres, g); if (mo >= 1 && mo <= 12) inc(mGenres[mo - 1], g); }
    if (md.format) inc(formats, md.format);
    if (md.type === 'ANIME') {
      episodes += e.progress || 0; minutes += (e.progress || 0) * (md.duration || 24); rewatches += e.repeat || 0;
      for (const s of md.studios?.nodes || []) inc(studios, s.name);
    } else {
      chapters += e.progress || 0; volumes += e.progressVolumes || 0; rereads += e.repeat || 0;
      if (md.countryOfOrigin) inc(countries, md.countryOfOrigin);
    }
  }
  const rated = all.filter(e => e.score > 0).sort((x, y) => y.score - x.score);
  const avgOf = l => l.length ? l.reduce((n, e) => n + e.score, 0) / l.length : 0;
  const scoreBins = Array(10).fill(0);
  for (const e of rated) scoreBins[Math.min(9, Math.max(0, Math.ceil(e.score / 10) - 1))]++;

  let binge = null;
  for (const e of all) {
    const s = dayNo(e.startedAt), c = dayNo(e.completedAt);
    if (s == null || c == null || c < s) continue;
    const size = e.media.type === 'ANIME' ? e.media.episodes : e.media.chapters, days = c - s + 1;
    if (!size || size < 6) continue;
    if (!binge || days / size < binge.days / binge.size) binge = { e, days, size };
  }
  let hot = null;
  for (const e of rated) {
    if (!e.media.meanScore) continue;
    const diff = e.score - e.media.meanScore;
    if (!hot || Math.abs(diff) > Math.abs(hot.diff)) hot = { e, diff };
  }
  if (hot && Math.abs(hot.diff) < 12) hot = null;

  const ongoing = [...(anime?.lists || []), ...(manga?.lists || [])].flatMap(l => l.entries)
    .filter(e => e.media && ['CURRENT', 'REPEATING'].includes(e.status) && e.updatedAt && new Date(e.updatedAt * 1000).getFullYear() === year)
    .filter((e, i, arr) => arr.findIndex(x => x.media.id === e.media.id) === i)
    .sort((x, y) => y.updatedAt - x.updatedAt).slice(0, 16);

  const covers = all.map(e => safeUrl(e.media.coverImage?.large)).filter(Boolean);
  const st = {
    year, user, a, m, all, monthly, mGenres, rated, scoreBins, binge, hot, ongoing,
    genres: sortMap(genres), formats: sortMap(formats), studios: sortMap(studios), countries: sortMap(countries),
    minutes, episodes, chapters, volumes, rewatches, rereads,
    avg: avgOf(rated), aAvg: avgOf(rated.filter(e => e.media.type === 'ANIME')), mAvg: avgOf(rated.filter(e => e.media.type === 'MANGA')),
    bestA: rated.find(e => e.media.type === 'ANIME') || a[0], bestM: rated.find(e => e.media.type === 'MANGA') || m[0],
    covers, prev: completedIn(anime, year - 1).length + completedIn(manga, year - 1).length,
    years: activeYears(anime, manga),
  };
  st.persona = persona(st);
  return st;
}

/* ════════════ RENDER ════════════ */
const t = e => esc(e?.media?.title?.userPreferred || 'Untitled');
const cov = (e, big) => esc(safeUrl(big ? (e?.media.coverImage?.extraLarge || e?.media.coverImage?.large) : e?.media.coverImage?.large));
const split = (text) => esc(text).split(' ').map(w => `<span class="w"><span>${w}</span></span>`).join(' ');
const head = (n, label) => `<div class="sec-head"><span class="mono">${n}</span><span class="mono">${label}</span><span class="rule"></span></div>`;

function card3d(e, tag) {
  if (!e) return '';
  const md = e.media, studio = md.studios?.nodes?.[0]?.name;
  return `<div class="card3d-wrap"><a class="card3d" href="${esc(safeUrl(md.siteUrl))}" target="_blank" rel="noreferrer" data-cursor="OPEN">
    <img src="${cov(e, true)}" alt="${t(e)}" loading="lazy"><div class="glare"></div><span class="tag">${tag}</span>
    <div class="meta"><h4>${t(e)}</h4><div class="sub">${studio ? `<b>${esc(studio)}</b><span>·</span>` : ''}<span>${esc(pretty(md.format) || md.type)}</span></div>
    ${e.score ? `<div class="score">${e.score}<small>/100</small></div>` : ''}</div></a></div>`;
}

function statement(st) {
  const hrs = st.minutes / 60, days = hrs / 24;
  const time = days >= 1 ? `<b>${days.toFixed(1)} days</b>` : `<b>${Math.round(hrs)} hours</b>`;
  const words = [];
  if (st.minutes) words.push(`This year you spent ${time} inside other worlds.`);
  if (st.chapters) words.push(`You turned through <b class="rose">${fmt(st.chapters)} chapters.</b>`);
  if (st.genres[0]) words.push(`And somehow, it always came back to <b>${esc(st.genres[0][0])}.</b>`);
  if (!words.length) words.push(`A quiet year, so far. <b>The best ones usually start that way.</b>`);
  // wrap each word (keeping <b> groups intact) for scroll-scrubbed reveal
  return words.join(' ').replace(/(<b[^>]*>.*?<\/b>)|([^\s<]+)/g, (m0) => `<span class="wd">${m0}</span>`);
}

function donut(formats) {
  const colors = ['#d3f798', '#ff8a8a', '#f4d58d', '#7fd8c4', '#d4a5ff', '#f4f1ea', '#6d6a64'];
  const total = formats.reduce((n, f) => n + f[1], 0) || 1, R = 80, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = formats.slice(0, 7).map(([k, v], i) => {
    const len = v / total * C, gap = formats.length > 1 ? 3 : 0;
    const s = `<circle r="${R}" cx="100" cy="100" stroke="${colors[i]}" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" data-len="${Math.max(0, len - gap)}" data-format="${esc(k)}"></circle>`;
    off += len; return s;
  }).join('');
  return `<div class="donut"><svg viewBox="0 0 200 200" role="img" aria-label="Completed titles by format">${arcs}</svg><div class="center"><strong>${formats.length}</strong><span>FORMATS</span></div></div>
    <div class="legend">${formats.slice(0, 7).map(([k, v], i) => `<button type="button" data-format="${esc(k)}" aria-pressed="false" style="--c:${colors[i]}"><i></i>${esc(pretty(k))} · ${v}</button>`).join('')}</div><p class="format-detail" id="formatDetail" aria-live="polite">Hover or tap a format to explore your mix.</p>`;
}

function render(st) {
  const u = st.user, name = esc(u.name), p = st.persona;
  const peak = st.monthly.reduce((b, x, i) => x.length > st.monthly[b].length ? i : b, 0);
  const maxM = Math.max(1, ...st.monthly.map(x => x.length)), maxS = Math.max(1, ...st.scoreBins);
  const collage = (st.covers.length ? st.covers : []).slice(0, 54);
  const fillCollage = collage.length ? Array.from({ length: 54 }, (_, i) => collage[i % collage.length]) : [];
  const favChars = u.favourites?.characters?.nodes || [], favStaff = u.favourites?.staff?.nodes || [];
  const diff = st.all.length - st.prev;

  const db = mem.get(), key = `${u.name.toLowerCase()}|${st.year}`, snap = db.snaps?.[key];
  let since = '';
  if (snap) {
    const when = new Date(snap.at).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    const d = st.all.length - snap.count;
    since = d > 0 ? `+${plural(d, 'NEW FINISH', 'NEW FINISHES')} SINCE YOU WERE LAST HERE · ${when.toUpperCase()}`
      : d < 0 ? `${d} SINCE ${when.toUpperCase()}` : `NOTHING NEW SINCE ${when.toUpperCase()} - YOUR STORY, SAVED HERE`;
  }

  const S = [];
  /* 00 - HERO */
  S.push(`<section class="sec hero" data-ch="ARCHIVE">
    <div class="collage" id="reportCoverWall" aria-hidden="true">${fillCollage.map(c => `<div style="background-image:url('${esc(c)}')"></div>`).join('')}</div>
    <div class="hero-inner">
      ${safeUrl(u.avatar?.large) ? `<img class="avatar" src="${esc(safeUrl(u.avatar.large))}" alt="">` : ''}
      <div class="mono" data-fade>THE ANIME ARCHIVE // ${st.year}</div>
      <h1 class="hero-name" data-chars>${name}</h1>
      <div class="hero-persona" data-fade>${esc(p.name)}</div>
      <p class="hero-desc" data-fade>${esc(p.desc)}</p>
    </div>
    <div class="scroll-cue mono"><span>SCROLL</span><i></i></div>
  </section>`);

  /* 01 - PROLOGUE */
  S.push(`<section class="sec prologue" data-ch="PROLOGUE">
    ${head('01', 'THE PROLOGUE')}
    <p class="statement" data-scrub>${statement(st)}</p>
    <div class="counters">
      <div><strong data-count="${st.all.length}">0</strong><span class="mono">STORIES FINISHED</span></div>
      <div><strong data-count="${st.episodes}">0</strong><span class="mono">EPISODES</span></div>
      <div><strong data-count="${st.chapters}">0</strong><span class="mono">CHAPTERS</span></div>
      <div><strong data-count="${Math.round(st.minutes / 60)}">0</strong><span class="mono">HOURS WATCHED</span></div>
    </div>
  </section>`);

  /* 02 - HIGHLIGHTS */
  S.push(`<section class="sec highlights" data-ch="HIGHLIGHTS">
    <div class="ghost-title" aria-hidden="true">YEAR IN REVIEW</div>
    ${head('02', 'HIGHLIGHTS')}
    <div class="hl-grid">
      <div class="hl" data-from="left">
        <div class="hl-bg">${st.bestA ? `<img src="${esc(safeUrl(st.bestA.media.bannerImage) || safeUrl(st.bestA.media.coverImage?.large))}" alt="">` : ''}</div>
        <h3><i></i>ANIME</h3>
        ${card3d(st.bestA, st.rated.some(e => e.media.type === 'ANIME') ? 'HIGHEST RATED' : 'FROM YOUR YEAR')}
        <div class="hl-stats">
          <div><span class="mono">TIME IN OTHER WORLDS</span><strong><span data-count="${st.minutes}">0</span><small>min</small></strong></div>
          <div><span class="mono">COMPLETED</span><strong data-count="${st.a.length}">0</strong></div>
          <div><span class="mono">AVG SCORE</span><strong class="${st.aAvg ? '' : 'unscored'}">${st.aAvg ? st.aAvg.toFixed(1) : 'Not rated yet'}</strong></div>
          <div class="last"><span class="mono">MOST WATCHED STUDIO</span><strong>${esc(st.studios[0]?.[0] || '-')}</strong></div>
        </div>
      </div>
      <div class="hl flip" data-from="right">
        <div class="hl-bg">${st.bestM ? `<img src="${esc(safeUrl(st.bestM.media.bannerImage) || safeUrl(st.bestM.media.coverImage?.large))}" alt="">` : ''}</div>
        <h3>MANGA<i></i></h3>
        ${card3d(st.bestM, st.rated.some(e => e.media.type === 'MANGA') ? 'HIGHEST RATED' : 'FROM YOUR YEAR')}
        <div class="hl-stats">
          <div><span class="mono">CHAPTERS</span><strong><span data-count="${st.chapters}">0</span><small>ch</small></strong></div>
          <div><span class="mono">VOLUMES</span><strong data-count="${st.volumes}">0</strong></div>
          <div><span class="mono">AVG SCORE</span><strong class="${st.mAvg ? '' : 'unscored'}">${st.mAvg ? st.mAvg.toFixed(1) : 'Not rated yet'}</strong></div>
          <div class="last"><span class="mono">TOP REGION</span><strong>${esc(COUNTRY[st.countries[0]?.[0]] || st.countries[0]?.[0] || '-')}</strong></div>
        </div>
      </div>
    </div>
    <div class="strip">
      <div data-reveal><strong>${(st.minutes / 1440).toFixed(1)}</strong><span class="mono">DAYS IN OTHER WORLDS</span></div>
      <div data-reveal><strong>${st.avg ? st.avg.toFixed(1) : 'Unrated'}</strong><span class="mono">OVERALL SCORE</span></div>
      <div data-reveal><strong>${esc(pretty(st.formats[0]?.[0]) || '-')}</strong><span class="mono">TOP FORMAT</span></div>
      <div data-reveal><strong>${fmt(st.rewatches + st.rereads)}</strong><span class="mono">REWATCHES + REREADS</span></div>
    </div>
    ${st.hot ? `<div class="hot" data-reveal><img src="${cov(st.hot.e)}" alt=""><div><span class="mono">YOUR SPICIEST TAKE</span>
      <p>You gave <em>${t(st.hot.e)}</em> a ${st.hot.e.score}. AniList says ${st.hot.e.media.meanScore}. ${st.hot.diff > 0 ? 'You saw something the rest of us missed.' : 'Brave. We respect it.'}</p></div></div>` : ''}
  </section>`);

  /* Personal milestones, supported by the completion dates in the profile. */
  const dated = [...st.all].filter(e => e.completedAt?.month).sort((a, b) =>
    (a.completedAt.month * 32 + (a.completedAt.day || 0)) - (b.completedAt.month * 32 + (b.completedAt.day || 0)));
  const moments = [];
  if (dated.length) moments.push({ label: 'WHERE IT BEGAN', e: dated[0], note: `Your first recorded finish in ${st.year}.`, detail: MONTHS[dated[0].completedAt.month - 1] });
  if (st.monthly[peak].length) moments.push({ label: 'YOUR BUSIEST CHAPTER', e: st.monthly[peak][0], note: `${plural(st.monthly[peak].length, 'story', 'stories')} finished in ${MONTHS[peak]}. A month full of other worlds.`, detail: MONTHS[peak] });
  if (dated.length > 1) moments.push({ label: 'THE LATEST GOODBYE', e: dated.at(-1), note: 'Your most recent recorded finish. A new memory for the archive.', detail: MONTHS[dated.at(-1).completedAt.month - 1] });
  if (moments.length) S.push(`<section class="sec memory-chapters" data-ch="LITTLE MOMENTS">
    ${head('03', 'THE LITTLE THINGS WE REMEMBER')}
    <div class="moments-heading"><h2 class="big" data-words>${split('It wasn’t just')}<br><em>${split('a list of titles.')}</em></h2><p>There was a beginning. A month you disappeared into other worlds. And a last episode that became a memory.</p></div>
    <div class="moments-grid">${moments.map((m, i) => `<a class="moment-card" data-reveal href="${esc(safeUrl(m.e.media.siteUrl))}" target="_blank" rel="noreferrer"><div class="moment-image"><img src="${esc(safeUrl(m.e.media.bannerImage) || safeUrl(m.e.media.coverImage?.extraLarge) || safeUrl(m.e.media.coverImage?.large))}" alt="${t(m.e)}" loading="lazy"><span class="moment-no">0${i+1}</span><span class="moment-month mono">${esc(m.detail)}</span></div><span class="mono moment-label">${m.label}</span><h3>${t(m.e)} <span aria-hidden="true">↗</span></h3><p>${esc(m.note)}</p></a>`).join('')}</div>
  </section>`);

  /* 03 - ANATOMY (bento) */
  S.push(`<section class="sec anatomy" data-ch="ANATOMY">
    ${head('03', 'ANATOMY OF YOUR TASTE')}
    <h2 class="big" data-words style="margin-bottom:70px">${split('What you')} <em>${split('kept')}</em> ${split('coming back to.')}</h2>
    <div class="bento">
      <div class="tile t-genre" data-reveal><span class="mono">GENRE SPECTRUM</span><h3>Your <em>genres</em></h3>
        <div class="genres">${st.genres.slice(0, 7).map(([g, n], i) => `<button type="button" class="g-row" data-genre="${esc(g)}" aria-pressed="false"><span class="n">0${i + 1}</span><span class="name">${esc(g)}</span><span class="bar"><i style="--w:${n / st.genres[0][1] * 100}%"></i></span><span class="c">${n}</span></button>`).join('') || '<p class="mono" style="margin-top:30px">NO DATA YET</p>'}</div><div class="chart-inspector" id="genreInspector" aria-live="polite"></div>
      </div>
      <div class="tile t-persona" data-reveal><span class="mono">YOUR PERSONA ✳</span>
        <div class="persona-name">${esc(p.name)}</div><p class="persona-desc">${esc(p.desc)}</p>
        <div class="traits">${p.traits.map(x => `<span>${esc(x.toUpperCase())}</span>`).join('')}</div>
        <div class="persona-glyph" aria-hidden="true">${esc(p.name.replace(/^The /, '')[0])}</div>
      </div>
      <div class="tile t-month" data-reveal><span class="mono">MONTHLY RHYTHM</span><h3>The shape of <em>your year.</em></h3>
        <p class="chart-hint">Hover, focus, or tap a month to revisit it.</p>
        <div class="vbars">${st.monthly.map((x, i) => `<button type="button" class="${x.length && i === peak ? 'peak' : ''}" data-month="${i}" aria-pressed="${i === peak}" aria-label="${MONTHS[i]}: ${plural(x.length, 'title')} finished"><b>${x.length || '0'}</b><i style="--h:${x.length / maxM * 100}%"></i><span>${MON[i]}</span></button>`).join('')}</div>
        <div class="chart-inspector" id="monthInspector" aria-live="polite"></div>
      </div>
      <div class="tile t-score" data-reveal><span class="mono">YOUR RATINGS</span><h3>${st.rated.length ? 'Every story, <em>a different feeling.</em>' : 'Some stories<br><em>don’t need a number.</em>'}</h3>
        ${st.rated.length ? `<p class="chart-hint">Explore the titles behind each score range.</p><div class="vbars">${st.scoreBins.map((x, i) => `<button type="button" data-score="${i}" aria-pressed="false" aria-label="Scores ${i * 10 + 1} to ${(i + 1) * 10}: ${plural(x, 'title')}"><b>${x}</b><i style="--h:${x / maxS * 100}%"></i><span>${(i + 1) * 10}</span></button>`).join('')}</div><div class="chart-inspector" id="scoreInspector" aria-live="polite"></div>` : `<div class="unrated-state"><span aria-hidden="true">♡</span><p>You haven’t rated these titles on AniList.<br>The time you spent with them still counts.</p><a href="https://anilist.co/user/${encodeURIComponent(u.name)}/animelist" target="_blank" rel="noreferrer">Visit your AniList list <span>↗</span></a></div>`}
      </div>
      <div class="tile t-format" data-reveal><span class="mono">FORMAT MIX</span>${st.formats.length ? donut(st.formats) : '<p class="mono" style="margin-top:30px">NO DATA YET</p>'}</div>
      <div class="tile t-studio" data-reveal><span class="mono">THE STUDIOS BEHIND IT</span>
        <div class="studios">${st.studios.slice(0, 5).map(([s, n]) => `<div class="studio"><span>${esc(s)}</span><b>${plural(n, 'TITLE')}</b></div>`).join('') || '<p class="mono" style="margin-top:30px">NO ANIME STUDIOS YET</p>'}</div>
        ${st.binge ? `<p class="mono" style="margin-top:28px;color:var(--gold);letter-spacing:.14em;line-height:1.8">⚡ FASTEST BURN - ${t(st.binge.e).toUpperCase()}: ${plural(st.binge.size, st.binge.e.media.type === 'ANIME' ? 'EPISODE' : 'CHAPTER')} IN ${plural(st.binge.days, 'DAY')}</p>` : ''}
      </div>
    </div>
  </section>`);

  /* 04 - THE GRIND */
  if (st.ongoing.length) S.push(`<section class="sec grind" data-ch="THE GRIND">
    <div class="grind-pin">
      <div class="grind-bg" id="grindBg"></div>
      <div class="grind-head"><div>${head('04', 'IN PROGRESS')}<h2 class="big outline" data-words>${split('The Grind')}</h2></div><p>Ongoing obsessions. The ones you’re still in the middle of - touched this year, not finished yet.</p></div>
      <div class="grind-track" id="grindTrack">${st.ongoing.map(e => `<a class="g-card" href="${esc(safeUrl(e.media.siteUrl))}" target="_blank" rel="noreferrer" data-cover="${cov(e)}" data-cursor="OPEN">
        <div class="cov"><img src="${cov(e, true)}" alt="" loading="lazy"><div class="p"><div><strong>${e.progress || 0}</strong><small>${e.media.type === 'ANIME' ? 'EPISODES' : 'CHAPTERS'}</small></div>${e.score ? `<em>${e.score}</em>` : ''}</div></div>
        <h4>${t(e)}</h4></a>`).join('')}</div>
    </div>
  </section>`);

  /* 05 - THE CAST */
  if (favChars.length) S.push(`<section class="sec cast" data-ch="THE CAST">
    ${head('05', 'FAVOURITES')}
    <h2 class="big" data-words style="margin-bottom:60px">${split('The')} <em>${split('Cast.')}</em></h2>
    <div class="cast-row">${favChars.map((c, i) => `<div class="c-card" data-reveal><div class="ph"><img src="${esc(safeUrl(c.image?.large))}" alt="" loading="lazy"><span class="rank">${i + 1}</span></div><h4>${esc(c.name?.full)}</h4><small>${esc(c.media?.nodes?.[0]?.title?.userPreferred || '')}</small></div>`).join('')}</div>
    ${favStaff.length ? `<div class="staff-line"><span class="mono">AND THE PEOPLE BEHIND THEM</span>${favStaff.map(s => `<span>${esc(s.name?.full)}</span>`).join('')}</div>` : ''}
  </section>`);

  /* 06 - TIMELINE */
  const months = st.monthly.map((x, i) => [x, i]).filter(([x]) => x.length);
  if (months.length) S.push(`<section class="sec timeline" data-ch="TIMELINE">
    ${head('06', 'MONTH BY MONTH')}
    <h2 class="big" data-words style="margin-bottom:60px">${split('Your year,')} <em>${split('frame by frame.')}</em></h2>
    ${months.map(([items, i], k) => {
      const best = [...items].sort((x, y) => (y.score || 0) - (x.score || 0));
      const bA = best.find(e => e.media.type === 'ANIME'), bM = best.find(e => e.media.type === 'MANGA');
      const picks = [bA, bM].filter(Boolean); if (picks.length < 2 && best[1]) picks.push(best.find(e => !picks.includes(e)));
      const bg = safeUrl(best[0]?.media.bannerImage) || safeUrl(best[0]?.media.coverImage?.large);
      return `<div class="month ${k % 2 ? 'r' : ''}">
        <div class="month-bg">${bg ? `<img src="${esc(bg)}" alt="" loading="lazy">` : ''}</div>
        <div class="month-text"><span class="mono">${String(i + 1).padStart(2, '0')}</span><div class="month-name">${MON[i]}</div>
          <div class="month-meta"><span>${plural(items.length, 'TITLE')} FINISHED</span><div class="pills">${sortMap(st.mGenres[i]).slice(0, 3).map(([g]) => `<i>${esc(g)}</i>`).join('')}</div></div></div>
        <div class="month-covers">${picks.slice(0, 2).map(e => `<a class="mc" href="${esc(safeUrl(e.media.siteUrl))}" target="_blank" rel="noreferrer" data-cursor="OPEN"><div class="ph"><img src="${cov(e)}" alt="" loading="lazy"></div><h5>${t(e)}</h5><small>${e.media.type}${e.score ? ` · ${e.score}` : ''}</small></a>`).join('')}</div>
      </div>`;
    }).join('')}
  </section>`);

  /* 07 - THEN & NOW */
  S.push(`<section class="sec then" data-ch="THEN & NOW">
    ${head('07', 'THEN & NOW')}
    <div class="vs">
      <div class="old"><strong data-count="${st.prev}">0</strong><span class="mono">${st.year - 1}</span></div>
      <div class="x">vs</div>
      <div><strong data-count="${st.all.length}">0</strong><span class="mono">${st.year}</span></div>
    </div>
    <p class="verdict" data-reveal>${st.prev === 0 && st.all.length === 0 ? 'Nothing logged for either year - yet.'
      : diff > 0 ? `<b>${plural(diff, 'more story', 'more stories')}</b> than last year. You’re levelling up.`
      : diff < 0 ? `<b>${plural(-diff, 'fewer')}</b> than last year. Maybe the stories just got longer.`
      : 'The exact same count as last year. Unshakeable.'}</p>
    ${since ? `<div class="since" data-reveal>${esc(since)}</div>` : ''}
  </section>`);

  /* 08 - OUTRO */
  S.push(`<section class="sec outro" data-ch="FIN">
    <div>
      <div class="mono accent" data-fade>FIN.</div>
      <h2 class="big" data-words style="margin-top:30px">${split(`Your ${st.year}.`)}<br><em>${split('Captured.')}</em></h2>
      <p data-fade>${st.year === THIS_YEAR ? `${esc(st.year)} isn’t over, ${name}. Come back after your next finish - the archive will remember where you left off.` : `Thanks for the memories, ${name}. The archive will be here whenever you want to look back.`}</p>
      <div class="btns" data-fade><button class="btn solid" id="share" data-cursor="SHARE">SHARE YOUR ARCHIVE ↗</button><button class="btn" id="again" data-cursor="REPLAY">WATCH AGAIN ↑</button></div>
      ${st.snapshot?.cache === 'STALE' ? `<p class="saved-note">A saved archive from ${esc(new Date(st.snapshot.fetchedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}. Your latest changes may still be developing.</p>` : ''}
      <div class="foot mono">UNOFFICIAL · DATA FROM ANILIST · MADE FOR FANS</div>
    </div>
  </section>`);

  el.app.innerHTML = S.join('');
  window.dispatchEvent(new CustomEvent('archive:report', { detail: { items: st.covers.slice(0, 28) } }));
  $$('.sec-head', el.app).forEach((h, i) => { h.firstElementChild.textContent = String(i + 1).padStart(2, '0'); });
}

/* ════════════ MOTION ════════════ */
let lenis = null, mm = null;
const cleanups = [];

function countUp(node, delay = 0) {
  const to = Number(node.dataset.count) || 0;
  if (!G || REDUCED || !to) { node.textContent = fmt(to); return; }
  const o = { v: 0 };
  G.to(o, { v: to, duration: 2.2, delay, ease: 'expo.out', onUpdate: () => { node.textContent = fmt(o.v); } });
}

function splitChars(node) {
  const text = node.textContent;
  node.innerHTML = [...text].map(c => c === ' ' ? ' ' : `<span class="w"><span>${esc(c)}</span></span>`).join('');
  return $$('.w > span', node);
}

function animate() {
  if (!G) { $$('[data-count]').forEach(n => countUp(n)); return; }
  ScrollTrigger.getAll().forEach(s => s.kill());
  mm?.revert(); mm = G.matchMedia();
  cleanups.splice(0).forEach(f => f());

  if (REDUCED) {
    $$('[data-count]').forEach(n => countUp(n));
    $$('.statement .wd').forEach(w => { w.style.opacity = 1; });
    $$('.month-name').forEach(m => { m.style.backgroundPosition = '0 0'; });
    hudTracking(); return;
  }

  const hero = $('.hero');
  const chars = splitChars($('[data-chars]', hero));
  const tl = G.timeline({ delay: .2 });
  tl.from('.hero .avatar', { scale: 0, rotate: -40, duration: 1.2, ease: 'expo.out' })
    .from(chars, { yPercent: 110, duration: 1.4, stagger: .035, ease: 'expo.out' }, '-=.9')
    .from($$('[data-fade]', hero), { y: 30, opacity: 0, duration: 1.2, stagger: .12, ease: 'expo.out' }, '-=1')
    .from('.collage', { opacity: 0, scale: 1.15, duration: 2.4, ease: 'power2.out' }, 0);
  G.to('.collage', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  G.to('.hero-inner', { yPercent: 30, opacity: 0, scale: .94, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

  // headings: words rise
  $$('[data-words]').forEach(h => G.from($$('.w > span', h), { yPercent: 115, duration: 1.3, stagger: .06, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%' } }));
  $$('.sec-head .rule').forEach(r => G.from(r, { scaleX: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: r, start: 'top 90%' } }));
  $$('section:not(.hero) [data-fade]').forEach(n => G.from(n, { y: 30, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: n, start: 'top 90%' } }));
  $$('[data-reveal]').forEach(n => G.from(n, { y: 70, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: n, start: 'top 90%' } }));

  // prologue: the sentence lights up word by word as you scroll
  const words = $$('.statement .wd');
  if (words.length) G.to(words, { opacity: 1, stagger: .1, ease: 'none', scrollTrigger: { trigger: '.statement', start: 'top 80%', end: 'bottom 40%', scrub: .6 } });

  // counters
  $$('[data-count]').forEach(n => ScrollTrigger.create({ trigger: n, start: 'top 92%', once: true, onEnter: () => countUp(n) }));

  // highlights slide in from the sides
  $$('.hl').forEach(h => G.from(h, { x: h.dataset.from === 'left' ? -120 : 120, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%' } }));
  G.fromTo('.ghost-title', { xPercent: -42 }, { xPercent: -58, ease: 'none', scrollTrigger: { trigger: '.highlights', start: 'top bottom', end: 'bottom top', scrub: true } });

  // charts
  $$('.genres').forEach(g => G.from($$('.bar i', g), { scaleX: 0, duration: 1.6, stagger: .08, ease: 'expo.out', scrollTrigger: { trigger: g, start: 'top 85%' } }));
  $$('.vbars').forEach(v => G.from($$('i', v), { scaleY: 0, duration: 1.4, stagger: .05, ease: 'expo.out', scrollTrigger: { trigger: v, start: 'top 88%' } }));
  $$('.donut circle').forEach((c, i) => {
    const len = Number(c.dataset.len);
    G.from(c, { attr: { 'stroke-dasharray': `0 ${2 * Math.PI * 80}` }, duration: 1.4, delay: i * .12, ease: 'expo.out', scrollTrigger: { trigger: '.donut', start: 'top 85%' }, onComplete: () => c.setAttribute('stroke-dasharray', `${len} ${2 * Math.PI * 80}`) });
  });
  $$('.studio').forEach((s, i) => G.from(s, { x: -40, opacity: 0, duration: 1, delay: i * .07, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 92%' } }));

  // the grind: horizontal scroll on desktop
  const track = $('#grindTrack');
  if (track) mm.add('(min-width: 761px)', () => {
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    G.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.grind-pin', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true } });
  });
  const gbg = $('#grindBg');
  $$('.g-card').forEach(c => c.addEventListener('mouseenter', () => { if (gbg && c.dataset.cover) { gbg.style.backgroundImage = `url('${c.dataset.cover}')`; gbg.style.opacity = '.45'; } }));
  $('.grind-track')?.addEventListener('mouseleave', () => { if (gbg) gbg.style.opacity = '0'; });

  // cast: stagger from below
  const castRow = $('.cast-row');
  if (castRow) G.from($$('.c-card', castRow), { y: 100, opacity: 0, rotate: 3, duration: 1.4, stagger: .08, ease: 'expo.out', scrollTrigger: { trigger: castRow, start: 'top 85%' } });

  // timeline: month names fill in as you scroll past them; covers drift
  $$('.month').forEach(m => {
    G.fromTo($('.month-name', m), { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', ease: 'none', scrollTrigger: { trigger: m, start: 'top 80%', end: 'center 45%', scrub: true } });
    $$('.mc', m).forEach((c, i) => G.fromTo(c, { y: 80 + i * 50 }, { y: -40 - i * 30, ease: 'none', scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true } }));
  });

  $$('.moment-image img').forEach(img => G.fromTo(img, { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12, ease: 'none', scrollTrigger: { trigger: img.closest('.moment-card'), start: 'top bottom', end: 'bottom top', scrub: 1 } }));

  // vs: old year fades back
  G.from('.vs .x', { scale: 0, rotate: -90, duration: 1.2, ease: 'back.out(2)', scrollTrigger: { trigger: '.vs', start: 'top 80%' } });

  // 3D tilt with glare
  if (FINE) $$('.card3d').forEach(card => {
    const rx = G.quickTo(card, 'rotationX', { duration: .6, ease: 'power3' }), ry = G.quickTo(card, 'rotationY', { duration: .6, ease: 'power3' });
    const move = e => {
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      ry((x - .5) * 18); rx((.5 - y) * 18);
      card.style.setProperty('--gx', `${x * 100}%`); card.style.setProperty('--gy', `${y * 100}%`);
    };
    const leave = () => { G.to(card, { rotationX: 0, rotationY: 0, duration: 1.4, ease: 'elastic.out(1, .4)' }); };
    card.addEventListener('pointermove', move); card.addEventListener('pointerleave', leave);
  });

  hudTracking();
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

function hudTracking() {
  if (!G) return;
  G.to(el.hudBar, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: el.app, start: 'top top', end: 'bottom bottom', scrub: .3 } });
  $$('#app > section').forEach((s, i) => ScrollTrigger.create({
    trigger: s, start: 'top 50%', end: 'bottom 50%',
    onToggle: self => { if (self.isActive) { el.hudNum.textContent = String(i).padStart(2, '0'); el.hudLabel.textContent = s.dataset.ch; } },
  }));
}

/* ════════════ GATE ════════════ */
let year = Number(new URLSearchParams(location.search).get('year')) || THIS_YEAR;
function gateIntro() {
  document.body.classList.add('locked');
  const last = mem.get().last;
  if (last?.name && !el.user.value) el.user.value = last.name;
  if (!G || REDUCED) { $$('.gl > span').forEach(s => { s.style.transform = 'none'; }); el.form.style.opacity = 1; return; }
  G.timeline({ delay: .15 })
    .fromTo('.gl > span', { yPercent: 110 }, { yPercent: 0, duration: 1.4, stagger: .12, ease: 'expo.out' })
    .fromTo(el.form, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, .65);
}

let activeLoad = null;
function loadingLine(text) { el.loadLine.textContent = text; }
function loaderStart() {
  activeLoad = new AbortController();
  el.gate.classList.add('is-loading'); el.loader.hidden = false;
  loadingLine('Finding your stories…');
}
function loaderEnd() { el.gate.classList.remove('is-loading'); el.loader.hidden = true; }
$('#cancelLoad').addEventListener('click', () => { activeLoad?.abort(); loaderEnd(); });

function openReport() {
  document.body.classList.remove('locked');
  el.hud.hidden = false;
  window.scrollTo(0, 0); lenis?.scrollTo(0, { immediate: true }); lenis?.start();
  if (G && !REDUCED) {
    return new Promise(res => G.to(el.gate, { yPercent: -100, duration: 1.4, ease: 'expo.inOut', onComplete: () => { el.gate.classList.add('gone'); loaderEnd(); window.dispatchEvent(new CustomEvent('archive:gate', { detail: false })); res(); } }));
  }
  el.gate.classList.add('gone'); loaderEnd(); window.dispatchEvent(new CustomEvent('archive:gate', { detail: false })); return Promise.resolve();
}
function closeReport() {
  history.replaceState(null, '', location.pathname);
  document.title = 'AniList Wrapped - The Anime Archive';
  el.gate.classList.remove('gone'); el.hud.hidden = true; document.body.classList.add('locked'); lenis?.stop();
  window.dispatchEvent(new CustomEvent('archive:gate', { detail: true }));
  if (G && !REDUCED) G.to(el.gate, { yPercent: 0, duration: 1.2, ease: 'expo.inOut' }); else el.gate.style.transform = '';
}
el.hudHome.addEventListener('click', closeReport);

/* Data behind the pictures: every chart can be explored with a pointer or keyboard. */
function wireCharts(st) {
  function listMarkup(label, items, empty) {
    return `<div class="inspector-heading"><strong>${esc(label)}</strong><span>${plural(items.length, 'title')}</span></div>${items.length ? `<div class="inspector-titles">${items.slice(0, 4).map(e => `<a href="${esc(safeUrl(e.media.siteUrl))}" target="_blank" rel="noreferrer">${cov(e) ? `<img src="${cov(e)}" alt="" loading="lazy">` : ''}<span>${t(e)}</span><small>${e.score ? `${e.score}/100` : esc(pretty(e.media.format) || e.media.type)}</small></a>`).join('')}</div>${items.length > 4 ? `<p class="inspector-more">And ${plural(items.length - 4, 'more story', 'more stories')} in this chapter.</p>` : ''}` : `<p class="inspector-empty">${esc(empty)}</p>`}`;
  }
  function bind(selector, key, renderDetail) {
    const buttons = $$(selector); let selected = null;
    buttons.forEach((b, i) => {
      const update = () => {
        if (selected === b.dataset[key]) return;
        selected = b.dataset[key];
        buttons.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        renderDetail(selected);
      };
      b.addEventListener('pointerenter', update); b.addEventListener('focus', update); b.addEventListener('click', update);
      b.addEventListener('keydown', e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
        e.preventDefault();
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
      });
    });
    return value => buttons.find(b => b.dataset[key] === String(value))?.click();
  }
  const selectMonth = bind('[data-month]', 'month', value => {
    const month = Number(value);
    $('#monthInspector').innerHTML = listMarkup(MONTHS[month], st.monthly[month], 'A quiet chapter. No completed titles recorded this month.');
  });
  selectMonth(st.monthly.reduce((best, items, i) => items.length > st.monthly[best].length ? i : best, 0));
  if (st.rated.length) {
    const selectScore = bind('[data-score]', 'score', value => {
      const bin = Number(value), items = st.rated.filter(e => Math.min(9, Math.ceil(e.score / 10) - 1) === bin);
      $('#scoreInspector').innerHTML = listMarkup(`${bin * 10 + 1}–${(bin + 1) * 10} / 100`, items, 'No titles in this range. Your ratings tell their own story.');
    });
    selectScore(st.scoreBins.indexOf(Math.max(...st.scoreBins)));
  }
  const selectGenre = bind('[data-genre]', 'genre', value => {
    $('#genreInspector').innerHTML = listMarkup(value, st.all.filter(e => e.media.genres?.includes(value)), 'No titles here yet.');
  });
  if (st.genres[0]) selectGenre(st.genres[0][0]);
  $$('.legend button').forEach(button => {
    const update = () => {
      const format = button.dataset.format, count = st.formats.find(([f]) => f === format)?.[1] || 0;
      $$('.legend button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      $$('.donut circle').forEach(c => c.classList.toggle('muted', c.dataset.format !== format));
      $('.donut .center strong').textContent = count;
      $('.donut .center span').textContent = pretty(format);
      $('#formatDetail').textContent = `${plural(count, 'title')} · ${Math.round(count / st.all.length * 100)}% of your year`;
    };
    button.addEventListener('pointerenter', update); button.addEventListener('focus', update); button.addEventListener('click', update);
  });
  $$('.donut circle').forEach(c => c.addEventListener('pointerenter', () => {
    $$('.legend button').find(b => b.dataset.format === c.dataset.format)?.click();
  }));
}

/* Persistent browser snapshots complement the shared Cloudflare profile cache. */
const PROFILE_PREFIX = 'archive:profile:v3:';
const PROFILE_FRESH = 15 * 60_000, PROFILE_RETAIN = 24 * 60 * 60_000;
const profileKey = name => PROFILE_PREFIX + encodeURIComponent(name.toLowerCase());
function savedProfile(name) {
  try {
    const saved = JSON.parse(localStorage.getItem(profileKey(name)));
    return saved?.data?.user?.name && Number.isFinite(saved.fetchedAt) && Date.now() - saved.fetchedAt < PROFILE_RETAIN ? saved : null;
  } catch { return null; }
}
function saveProfile(name, value) {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PROFILE_PREFIX));
    for (const key of keys) {
      const item = JSON.parse(localStorage.getItem(key));
      if (!item || Date.now() - item.fetchedAt >= PROFILE_RETAIN) localStorage.removeItem(key);
    }
    const remaining = Object.keys(localStorage).filter(k => k.startsWith(PROFILE_PREFIX) && k !== profileKey(name));
    remaining.sort((a,b) => JSON.parse(localStorage.getItem(b)).fetchedAt - JSON.parse(localStorage.getItem(a)).fetchedAt);
    remaining.slice(2).forEach(key => localStorage.removeItem(key));
    localStorage.setItem(profileKey(name), JSON.stringify({ data: value.data, fetchedAt: value.fetchedAt }));
  } catch { /* Full or disabled storage does not prevent loading. */ }
}
let cooldownUntil = 0, directUntil = 0;
try { cooldownUntil = Number(sessionStorage.getItem('archive:retryAt')) || 0; directUntil = Number(sessionStorage.getItem('archive:directUntil')) || 0; } catch { /* private mode */ }
async function load(name, signal) {
  const saved = savedProfile(name);
  if (saved && Date.now() - saved.fetchedAt < PROFILE_FRESH) { loadingLine('Opening your saved stories…'); return saved; }
  const retry = Math.ceil((cooldownUntil - Date.now()) / 1000);
  if (retry > 0) {
    if (saved) return { ...saved, cache: 'STALE' };
    throw new Error(`AniList is taking a breather. Please try again in ${retry} seconds.`);
  }
  let timedOut = false;
  const controller = new AbortController();
  const abort = () => controller.abort(); signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 32_000);
  try {
    if (signal.aborted) { controller.abort(); throw new DOMException('Cancelled', 'AbortError'); }
    loadingLine('Opening your anime and manga…');
    let result;
    if (directUntil > Date.now() && window.ArchiveDirect) {
      result = await window.ArchiveDirect(name, controller.signal, loadingLine);
    } else {
      const response = await fetch(`/api/archive?${new URLSearchParams({ username: name })}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      result = await response.json();
      if (!response.ok && result.directAllowed && response.status !== 429 && window.ArchiveDirect) {
        directUntil = Date.now() + 5 * 60_000;
        try { sessionStorage.setItem('archive:directUntil', String(directUntil)); } catch {}
        result = await window.ArchiveDirect(name, controller.signal, loadingLine);
      } else if (!response.ok) {
        throw Object.assign(new Error(result.error || 'Your archive couldn’t load. Please try again.'), { status: response.status, retryAfter: result.retryAfter || Number(response.headers.get('Retry-After')) || 60 });
      }
    }
    if (!result.data?.user?.name || !Array.isArray(result.data?.anime?.lists) || !Array.isArray(result.data?.manga?.lists) || !Number.isFinite(result.fetchedAt)) throw new Error('AniList returned an incomplete archive. Please try again.');
    saveProfile(name, result); return result;
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (error.status === 429) {
      const delay = Math.max(1, Number(error.retryAfter) || 60);
      cooldownUntil = Date.now() + delay * 1000;
      try { sessionStorage.setItem('archive:retryAt', String(cooldownUntil)); } catch {}
      error.message = `${error.message} Try again in ${delay} seconds.`;
    }
    if ([403,404].includes(error.status)) { try { localStorage.removeItem(profileKey(name)); } catch {} throw error; }
    if (saved) return { ...saved, cache: 'STALE' };
    if (timedOut) throw new Error('AniList is taking longer than usual. Please try again in a moment.');
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('Couldn’t reach your archive. Check your connection and try again.');
    throw error;
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}

function remember(st) {
  const db = mem.get(); db.snaps = db.snaps || {};
  const key = `${st.user.name.toLowerCase()}|${st.year}`;
  if (!db.snaps[key] || db.snaps[key].count !== st.all.length) db.snaps[key] = { count: st.all.length, at: Date.now() };
  db.last = { name: st.user.name, year: st.year, avatar: safeUrl(st.user.avatar?.large), covers: st.covers.slice(0, 12) };
  mem.set(db);
}

function wireReport(st) {
  $('#share')?.addEventListener('click', async ev => {
    const btn = ev.currentTarget, url = new URL(location.href);
    url.search = new URLSearchParams({ username: st.user.name, year: st.year }).toString(); url.hash = '';
    try {
      if (navigator.share) await navigator.share({ title: `${st.user.name}’s ${st.year} - The Anime Archive`, url: url.href });
      else { await navigator.clipboard.writeText(url.href); btn.textContent = 'LINK COPIED ✓'; }
    } catch (err) { if (err?.name !== 'AbortError') prompt('Copy your link:', url.href); }
  });
  $('#again')?.addEventListener('click', () => lenis ? lenis.scrollTo(0, { duration: 2.4 }) : scrollTo({ top: 0, behavior: 'smooth' }));
  wireCharts(st);
}

function show(st) {
  render(st); wireReport(st); remember(st);
  history.replaceState(null, '', `?${new URLSearchParams({ username: st.user.name, year: st.year })}`);
  document.title = `${st.user.name}’s ${st.year} - The Anime Archive`;
}

el.form.addEventListener('submit', async e => {
  e.preventDefault();
  const name = el.user.value.trim(); if (!name || el.submit.disabled) return;
  el.msg.textContent = ''; el.submit.disabled = true;
  loaderStart();
  try {
    const snapshot = await load(name, activeLoad.signal);
    const data = snapshot.data;
    // Old shared links keep their selected year; fresh visits open the latest active year.
    if (!new URLSearchParams(location.search).has('year')) {
      const years = activeYears(data.anime, data.manga);
      year = years.includes(THIS_YEAR) ? THIS_YEAR : (years[0] || THIS_YEAR);
    }
    const st = build(data, year);
    st.snapshot = snapshot;
    if (!st.all.length && !st.ongoing.length) {
      const ys = activeYears(data.anime, data.manga);
      throw new Error(`Nothing completed in ${year} for ${data.user.name}.${ys.length ? ` Try ${ys.slice(0, 3).join(', ')}?` : ' Add completion dates on AniList and come back.'}`);
    }
    loadingLine('Putting your year together…');
    if (G) G.set(el.app, { opacity: 1 });
    show(st);
    await openReport();
    animate();
    window.ScrollTrigger?.refresh();
  } catch (err) {
    loaderEnd();
    el.msg.textContent = err.name === 'AbortError' ? '' : err.message;
    if (G && !REDUCED) G.fromTo('.field', { x: -10 }, { x: 0, duration: .8, ease: 'elastic.out(1, .3)' });
  } finally { el.submit.disabled = false; activeLoad = null; }
});

/* ── boot ── */
if (window.Lenis && !REDUCED) {
  lenis = new Lenis({ duration: 1.25, easing: x => Math.min(1, 1.001 - Math.pow(2, -10 * x)), smoothWheel: true });
  if (G) { lenis.on('scroll', ScrollTrigger.update); G.ticker.add(time => lenis.raf(time * 1000)); G.ticker.lagSmoothing(0); }
  else { const raf = time => { lenis.raf(time); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
  lenis.stop();
}
const qs = new URLSearchParams(location.search);
gateIntro();
if (qs.get('username')) { el.user.value = qs.get('username'); el.form.requestSubmit(); }
