// Global variables
let userData = null;

// Load user data from API
async function loadUserData() {
    const username = document.getElementById('username-input').value.trim();
    const year = document.getElementById('year-input').value || '2025';
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    const loadingIndicator = document.getElementById('loading-indicator');
    loadingIndicator.classList.remove('hidden');
    
    try {
        const response = await fetch(`http://localhost:8000/api/rewind?username=${username}&year=${year}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        
        userData = await response.json();
        
        // Hide username modal and show main content
        document.getElementById('username-modal').style.display = 'none';
        document.getElementById('scroll-content').classList.remove('hidden');
        
        // Render the data
        renderContent();
        initializeAnimations();
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data. Please check the username and try again.');
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

// Render content with real data
function renderContent() {
    if (!userData) return;
    
    // Update year title
    document.getElementById('year-title').textContent = userData.year;
    
    // Update stats
    document.getElementById('minutes-watched').textContent = userData.overall.minutes_watched.toLocaleString();
    document.getElementById('anime-completed').textContent = userData.overall.anime_completed;
    document.getElementById('chapters-read').textContent = userData.overall.chapters_read;
    document.getElementById('average-score').textContent = userData.overall.average_score.toFixed(1);
    document.getElementById('rewatches').textContent = userData.overall.rewatches;
    
    // Render top content (mix of anime and manga from monthly data)
    renderTopContent();
    
    // Render genres
    renderGenres();
    
    // Render monthly timeline
    renderMonthlyTimeline();
}

function renderTopContent() {
    const container = document.getElementById('top-content-container');
    container.innerHTML = '';
    
    // Get top titles from monthly data
    const topTitles = [];
    userData.monthly_overview.forEach(month => {
        if (month.top_anime) {
            topTitles.push({
                ...month.top_anime,
                type: 'ANIME',
                month: month.month
            });
        }
        if (month.top_manga) {
            topTitles.push({
                ...month.top_manga,
                type: 'MANGA',
                month: month.month
            });
        }
    });
    
    // Sort by score and take top 5
    const sortedTitles = topTitles
        .filter(title => title.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    
    // If no scored titles, take first 5 titles
    const displayTitles = sortedTitles.length > 0 ? sortedTitles : topTitles.slice(0, 5);
    
    displayTitles.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = "flex-none w-[300px] md:w-[400px] h-[500px] relative group overflow-hidden border border-white/10 snap-center cursor-pointer";
        card.onclick = () => openModal(index, displayTitles);
        
        card.innerHTML = `
            <div class="absolute inset-0 bg-gray-800">
                <img src="${item.cover_image}" class="w-full h-full object-cover opacity-60 group-hover:opacity-40 group-hover:scale-105 transition-all duration-700" alt="${item.title}">
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent p-8 flex flex-col justify-end">
                <span class="text-xs font-data text-purple-400 tracking-widest mb-2">${item.type} // RANK ${String(index + 1).padStart(2, '0')}</span>
                <h3 class="text-3xl font-cinematic text-white leading-none mb-2 glitch-hover">${item.title}</h3>
                <div class="flex items-center gap-3 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-4 group-hover:translate-y-0">
                    <span class="px-2 py-1 border border-white/30 text-[10px] uppercase font-data">Month ${item.month}</span>
                    <span class="text-2xl font-bold font-data text-white">${item.score || 'N/A'}</span>
                    <span class="ml-auto text-xs font-data uppercase border-b border-transparent group-hover:border-white transition-colors">Open File &rarr;</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderGenres() {
    const genreContainer = document.getElementById('genre-cloud');
    const topGenreElement = document.getElementById('top-genre');
    
    genreContainer.innerHTML = '';
    
    const genres = Object.entries(userData.overall.top_genres)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8);
    
    if (genres.length > 0) {
        topGenreElement.textContent = genres[0][0].toUpperCase();
    }
    
    genres.forEach(([name, count]) => {
        const pill = document.createElement('div');
        const maxCount = genres[0][1];
        const opacity = (count / maxCount) * 0.8 + 0.2;
        
        pill.className = `border border-white/20 px-6 py-3 rounded-full text-gray-300 font-data uppercase tracking-wider hover:bg-white hover:text-black hover:border-white transition-all duration-300 cursor-default`;
        pill.style.opacity = opacity;
        pill.innerHTML = `${name} <span class="text-xs">(${count})</span>`;
        genreContainer.appendChild(pill);
    });
}

function renderMonthlyTimeline() {
    const monthContainer = document.getElementById('monthly-container');
    monthContainer.innerHTML = '';
    
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const colors = [
        'text-blue-400', 'text-indigo-400', 'text-emerald-400', 'text-red-400',
        'text-gray-400', 'text-purple-400', 'text-yellow-400', 'text-orange-400',
        'text-amber-700', 'text-purple-600', 'text-slate-400', 'text-white'
    ];
    
    userData.monthly_overview.forEach((month, index) => {
        const row = document.createElement('div');
        const isEven = index % 2 === 0;
        row.className = `group relative flex ${isEven ? 'flex-row' : 'flex-row-reverse'} items-center gap-12 trigger-on-scroll`;
        
        const topTitle = month.top_anime?.title || month.top_manga?.title || 'No Activity';
        const totalCompleted = month.activity_summary.total_titles_completed;
        
        row.innerHTML = `
            <div class="w-1/2 hidden md:block">
                 <div class="h-[300px] w-full relative overflow-hidden glass-panel opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                    <img src="${month.top_anime?.banner_image || month.top_manga?.banner_image || `https://source.unsplash.com/random/800x600?abstract,dark,${index}`}" 
                         onerror="this.src='https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop'"
                         class="w-full h-full object-cover mix-blend-overlay" alt="Mood">
                     <div class="absolute inset-0 flex items-center justify-center">
                        <span class="text-6xl font-cinematic text-white/10 group-hover:text-white/30 transition-colors">${String(month.month).padStart(2, '0')}</span>
                     </div>
                 </div>
            </div>
            <div class="w-full md:w-1/2 relative z-10">
                <div class="absolute -left-16 top-0 text-9xl font-bold text-white/5 font-cinematic -z-10 select-none">${monthNames[month.month - 1]}</div>
                <h3 class="text-4xl md:text-5xl font-cinematic text-white mb-2 group-hover:text-purple-300 transition-colors duration-300">${monthNames[month.month - 1]} Activity</h3>
                <div class="h-px w-24 bg-purple-500 mb-6 group-hover:w-full transition-all duration-700 ease-out"></div>
                <div class="grid grid-cols-2 gap-8 font-data text-sm">
                    <div>
                        <span class="block text-gray-500 text-xs mb-1">COMPLETED</span>
                        <span class="text-white text-lg">${totalCompleted} titles</span>
                    </div>
                    <div>
                        <span class="block text-gray-500 text-xs mb-1">TOP TITLE</span>
                        <span class="${colors[index]} text-lg">${topTitle}</span>
                    </div>
                </div>
            </div>
        `;
        monthContainer.appendChild(row);
    });
}

// Modal functions
function openModal(index, titles) {
    const data = titles[index];
    document.getElementById('modal-image').src = data.cover_image;
    document.getElementById('modal-title').innerText = data.title;
    document.getElementById('modal-type').innerText = data.type;
    document.getElementById('modal-score').innerText = data.score || 'N/A';
    document.getElementById('modal-score-detail').innerText = data.score || 'Not Scored';
    document.getElementById('modal-desc').innerText = `Featured in month ${data.month}. This was one of your top titles for ${userData.year}.`;
    document.getElementById('modal-stats').innerText = data.type === 'ANIME' ? 'Episodes' : 'Chapters';
    
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

// Initialize animations and interactions
function initializeAnimations() {
    // Particle Background
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let scrollSpeed = 0;
    let lastScrollY = window.scrollY;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;
            this.alpha = Math.random() * 0.5;
        }
        update() {
            this.y -= this.speedY + (scrollSpeed * 0.5); 
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
            ctx.fillStyle = `rgba(150, 150, 255, ${this.alpha})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < 150; i++) particles.push(new Particle());
    }

    function animateCanvas() {
        ctx.clearRect(0, 0, width, height);
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;
        scrollSpeed = scrollSpeed * 0.9 + delta * 0.1;
        lastScrollY = currentScrollY;
        particles.forEach(p => p.update());
        requestAnimationFrame(animateCanvas);
    }

    window.addEventListener('resize', resize);
    resize();
    initParticles();
    animateCanvas();

    // Intersection Observer
    const observerOptions = { threshold: 0.15, rootMargin: "0px" };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.trigger-on-scroll').forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });

    setTimeout(() => {
        document.querySelectorAll('.trigger-on-load').forEach(el => {
            el.classList.add('visible');
        });
    }, 100);

    // Parallax Effect
    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        document.querySelectorAll('.parallax-image').forEach(img => {
            const speed = img.getAttribute('data-speed') || 0.5;
            img.style.transform = `translateY(${scrolled * speed}px) scale(1.1)`; 
        });
        document.querySelectorAll('.parallax-image-container').forEach(container => {
            const speed = container.getAttribute('data-speed') || 0.1;
            const yPos = -(scrolled * speed);
            container.style.transform = `translateY(${yPos}px)`;
        });
    });
}

// Event listeners
document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

document.getElementById('username-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') loadUserData();
});

document.getElementById('year-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') loadUserData();
});
