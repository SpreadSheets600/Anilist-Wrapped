'use strict';
// Phones use native scrolling, so they do not need the animation libraries.
const archiveAppScript = new URL('app.js', document.currentScript.src).href;
(async () => {
  const limited = matchMedia('(max-width: 760px), (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)').matches;
  const load = src => new Promise(resolve => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = script.onerror = resolve;
    document.head.append(script);
  });
  if (!limited) {
    await load('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js');
    await load('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js');
    await load('https://unpkg.com/lenis@1.1.13/dist/lenis.min.js');
  }
  // Resolve relative to this file for both the Worker and Flask static routes.
  await load(archiveAppScript);
})();
