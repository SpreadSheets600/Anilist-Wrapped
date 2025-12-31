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
			this.dom.cursorOutline.animate(
				{
					left: `${posX}px`,
					top: `${posY}px`,
				},
				{ duration: 500, fill: "forwards" }
			);
		});
		document.addEventListener("mouseover", (e) => {
			if (e.target.closest("a, button, input, .hover-target")) {
				document.body.classList.add("hover-target");
			} else {
				document.body.classList.remove("hover-target");
			}
		});
	}

	initGateAnimation() {
		gsap.to("#gateTitle", { opacity: 1, duration: 2, delay: 0.5, ease: "power2.out" });
		gsap.to("#userForm", { opacity: 1, duration: 2, delay: 1, ease: "power2.out" });
		const params = new URLSearchParams(window.location.search);
		if (params.get("username")) document.getElementById("username").value = params.get("username");
	}

	async handleSubmit(e) {
		e.preventDefault();
		const username = document.getElementById("username").value;
		const year = document.getElementById("year").value;
		const loader = document.getElementById("loader");

		if (!username) return;
		loader.classList.remove("hidden");

		try {
			const res = await fetch(`${this.api}/rewind?username=${username}&year=${year}`);
			if (!res.ok) throw new Error("User not found or private");
			const result = await res.json();
			this.data = result.data;

			gsap.to(this.dom.gate, {
				yPercent: -100,
				duration: 1.5,
				ease: "power4.inOut",
				onComplete: () => this.render(result.html),
			});
		} catch (err) {
			document.getElementById("error").textContent = err.message;
			document.getElementById("error").classList.remove("hidden");
		} finally {
			loader.classList.add("hidden");
		}
	}

	render(htmlContent) {
		this.dom.app.innerHTML = htmlContent;
		gsap.set(this.dom.app, { opacity: 1 });
		setTimeout(() => this.initVisuals(), 100);
		setTimeout(() => this.renderCharts(), 500);
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
		if (!item) return "";
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
		if (m.activity_summary.total_titles_completed === 0) return "";
		const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
		const bg = m.top_anime?.banner_image || m.top_anime?.cover_image || "";
		const alignRight = index % 2 !== 0;

		const genrePills = m.top_genres
			.slice(0, 3)
			.map((g) => `<span class="text-[10px] md:text-xs font-mono border border-white/20 px-2 py-1 rounded-full text-gray-400">${g}</span>`)
			.join("");

		return `
        <section class="min-h-[50vh] md:min-h-[70vh] relative overflow-hidden group flex items-center py-12 md:py-0">
            <div class="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none">
                 <img src="${bg}" class="w-full h-full object-cover grayscale blur-sm scale-110 group-hover:scale-100 transition-transform duration-[2s]">
            </div>
            
            <div class="relative z-10 px-6 md:px-8 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24 items-center">
                <div class="${alignRight ? "md:order-2 md:text-right" : ""}">
                    <div class="font-mono text-accent mb-2 text-xl md:text-2xl opacity-50">0${m.month}</div>
                    <h3 class="font-display text-5xl md:text-9xl font-bold mb-4 opacity-10 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0 text-white">${months[m.month - 1]}</h3>
                    <div class="flex flex-col ${alignRight ? "md:items-end" : "items-start"} gap-2">
                        <div class="font-mono text-gray-400 text-sm md:text-base border-l-2 border-white/20 pl-4 ${alignRight ? "md:border-l-0 md:border-r-2 md:pl-0 md:pr-4" : ""}">
                            ${m.activity_summary.total_titles_completed} TITLES CONSUMED
                        </div>
                        <div class="flex gap-2 mt-2 flex-wrap">${genrePills}</div>
                    </div>
                </div>
                
                <div class="flex gap-4 overflow-x-auto pb-4 ${alignRight ? "md:justify-start" : "md:justify-end"} no-scrollbar">
                    ${this.miniCard(m.top_anime, "ANIME")}
                    ${this.miniCard(m.top_manga, "MANGA")}
                </div>
            </div>
        </section>
        `;
	}

	miniCard(item, type) {
		if (!item) return "";
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
		const formatCtx = document.getElementById("formatChart");
		if (formatCtx) {
			const formats = this.data.overall.formats;
			const labels = Object.keys(formats);
			const data = Object.values(formats);

			new Chart(formatCtx, {
				type: "doughnut",
				data: {
					labels: labels,
					datasets: [
						{
							data: data,
							backgroundColor: ["rgba(180, 180, 255, 0.7)", "rgba(245, 87, 108, 0.7)", "rgba(0, 210, 255, 0.7)", "rgba(255, 215, 0, 0.7)", "rgba(157, 78, 221, 0.7)", "rgba(255, 255, 255, 0.7)"],
							borderWidth: 0,
							hoverOffset: 10,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: "bottom", labels: { color: "#888", font: { family: "JetBrains Mono", size: 10 }, boxWidth: 10, padding: 15 } },
					},
				},
			});
		}

		const scoreCtx = document.getElementById("scoreChart");
		if (scoreCtx) {
			const scores = this.data.overall.score_distribution;
			const labels = Object.keys(scores).map((k) => k + "+");
			const data = Object.values(scores);

			new Chart(scoreCtx, {
				type: "bar",
				data: {
					labels: labels,
					datasets: [
						{
							label: "Titles",
							data: data,
							backgroundColor: "#ff8080",
							borderRadius: 4,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						x: { grid: { display: false }, ticks: { color: "#888", font: { size: 10 } } },
						y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888" } },
					},
					plugins: { legend: { display: false } },
				},
			});
		}

		const genreCtx = document.getElementById("genreChart");
		if (genreCtx) {
			const genres = this.data.overall.top_genres;
			const labels = Object.keys(genres).slice(0, 6);
			const data = Object.values(genres).slice(0, 6);

			new Chart(genreCtx, {
				type: "polarArea",
				data: {
					labels: labels,
					datasets: [
						{
							data: data,
							backgroundColor: ["rgba(120, 119, 198, 0.7)", "rgba(245, 87, 108, 0.7)", "rgba(0, 210, 255, 0.7)", "rgba(255, 215, 0, 0.7)", "rgba(157, 78, 221, 0.7)", "rgba(255, 255, 255, 0.7)"],
							borderWidth: 0,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						r: {
							grid: { color: "rgba(255,255,255,0.05)" },
							ticks: { display: false, backdropColor: "transparent" },
							pointLabels: { display: false },
						},
					},
					plugins: {
						legend: {
							position: "bottom",
							labels: { color: "#888", font: { family: "JetBrains Mono", size: 10 }, boxWidth: 10, padding: 15 },
						},
					},
				},
			});
		}

		const activityCtx = document.getElementById("activityChart");
		if (activityCtx) {
			const counts = this.data.overall.activity_counts;
			const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

			new Chart(activityCtx, {
				type: "bar",
				data: {
					labels: labels,
					datasets: [
						{
							label: "Activity",
							data: counts,
							backgroundColor: "#c084fc",
							borderRadius: 4,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						x: { grid: { display: false }, ticks: { color: "#888", font: { size: 10 } } },
						y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888" } },
					},
					plugins: { legend: { display: false } },
				},
			});
		}
	}

	initVisuals() {
		const splitTypes = document.querySelectorAll(".split-text");
		splitTypes.forEach((char) => {
			const text = new SplitType(char, { types: "chars,words" });
			gsap.from(text.chars, {
				scrollTrigger: { trigger: char, start: "top 80%" },
				y: 50,
				opacity: 0,
				stagger: 0.02,
				duration: 1,
				ease: "power3.out",
			});
		});

		gsap.utils.toArray(".gs-reveal-up").forEach((elem) => {
			gsap.from(elem, {
				scrollTrigger: {
					trigger: elem,
					start: "top 85%",
					toggleActions: "play none none none",
				},
				y: 60,
				opacity: 0,
				duration: 0.8,
				ease: "power3.out",
			});
		});

		gsap.utils.toArray(".gs-reveal-left").forEach((elem) => {
			gsap.from(elem, {
				scrollTrigger: {
					trigger: elem,
					start: "top 80%",
					toggleActions: "play none none none",
				},
				x: -100,
				opacity: 0,
				duration: 1,
				ease: "power3.out",
			});
		});

		gsap.utils.toArray(".gs-reveal-right").forEach((elem) => {
			gsap.from(elem, {
				scrollTrigger: {
					trigger: elem,
					start: "top 80%",
					toggleActions: "play none none none",
				},
				x: 100,
				opacity: 0,
				duration: 1,
				ease: "power3.out",
			});
		});

		gsap.utils.toArray(".stat-anim").forEach((elem) => {
			gsap.to(elem, {
				scrollTrigger: { trigger: elem, start: "top 90%" },
				y: 0,
				x: 0,

				opacity: 1,
				duration: 1,
				ease: "power3.out",
			});
		});

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
			gsap.to(".collage-bg", {
				yPercent: -30,
				scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: 1 },
			});
		}

		document.getElementById("shareBtn").addEventListener("click", () => this.generateShareCard());
	}

	async generateShareCard() {
		const btn = document.getElementById("shareBtn");
		btn.textContent = "GENERATING...";
		btn.disabled = true;

		try {
			const shareId = this.data.shareId;
			const response = await fetch(`/api/generate-card?shareId=${shareId}`);

			if (!response.ok) throw new Error("Failed to generate card");

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `Wrapped-${this.data.username}-${this.data.year}.png`;
			link.click();
			window.URL.revokeObjectURL(url);

			btn.textContent = "DOWNLOAD COMPLETE!";
			setTimeout(() => {
				btn.textContent = "GENERATE SHARE CARD";
				btn.disabled = false;
			}, 2000);
		} catch (error) {
			console.error("Error generating card:", error);
			btn.textContent = "ERROR - TRY AGAIN";
			setTimeout(() => {
				btn.textContent = "GENERATE SHARE CARD";
				btn.disabled = false;
			}, 2000);
		}
	}
}

const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/chart.js";
document.head.appendChild(script);

document.addEventListener("DOMContentLoaded", () => new App());
