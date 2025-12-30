class App {
    constructor() {
        this.api = window.location.hostname === 'localhost' 
            ? 'http://localhost:8000/api' 
            : '/api'; // This now redirects to /.netlify/functions/api
            
        this.data = null;
        
        this.dom = {
            gate: document.getElementById('gate'),
            form: document.getElementById('userForm'),
            app: document.getElementById('app'),
            cursorDot: document.getElementById('cursor-dot'),
            cursorOutline: document.getElementById('cursor-outline')
        };
        
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (this.isTouch) {
            document.body.classList.add('touch-device');
            this.dom.cursorDot.style.display = 'none';
            this.dom.cursorOutline.style.display = 'none';
        }

        this.init();
    }

    init() {
        if (!this.isTouch) this.initCursor();
        this.initGateAnimation();
        
        this.dom.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        this.lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            gestureDirection: 'vertical',
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
        window.addEventListener('mousemove', (e) => {
            const posX = e.clientX;
            const posY = e.clientY;
            this.dom.cursorDot.style.left = `${posX}px`;
            this.dom.cursorDot.style.top = `${posY}px`;
            this.dom.cursorOutline.animate({
                left: `${posX}px`, top: `${posY}px`
            }, { duration: 500, fill: "forwards" });
        });
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('a, button, input, .hover-target')) {
                document.body.classList.add('hover-target');
            } else {
                document.body.classList.remove('hover-target');
            }
        });
    }

    initGateAnimation() {
        gsap.to('#gateTitle', { opacity: 1, duration: 2, delay: 0.5, ease: 'power2.out' });
        gsap.to('#userForm', { opacity: 1, duration: 2, delay: 1, ease: 'power2.out' });
        const params = new URLSearchParams(window.location.search);
        if (params.get('username')) document.getElementById('username').value = params.get('username');
    }

    async handleSubmit(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const year = document.getElementById('year').value;
        const loader = document.getElementById('loader');

        if (!username) return;
        loader.classList.remove('hidden');
        
        try {
            const res = await fetch(`${this.api}/rewind?username=${username}&year=${year}`);
            if (!res.ok) throw new Error('User not found or private');
            this.data = await res.json();
            
            gsap.to(this.dom.gate, {
                yPercent: -100, duration: 1.5, ease: 'power4.inOut',
                onComplete: () => this.render()
            });
        } catch (err) {
            document.getElementById('error').textContent = err.message;
            document.getElementById('error').classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
        }
    }

    render() {
        this.dom.app.innerHTML = this.buildHTML();
        gsap.set(this.dom.app, { opacity: 1 });
        setTimeout(() => this.initVisuals(), 100);
        setTimeout(() => this.renderCharts(), 500);
    }

    buildHTML() {
        const { overall, persona, username, year, monthly_overview, favorites, ongoing } = this.data;
        const collageHTML = overall.collage_covers ? 
            `<div class="collage-bg">${overall.collage_covers.map(src => `<div class="collage-item" style="background-image: url('${src}')"></div>`).join('')}</div>` : '';

        return `
            <!-- HERO -->
            <section class="scroll-section h-screen items-center text-center overflow-hidden relative justify-center">
                ${collageHTML}
                <div class="absolute inset-0 bg-gradient-to-b from-transparent via-[#030303]/80 to-[#030303]"></div>
                <div class="z-10 relative mix-blend-difference px-4 w-full">
                    <div class="font-mono text-xs md:text-sm tracking-[0.5em] mb-4 split-text text-accent">The Anime Archive // ${year}</div>
                    <h1 class="hero-title split-text break-words text-6xl md:text-9xl lg:text-[12rem] leading-none">${username}</h1>
                    <div class="mt-8 font-display text-2xl md:text-5xl italic text-gray-400 split-text">${persona.title}</div>
                    <p class="mt-6 font-mono text-gray-500 max-w-md mx-auto text-xs md:text-sm leading-relaxed px-4">${persona.description}</p>
                </div>
            </section>

            <!-- STATS CLOUD -->
            <section class="scroll-section bg-[#030303]">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 max-w-7xl mx-auto w-full px-6 items-start">
                    <div class="space-y-12">
                         ${this.statItem(overall.minutes_watched.toLocaleString(), 'MINUTES WATCHED')}
                         ${this.statItem(overall.episodes_watched.toLocaleString(), 'EPISODES')}
                         ${this.statItem(overall.anime_avg_score || '-', 'ANIME AVG SCORE')}
                    </div>
                    <div class="space-y-12">
                         ${this.statItem(overall.chapters_read.toLocaleString(), 'CHAPTERS READ')}
                         ${this.statItem(overall.volumes_read.toLocaleString(), 'VOLUMES')}
                         ${this.statItem(overall.manga_avg_score || '-', 'MANGA AVG SCORE')}
                    </div>
                    <div class="space-y-12">
                         ${this.statItem((overall.anime_completed + overall.manga_completed).toString(), 'TITLES COMPLETED')}
                         ${this.statItem(overall.total_days_watched, 'DAYS LOST')}
                         ${this.statItem(overall.average_score, 'OVERALL SCORE')}
                    </div>
                    <div class="space-y-12">
                        <div class="text-center stat-anim opacity-0 translate-y-10">
                            <div class="font-display text-4xl md:text-6xl font-bold tracking-tighter text-accent uppercase line-clamp-2 leading-none">${Object.keys(overall.top_genres)[0] || 'N/A'}</div>
                            <div class="font-mono text-xs md:text-sm text-gray-500 tracking-widest mt-2 border-t border-white/10 inline-block pt-2 px-4">PRIMARY VIBE</div>
                        </div>
                         <div class="text-center stat-anim opacity-0 translate-y-10">
                            <div class="font-display text-2xl md:text-4xl font-bold tracking-tighter text-gray-400 uppercase line-clamp-2 leading-none">${Object.keys(overall.top_studios)[0] || 'N/A'}</div>
                            <div class="font-mono text-xs md:text-sm text-gray-500 tracking-widest mt-2 border-t border-white/10 inline-block pt-2 px-4">FAVORITE STUDIO</div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- CHARTS SECTION -->
            <section class="scroll-section">
                <div class="max-w-[1400px] mx-auto w-full px-4 md:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-stretch">
                    
                    <!-- Format Card -->
                    <div class="bg-white/5 border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-8 flex flex-col items-center justify-center min-h-[350px] md:min-h-[400px]">
                        <h2 class="section-title text-2xl md:text-3xl mb-8 text-center">Format<br><span class="text-accent">Distribution</span></h2>
                        <div class="relative w-full h-full flex-1 min-h-[250px]">
                            <canvas id="formatChart"></canvas>
                        </div>
                    </div>

                    <!-- Score Card -->
                    <div class="bg-white/5 border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-8 flex flex-col justify-center min-h-[350px] md:min-h-[400px]">
                         <h2 class="section-title text-2xl md:text-3xl mb-8 text-center">Score<br><span class="text-[#ff8080]">Frequency</span></h2>
                         <div class="relative w-full h-full flex-1 min-h-[250px]">
                            <canvas id="scoreChart"></canvas>
                        </div>
                    </div>

                    <!-- Genre Card -->
                    <div class="bg-white/5 border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-8 flex flex-col items-center justify-center min-h-[350px] md:min-h-[400px]">
                        <h2 class="section-title text-2xl md:text-3xl mb-8 text-center">Genre<br><span class="text-blue-400">Spectrum</span></h2>
                        <div class="relative w-full h-full flex-1 min-h-[250px]">
                            <canvas id="genreChart"></canvas>
                        </div>
                    </div>

                    <!-- Activity Card -->
                    <div class="bg-white/5 border border-white/10 rounded-3xl md:rounded-[3rem] p-6 md:p-8 flex flex-col justify-center min-h-[350px] md:min-h-[400px]">
                         <h2 class="section-title text-2xl md:text-3xl mb-8 text-center">Monthly<br><span class="text-purple-400">Rhythm</span></h2>
                         <div class="relative w-full h-full flex-1 min-h-[250px]">
                            <canvas id="activityChart"></canvas>
                        </div>
                    </div>

                </div>
            </section>

            <!-- BEST OF YEAR -->
            <section class="scroll-section items-center">
                <div class="text-center mb-12 md:mb-16 px-4">
                    <h2 class="section-title text-4xl md:text-6xl">Peak Fiction</h2>
                    <p class="font-mono text-gray-400 mt-2 text-sm md:text-base">The stories that defined your year.</p>
                </div>
                <div class="flex flex-col md:flex-row gap-12 md:gap-16 justify-center items-center w-full max-w-6xl mx-auto px-4 perspective-1000">
                    ${this.card3D(overall.best_anime, 'ANIME OF THE YEAR', overall.anime_avg_score)}
                    ${this.card3D(overall.best_manga, 'MANGA OF THE YEAR', overall.manga_avg_score)}
                </div>
            </section>

            <!-- THE GRIND (ONGOING) -->
            ${(ongoing.anime.length || ongoing.manga.length) ? `
            <section class="scroll-section relative overflow-hidden" id="grindSection">
                 <div id="grindBg" class="absolute inset-0 bg-[#050505] transition-all duration-700 ease-out bg-cover bg-center opacity-30 blur-sm transform scale-105"></div>
                 <div class="absolute inset-0 bg-gradient-to-b from-[#030303] via-transparent to-[#030303]"></div>
                 
                 <div class="relative z-10 px-6 md:px-16 mb-8 md:mb-12">
                    <h2 class="section-title text-stroke text-4xl md:text-6xl">The Grind</h2>
                    <p class="font-mono text-gray-400 mt-4 text-sm">Ongoing obsessions.</p>
                </div>
                
                <div class="relative z-10 flex gap-4 md:gap-8 px-6 md:px-16 overflow-x-auto no-scrollbar pb-12 snap-x snap-mandatory items-end min-h-[400px]">
                    ${[...ongoing.anime, ...ongoing.manga].slice(0, 15).map(item => `
                        <div class="grind-card flex-shrink-0 w-60 md:w-72 group snap-start hover-target cursor-pointer" data-cover="${item.cover_image}">
                            <div class="aspect-[3/4] overflow-hidden rounded-2xl md:rounded-[2.5rem] mb-4 relative shadow-2xl transform transition-all duration-500 group-hover:-translate-y-4 md:group-hover:-translate-y-6 group-hover:scale-105 border-2 border-white/5 group-hover:border-accent">
                                <img src="${item.cover_image}" class="w-full h-full object-cover">
                                <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
                                <div class="absolute bottom-6 left-6 right-6">
                                    <div class="text-white font-display font-bold text-3xl md:text-4xl leading-none mb-2">${item.progress}</div>
                                    <div class="flex items-center justify-between">
                                        <div class="text-[10px] text-accent font-mono tracking-[0.2em] uppercase">${item.progress > 100 ? 'Episodes' : 'Chapters'}</div>
                                        <div class="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold">${item.score || '-'}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="font-bold truncate text-lg md:text-xl text-center text-gray-400 group-hover:text-white transition-colors px-2">${item.title}</div>
                        </div>
                    `).join('')}
                </div>
            </section>` : ''}

            <!-- THE CAST -->
            ${favorites && favorites.characters.length ? `
            <section class="scroll-section overflow-hidden">
                <div class="px-6 md:px-16 mb-8 md:mb-12">
                    <h2 class="section-title text-stroke text-4xl md:text-6xl">The Cast</h2>
                </div>
                <div class="flex gap-6 md:gap-8 px-6 md:px-16 overflow-x-auto no-scrollbar pb-12">
                    ${favorites.characters.map(char => `
                        <div class="flex-shrink-0 w-40 md:w-64 group cursor-none hover-target">
                            <div class="overflow-hidden rounded-lg aspect-[3/4] mb-4 relative">
                                <img src="${char.image.large}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale group-hover:grayscale-0">
                                <div class="absolute inset-0 ring-1 ring-inset ring-white/10 group-hover:ring-accent transition-all"></div>
                            </div>
                            <div class="font-display text-lg md:text-2xl group-hover:text-accent transition-colors truncate">${char.name.full}</div>
                        </div>
                    `).join('')}
                </div>
            </section>` : ''}

            <!-- TIMELINE -->
            <div class="relative py-12 md:py-20">
                <div class="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent hidden md:block"></div>
                ${monthly_overview.map((m, i) => this.monthSection(m, i)).join('')}
            </div>

            <!-- OUTRO -->
            <section class="scroll-section h-screen items-center justify-center bg-[#050505] text-center px-4">
                <h2 class="font-display text-4xl md:text-8xl mb-8 md:mb-12">Your ${year}.<br>Captured.</h2>
                <div class="flex flex-col gap-6 items-center">
                    <button id="shareBtn" class="bg-white text-black font-mono px-8 md:px-12 py-4 md:py-5 text-lg md:text-xl hover:scale-105 transition-transform hover-target font-bold tracking-tight">
                        GENERATE SHARE CARD
                    </button>
                    <div class="font-mono text-xs text-gray-600">4:5 Portrait Format</div>
                </div>
            </section>
        `;
    }

    statItem(value, label) {
        return `
            <div class="text-center stat-anim opacity-0 translate-y-10">
                <div class="font-display text-4xl md:text-6xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">${value}</div>
                <div class="font-mono text-xs md:text-sm text-accent tracking-widest mt-2 border-t border-white/10 inline-block pt-2 px-4">${label}</div>
            </div>
        `;
    }

    card3D(item, label) {
        if (!item) return '';
        return `
            <div class="card-3d-wrapper w-full max-w-[300px] md:max-w-[320px] h-[450px] md:h-[550px] hover-target">
                <div class="card-3d relative w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-[#0a0a0a] group border border-white/5">
                    <img src="${item.cover_image}" class="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                    <div class="glare"></div>
                    <div class="absolute bottom-0 left-0 w-full p-6 md:p-8 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                        <div class="font-mono text-[10px] text-accent mb-3 tracking-[0.2em] uppercase border-l-2 border-accent pl-2">${label}</div>
                        <h3 class="font-display text-3xl md:text-4xl font-bold leading-none mb-3 line-clamp-2 shadow-black drop-shadow-lg">${item.title}</h3>
                        <div class="flex items-center gap-2">
                             <span class="text-2xl font-bold">${item.score}</span>
                             <span class="text-xs text-gray-400 font-mono">SCORE</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    monthSection(m, index) {
        if (m.activity_summary.total_titles_completed === 0) return '';
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const bg = m.top_anime?.banner_image || m.top_anime?.cover_image || '';
        const alignRight = index % 2 !== 0; 
        
        const genrePills = m.top_genres.slice(0, 3).map(g => 
            `<span class="text-[10px] md:text-xs font-mono border border-white/20 px-2 py-1 rounded-full text-gray-400">${g}</span>`
        ).join('');
        
        return `
        <section class="min-h-[50vh] md:min-h-[70vh] relative overflow-hidden group flex items-center py-12 md:py-0">
            <div class="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none">
                 <img src="${bg}" class="w-full h-full object-cover grayscale blur-sm scale-110 group-hover:scale-100 transition-transform duration-[2s]">
            </div>
            
            <div class="relative z-10 px-6 md:px-8 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24 items-center">
                <div class="${alignRight ? 'md:order-2 md:text-right' : ''}">
                    <div class="font-mono text-accent mb-2 text-xl md:text-2xl opacity-50">0${m.month}</div>
                    <h3 class="font-display text-5xl md:text-9xl font-bold mb-4 opacity-10 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0 text-white">${months[m.month-1]}</h3>
                    <div class="flex flex-col ${alignRight ? 'md:items-end' : 'items-start'} gap-2">
                        <div class="font-mono text-gray-400 text-sm md:text-base border-l-2 border-white/20 pl-4 ${alignRight ? 'md:border-l-0 md:border-r-2 md:pl-0 md:pr-4' : ''}">
                            ${m.activity_summary.total_titles_completed} TITLES CONSUMED
                        </div>
                        <div class="flex gap-2 mt-2 flex-wrap">${genrePills}</div>
                    </div>
                </div>
                
                <div class="flex gap-4 overflow-x-auto pb-4 ${alignRight ? 'md:justify-start' : 'md:justify-end'} no-scrollbar">
                    ${this.miniCard(m.top_anime, 'ANIME')}
                    ${this.miniCard(m.top_manga, 'MANGA')}
                </div>
            </div>
        </section>
        `;
    }

    miniCard(item, type) {
        if (!item) return '';
        return `
            <div class="w-32 md:w-48 flex-shrink-0 hover-target cursor-none group">
                <div class="aspect-[2/3] overflow-hidden rounded-lg mb-3 bg-white/5 relative">
                    <img src="${item.cover_image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                    <div class="absolute inset-0 ring-1 ring-inset ring-white/10 group-hover:ring-accent transition-all"></div>
                </div>
                <div class="font-bold truncate text-xs md:text-sm">${item.title}</div>
                <div class="text-[10px] text-gray-500 font-mono tracking-wider">${type}</div>
            </div>
        `;
    }

    renderCharts() {
        const formatCtx = document.getElementById('formatChart');
        if (formatCtx) {
            const formats = this.data.overall.formats;
            const labels = Object.keys(formats);
            const data = Object.values(formats);
            
            new Chart(formatCtx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            'rgba(180, 180, 255, 0.7)',
                            'rgba(245, 87, 108, 0.7)',
                            'rgba(0, 210, 255, 0.7)',
                            'rgba(255, 215, 0, 0.7)',
                            'rgba(157, 78, 221, 0.7)',
                            'rgba(255, 255, 255, 0.7)'
                        ],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#888', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10, padding: 15 } }
                    }
                }
            });
        }

        const scoreCtx = document.getElementById('scoreChart');
        if (scoreCtx) {
            const scores = this.data.overall.score_distribution;
            const labels = Object.keys(scores).map(k => k + '+');
            const data = Object.values(scores);
            
            new Chart(scoreCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Titles',
                        data: data,
                        backgroundColor: '#ff8080',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } },
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        const genreCtx = document.getElementById('genreChart');
        if (genreCtx) {
            const genres = this.data.overall.top_genres;
            const labels = Object.keys(genres).slice(0, 6);
            const data = Object.values(genres).slice(0, 6);
            
            new Chart(genreCtx, {
                type: 'polarArea',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            'rgba(120, 119, 198, 0.7)',
                            'rgba(245, 87, 108, 0.7)',
                            'rgba(0, 210, 255, 0.7)',
                            'rgba(255, 215, 0, 0.7)',
                            'rgba(157, 78, 221, 0.7)',
                            'rgba(255, 255, 255, 0.7)'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { display: false, backdropColor: 'transparent' },
                            pointLabels: { display: false }
                        }
                    },
                    plugins: {
                        legend: { 
                            position: 'bottom',
                            labels: { color: '#888', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 10, padding: 15 } 
                        }
                    }
                }
            });
        }

        const activityCtx = document.getElementById('activityChart');
        if (activityCtx) {
            const counts = this.data.overall.activity_counts;
            const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            new Chart(activityCtx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Activity',
                        data: counts,
                        backgroundColor: '#c084fc',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#888', font: { size: 10 } } },
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    initVisuals() {
        // Text Reveals
        const splitTypes = document.querySelectorAll('.split-text');
        splitTypes.forEach(char => {
            const text = new SplitType(char, { types: 'chars,words' });
            gsap.from(text.chars, {
                scrollTrigger: { trigger: char, start: 'top 80%' },
                y: 50, opacity: 0, stagger: 0.02, duration: 1, ease: 'power3.out'
            });
        });

        // Stat Animation
        gsap.to('.stat-anim', {
            scrollTrigger: { trigger: '.stat-anim', start: 'top 80%' },
            y: 0, opacity: 1, stagger: 0.1, duration: 1.2, ease: 'expo.out'
        });

        // 3D Card Tilt
        if (!this.isTouch) {
            const cards = document.querySelectorAll('.card-3d-wrapper');
            cards.forEach(wrapper => {
                const card = wrapper.querySelector('.card-3d');
                const glare = wrapper.querySelector('.glare');
                wrapper.addEventListener('mousemove', (e) => {
                    const rect = wrapper.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const rotateX = ((y - rect.height/2) / (rect.height/2)) * -8;
                    const rotateY = ((x - rect.width/2) / (rect.width/2)) * 8;
                    gsap.to(card, { rotateX, rotateY, duration: 0.5, ease: 'power2.out' });
                    gsap.to(glare, { opacity: 0.6, backgroundPosition: `${(x/rect.width)*100}% ${(y/rect.height)*100}%`, duration: 0.5 });
                });
                wrapper.addEventListener('mouseleave', () => {
                    gsap.to(card, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1, 0.5)' });
                    gsap.to(glare, { opacity: 0, duration: 1 });
                });
            });
        }
        
        // Grind Section Interaction
        const grindCards = document.querySelectorAll('.grind-card');
        const grindBg = document.getElementById('grindBg');
        if (grindCards.length && grindBg) {
            grindCards.forEach(card => {
                card.addEventListener('mouseenter', () => {
                    const img = card.getAttribute('data-cover');
                    grindBg.style.backgroundImage = `url('${img}')`;
                    grindBg.style.opacity = '0.5';
                    grindBg.style.transform = 'scale(1.1)';
                });
            });
        }
        
        // Parallax
        if (document.querySelector('.collage-bg')) {
            gsap.to('.collage-bg', {
                yPercent: -30,
                scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 1 }
            });
        }
        
        // Share Button
        document.getElementById('shareBtn').addEventListener('click', () => this.generateShareCard());
    }

    async generateShareCard() {
        const btn = document.getElementById('shareBtn');
        btn.textContent = "GENERATING...";
        
        const { overall, persona, username, year } = this.data;
        const container = document.getElementById('shareCardContainer');
        const bg = overall.best_anime?.cover_image || '';
        const proxy = (url) => this.api.includes('localhost') ? `http://localhost:8000/api/proxy?url=${encodeURIComponent(url)}` : url;
        
        // 4:5 Ratio (1080x1350) - Portrait Magazine Style
        container.innerHTML = `
            <div class="relative w-[1080px] h-[1350px] bg-[#030303] text-white flex flex-col font-sans overflow-hidden p-12">
                <!-- BG -->
                <div class="absolute inset-0">
                    <img src="${proxy(bg)}" class="w-full h-full object-cover opacity-30 blur-xl">
                    <div class="absolute inset-0 bg-gradient-to-b from-[#030303]/90 to-[#030303]"></div>
                </div>

                <!-- CONTENT -->
                <div class="relative z-10 flex flex-col h-full border border-white/10 rounded-3xl p-12 justify-between backdrop-blur-sm">
                    
                    <!-- HEADER -->
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-mono text-2xl text-accent tracking-[0.3em] mb-2">ARCHIVE // ${year}</div>
                            <div class="font-display text-7xl font-bold uppercase tracking-tight">${username}</div>
                        </div>
                        <div class="bg-white text-black font-mono text-2xl px-6 py-2 rotate-2 font-bold rounded">
                            ${persona.title}
                        </div>
                    </div>

                    <!-- MAIN STATS GRID -->
                    <div class="grid grid-cols-2 gap-12 my-8">
                        <!-- ANIME STATS -->
                        <div class="bg-white/5 p-8 rounded-2xl border border-white/10">
                            <div class="font-mono text-xl text-gray-500 mb-6 flex items-center gap-2">
                                <span class="w-2 h-2 bg-accent rounded-full"></span> ANIME
                            </div>
                            <div class="space-y-6">
                                <div>
                                    <div class="text-6xl font-display font-bold">${overall.anime_completed}</div>
                                    <div class="text-sm font-mono text-gray-500">TITLES COMPLETED</div>
                                </div>
                                <div>
                                    <div class="text-6xl font-display font-bold">${overall.episodes_watched}</div>
                                    <div class="text-sm font-mono text-gray-500">EPISODES WATCHED</div>
                                </div>
                                <div>
                                    <div class="text-6xl font-display font-bold">${(overall.minutes_watched/60).toFixed(0)}h</div>
                                    <div class="text-sm font-mono text-gray-500">HOURS WATCHED</div>
                                </div>
                            </div>
                        </div>

                        <!-- MANGA STATS -->
                        <div class="bg-white/5 p-8 rounded-2xl border border-white/10">
                            <div class="font-mono text-xl text-gray-500 mb-6 flex items-center gap-2">
                                <span class="w-2 h-2 bg-[#ff8080] rounded-full"></span> MANGA
                            </div>
                            <div class="space-y-6">
                                <div>
                                    <div class="text-6xl font-display font-bold">${overall.manga_completed}</div>
                                    <div class="text-sm font-mono text-gray-500">TITLES COMPLETED</div>
                                </div>
                                <div>
                                    <div class="text-6xl font-display font-bold">${overall.chapters_read}</div>
                                    <div class="text-sm font-mono text-gray-500">CHAPTERS READ</div>
                                </div>
                                <div>
                                    <div class="text-6xl font-display font-bold">${overall.volumes_read}</div>
                                    <div class="text-sm font-mono text-gray-500">VOLUMES READ</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- COVERS ROW -->
                    <div class="flex gap-8 items-center justify-center">
                         <div class="relative w-40 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl rotate-3 border border-white/20">
                            <img src="${proxy(overall.best_anime?.cover_image)}" class="w-full h-full object-cover">
                        </div>
                        <div class="relative w-40 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl -rotate-3 border border-white/20">
                            <img src="${proxy(overall.best_manga?.cover_image)}" class="w-full h-full object-cover">
                        </div>
                         <div class="flex-1 pl-8">
                             <div class="font-mono text-xl text-gray-500 mb-2">TOP GENRES</div>
                             <div class="flex flex-wrap gap-3">
                                ${Object.keys(overall.top_genres).slice(0, 4).map(g => 
                                    `<span class="px-3 py-1 bg-white/10 rounded text-xl border border-white/10">${g}</span>`
                                ).join('')}
                             </div>
                         </div>
                    </div>
                </div>
                
                <!-- FOOTER -->
                <div class="absolute bottom-6 left-0 w-full text-center font-mono text-sm text-gray-600">
                    GENERATED BY GEMINI WRAPPED
                </div>
            </div>
        `;

        try {
            const canvas = await html2canvas(container.firstElementChild, {
                scale: 1,
                useCORS: true,
                backgroundColor: '#030303'
            });
            const link = document.createElement('a');
            link.download = `Wrapped-${username}-${year}-Card.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            btn.textContent = "SAVED!";
        } catch (err) {
            console.error(err);
            btn.textContent = "ERROR";
        }
        
        setTimeout(() => { btn.textContent = "GENERATE SHARE CARD"; }, 3000);
    }
}

const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(script);

document.addEventListener('DOMContentLoaded', () => new App());
