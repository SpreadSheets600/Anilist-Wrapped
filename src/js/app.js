class CinematicWrapped {
    constructor() {
        this.apiBase = 'http://localhost:8000/api';
        this.container = document.getElementById('cinematicContainer');
        this.entryGate = document.getElementById('entryGate');
        this.form = document.getElementById('userForm');
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        
        this.init();
    }

    init() {
        // Check URL params for shared view or pre-fill
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('username');
        const year = urlParams.get('year');
        const shareId = urlParams.get('share');

        if (username) document.getElementById('username').value = username;
        if (year) document.getElementById('year').value = year;

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        if (shareId) {
            this.loadShared(shareId);
        } else if (username && year) {
            // Auto submit if params present
           // this.fetchData(username, year); // Optional: auto-start
        }
        
        // Intersection Observer for animations
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    // Special handling for counters if needed
                    if (entry.target.dataset.count) {
                        this.animateCounter(entry.target);
                    }
                }
            });
        }, { threshold: 0.2 });

        this.initParallax();
    }

    initParallax() {
        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            
            // Parallax backgrounds
            document.querySelectorAll('.cinematic-bg').forEach(bg => {
                const speed = 0.5;
                const rect = bg.parentElement.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                    const offset = (window.innerHeight - rect.top) * 0.1;
                    bg.style.transform = `scale(1.1) translateY(${offset}px)`;
                }
            });

            // Parallax floating elements
            document.querySelectorAll('.stat-floating').forEach((el, index) => {
                const speed = (index + 1) * 0.2;
                el.style.transform = `translateY(${scrolled * speed * 0.1}px)`;
            });
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const year = document.getElementById('year').value;
        
        if (!username) return;
        
        await this.fetchData(username, year);
    }

    async fetchData(username, year) {
        this.setLoading(true);
        this.errorState.classList.add('hidden');
        
        try {
            const res = await fetch(`${this.apiBase}/rewind?username=${username}&year=${year}`);
            if (!res.ok) throw new Error('User not found or private');
            const data = await res.json();
            
            // Artificial delay for "cinematic" loading feel
            await new Promise(r => setTimeout(r, 1500));
            
            this.startExperience(data);
        } catch (err) {
            console.error(err);
            this.errorState.textContent = `ERROR: ${err.message}`;
            this.errorState.classList.remove('hidden');
            this.setLoading(false);
        }
    }

    async loadShared(shareId) {
        this.setLoading(true);
        try {
            const res = await fetch(`${this.apiBase}/share?shareId=${shareId}`);
            if (!res.ok) throw new Error('Shared memory not found');
            const data = await res.json();
            this.startExperience(data);
        } catch (err) {
            this.errorState.textContent = err.message;
            this.errorState.classList.remove('hidden');
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.loadingState.classList.remove('hidden');
            this.form.style.opacity = '0.5';
            this.form.style.pointerEvents = 'none';
        } else {
            this.loadingState.classList.add('hidden');
            this.form.style.opacity = '1';
            this.form.style.pointerEvents = 'auto';
        }
    }

    startExperience(data) {
        // Fade out gate
        this.entryGate.classList.add('opacity-0');
        this.entryGate.style.pointerEvents = 'none';
        setTimeout(() => this.entryGate.remove(), 1000);

        // Render Content
        this.render(data);
        
        // Fade in container
        this.container.classList.remove('opacity-0');
        
        // Init observers on new content
        document.querySelectorAll('.reveal-text, .reveal-card').forEach(el => {
            this.observer.observe(el);
        });
    }

    // --- RENDERING CORE ---

    render(data) {
        const { overall, monthly_overview, year, username } = data;
        
        // Dynamic Theme based on Top Genre
        const topGenre = Object.keys(overall.top_genres)[0] || 'Default';
        this.applyTheme(topGenre);

        // Process Data for "Overall Top" (aggregating monthly tops)
        const allTopAnime = monthly_overview
            .map(m => m.top_anime)
            .filter(Boolean)
            .sort((a, b) => b.score - a.score);
            
        // Deduplicate anime by title
        const uniqueTopAnime = Array.from(new Map(allTopAnime.map(item => [item.title, item])).values()).slice(0, 5);

        const allTopManga = monthly_overview
            .map(m => m.top_manga)
            .filter(Boolean)
            .sort((a, b) => b.score - a.score);
            
        // Deduplicate manga by title
        const uniqueTopManga = Array.from(new Map(allTopManga.map(item => [item.title, item])).values()).slice(0, 5);

        // Find a hero image (best anime banner or cover)
        const heroImage = uniqueTopAnime[0]?.banner_image || uniqueTopAnime[0]?.cover_image || '';

        let html = '';

        // PHASE ONE: YEAR IDENTITY
        html += this.renderHero(username, year, heroImage);
        html += this.renderStats(overall);
        html += this.renderTopMedia(uniqueTopAnime, uniqueTopManga);
        html += this.renderGenres(overall.top_genres);
        
        // PHASE TWO: MONTHLY EXPLORATION
        html += `<div class="py-20"><h2 class="text-center font-display text-4xl mb-20 text-glow">The Timeline</h2></div>`;
        html += `<div class="space-y-0">`; // No space, continuous flow
        monthly_overview.forEach((month, index) => {
            html += this.renderMonth(month, index);
        });
        html += `</div>`;

        // OUTRO
        html += this.renderOutro(username, year);

        this.container.innerHTML = html;
    }

    applyTheme(genre) {
        const colors = {
            'Action': '#f5576c', // Red
            'Adventure': '#f093fb', // Pink/Purple
            'Comedy': '#ffd700', // Gold
            'Drama': '#7877c6', // Purple
            'Fantasy': '#00ff9d', // Emerald
            'Horror': '#ff0000', // Deep Red
            'Mecha': '#00d2ff', // Cyan
            'Music': '#ff00cc', // Magenta
            'Mystery': '#9d4edd', // Violet
            'Psychological': '#ffffff', // White/Stark
            'Romance': '#ff69b4', // Hot Pink
            'Sci-Fi': '#00ffff', // Electric Blue
            'Slice of Life': '#98fb98', // Pale Green
            'Sports': '#ff8c00', // Orange
            'Thriller': '#ff4500', // Orange Red
        };

        const color = colors[genre] || '#7877c6'; // Default Purple
        document.documentElement.style.setProperty('--accent-glow', color);
        
        // Also update selection color via a style tag injection if needed, or just let CSS var handle it where possible
        // Tailwind config uses specific colors, but we can update inline styles that use the var
    }

    renderHero(username, year, image) {
        return `
        <section class="screen relative">
            <div class="cinematic-bg" style="background-image: url('${image}');"></div>
            <div class="overlay-gradient"></div>
            <div class="content-layer text-center">
                <div class="mb-4 font-mono text-purple-400 tracking-widest text-sm reveal-text">IDENTITY_CONFIRMED: ${username.toUpperCase()}</div>
                <h1 class="font-display text-[8rem] leading-none font-bold mix-blend-overlay opacity-80 reveal-text delay-100">${year}</h1>
                <h2 class="font-display text-4xl italic mt-4 reveal-text delay-200">The Archive</h2>
                <p class="font-mono mt-8 text-gray-400 max-w-md mx-auto reveal-text delay-300">
                    A collection of moments, stories, and worlds you inhabited.
                </p>
            </div>
            <div class="absolute bottom-10 animate-bounce text-gray-500 font-mono text-xs">SCROLL TO BEGIN</div>
        </section>
        `;
    }

    renderStats(overall) {
        return `
        <section class="screen relative bg-black">
            <div class="content-layer w-full">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center">
                    
                    <div class="reveal-text delay-100">
                        <div class="font-mono text-gray-500 text-sm mb-2">EPISODES WATCHED</div>
                        <div class="font-display text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">
                            ${overall.episodes_watched.toLocaleString()}
                        </div>
                    </div>

                    <div class="reveal-text delay-200">
                        <div class="font-mono text-gray-500 text-sm mb-2">CHAPTERS READ</div>
                        <div class="font-display text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">
                            ${overall.chapters_read.toLocaleString()}
                        </div>
                    </div>

                    <div class="reveal-text delay-300">
                        <div class="font-mono text-gray-500 text-sm mb-2">MINUTES IMMERSED</div>
                        <div class="font-display text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">
                            ${overall.minutes_watched.toLocaleString()}
                        </div>
                    </div>

                    <div class="reveal-text delay-500">
                        <div class="font-mono text-gray-500 text-sm mb-2">AVG SCORE</div>
                        <div class="font-display text-6xl font-bold text-purple-400 text-glow">
                            ${overall.average_score}
                        </div>
                    </div>

                </div>
            </div>
        </section>
        `;
    }

    renderTopMedia(animeList, mangaList) {
        if (!animeList.length && !mangaList.length) return '';

        const renderCover = (item, type) => `
            <div class="cover-card shrink-0" style="background-image: url('${item.cover_image}');">
                <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                    <div class="text-xs font-mono text-purple-300 mb-1">${type} // ${item.score}</div>
                    <div class="font-bold leading-tight line-clamp-2 text-sm">${item.title}</div>
                </div>
            </div>
        `;

        return `
        <section class="screen relative overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-b from-black via-purple-900/10 to-black"></div>
            <div class="content-layer w-full">
                <h2 class="font-display text-5xl mb-12 text-center reveal-text">Defined Your Year</h2>
                
                <div class="flex flex-col gap-12">
                    <!-- Anime Row -->
                    ${animeList.length ? `
                        <div class="w-full overflow-x-auto pb-8 no-scrollbar">
                            <div class="flex gap-6 px-8 justify-center min-w-max">
                                ${animeList.map(a => renderCover(a, 'ANIME')).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Manga Row -->
                    ${mangaList.length ? `
                        <div class="w-full overflow-x-auto pb-8 no-scrollbar">
                            <div class="flex gap-6 px-8 justify-center min-w-max">
                                ${mangaList.map(m => renderCover(m, 'MANGA')).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </section>
        `;
    }

    renderGenres(genres) {
        const topGenres = Object.entries(genres).slice(0, 5);
        if (!topGenres.length) return '';

        const primaryGenre = topGenres[0][0];

        return `
        <section class="screen relative">
            <!-- Ambient Background based on genre -->
            <div class="absolute inset-0 bg-black">
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-blue-900 rounded-full blur-[120px] opacity-20 animate-pulse"></div>
            </div>

            <div class="content-layer text-center z-10">
                <div class="font-mono text-sm mb-4 text-gray-400 reveal-text">DOMINANT RESONANCE</div>
                <h2 class="font-display text-[6rem] md:text-[10rem] font-bold text-transparent text-edge opacity-50 reveal-text mix-blend-overlay leading-none">
                    ${primaryGenre.toUpperCase()}
                </h2>
                
                <div class="mt-12 flex flex-wrap justify-center gap-4 max-w-2xl mx-auto reveal-text delay-200">
                    ${topGenres.map(([name, count], i) => `
                        <div class="px-6 py-3 border border-white/10 rounded-full bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-default">
                            <span class="text-white font-bold mr-2">${name}</span>
                            <span class="text-purple-400 font-mono text-xs">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </section>
        `;
    }

    renderMonth(monthData, index) {
        const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
        const monthName = months[monthData.month - 1];
        
        // Determine background image from top media
        const bgImage = monthData.top_anime?.banner_image || monthData.top_anime?.cover_image || 
                       monthData.top_manga?.banner_image || monthData.top_manga?.cover_image;

        if (!monthData.activity_summary.total_titles_completed && !bgImage) return ''; // Skip empty months if desired, or render minimal

        return `
        <section class="screen relative min-h-[80vh] border-b border-white/5 last:border-0">
            ${bgImage ? `<div class="cinematic-bg" style="background-image: url('${bgImage}'); opacity: 0.15;"></div>` : ''}
            <div class="overlay-vignette"></div>
            
            <div class="content-layer grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-6xl items-center">
                
                <div class="text-left reveal-text">
                    <div class="font-mono text-6xl md:text-8xl font-bold opacity-20 mb-4">${String(monthData.month).padStart(2, '0')}</div>
                    <h3 class="font-display text-5xl md:text-6xl font-bold mb-6">${monthName}</h3>
                    
                    <div class="flex gap-8 font-mono text-sm text-gray-400 mb-8">
                        <div>
                            <span class="block text-2xl text-white">${monthData.activity_summary.anime_completed}</span>
                            ANIME
                        </div>
                        <div>
                            <span class="block text-2xl text-white">${monthData.activity_summary.manga_completed}</span>
                            MANGA
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        ${monthData.top_genres.map(g => `
                            <span class="px-3 py-1 rounded-full border border-white/10 text-xs font-mono text-purple-300 bg-purple-900/10">
                                ${g}
                            </span>
                        `).join('')}
                    </div>
                </div>

                <div class="space-y-6 reveal-text delay-200">
                    ${monthData.top_anime ? `
                        <div class="flex items-center gap-6 bg-white/5 p-4 rounded-lg border border-white/5 hover:border-purple-500/30 transition-colors">
                            <img src="${monthData.top_anime.cover_image}" class="w-16 h-24 object-cover rounded shadow-lg">
                            <div>
                                <div class="text-xs text-purple-400 font-mono mb-1">TOP ANIME</div>
                                <div class="font-bold text-xl">${monthData.top_anime.title}</div>
                                <div class="text-sm text-gray-400">Score: ${monthData.top_anime.score}</div>
                            </div>
                        </div>
                    ` : ''}

                    ${monthData.top_manga ? `
                        <div class="flex items-center gap-6 bg-white/5 p-4 rounded-lg border border-white/5 hover:border-purple-500/30 transition-colors">
                            <img src="${monthData.top_manga.cover_image}" class="w-16 h-24 object-cover rounded shadow-lg">
                            <div>
                                <div class="text-xs text-purple-400 font-mono mb-1">TOP MANGA</div>
                                <div class="font-bold text-xl">${monthData.top_manga.title}</div>
                                <div class="text-sm text-gray-400">Score: ${monthData.top_manga.score}</div>
                            </div>
                        </div>
                    ` : ''}
                </div>

            </div>
        </section>
        `;
    }

    renderOutro(username, year) {
        return `
        <section class="screen relative bg-black text-center">
             <div class="absolute inset-0 bg-[url('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdtY2J6eXJ6eXJ6eXJ6eXJ6eXJ6eXJ6eXJ6eXJ6eXJ6eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif')] bg-cover opacity-5 grayscale mix-blend-screen"></div>
             
             <div class="content-layer">
                <h2 class="font-display text-4xl mb-8">End of Archive</h2>
                <p class="font-mono text-gray-500 mb-12">See you in ${parseInt(year) + 1}.</p>
                
                <button onclick="window.location.reload()" class="px-8 py-3 border border-white/20 rounded hover:bg-white hover:text-black transition-all font-mono">
                    REPLAY_MEMORY
                </button>
             </div>
        </section>
        `;
    }

    animateCounter(el) {
        // Simple counter animation logic if needed
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CinematicWrapped();
});