// Only fixed, public AniList queries are exposed. Client-supplied GraphQL is never forwarded.
import { INITIAL, NEXT } from './queries.mjs';
export const FRESH_MS = 15 * 60_000;
export const RETAIN_MS = 24 * 60 * 60_000;
class UpstreamError extends Error {
 constructor(message, status = 502, retryAfter = 0, directAllowed = false) { super(message); this.status = status; this.retryAfter = retryAfter; this.directAllowed = directAllowed; }
}
export function retrySeconds(header, now = Date.now()) {
 const numeric = Number(header);
 if (header && Number.isFinite(numeric)) return Math.max(1, Math.ceil(numeric));
 const date = Date.parse(header);
 return Number.isFinite(date) ? Math.max(1, Math.ceil((date - now) / 1000)) : 60;
}
export function createArchiveService({ fetcher = (...args) => fetch(...args), cache, now = Date.now, timeoutMs = 12_000, totalMs = 28_000 } = {}) {
 const pending = new Map();
 let retryAt = 0;
 const cacheRead = async key => { try { return await cache?.match(key); } catch { return undefined; } };
 const cacheWrite = async (key, value, seconds) => {
  try { await cache?.put(key, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${seconds}` } })); } catch { /* A cache failure never prevents a recap. */ }
 };
 async function query(queryText, variables, deadline, cooldownKey) {
  const blockedKey = cooldownKey + '/egress';
  if (await cacheRead(blockedKey)) throw new UpstreamError('AniList could not be reached from this server. Connecting from your browser instead.', 502, 0, true);
  const cooldown = await cacheRead(cooldownKey);
  const sharedRetryAt = cooldown ? (await cooldown.json()).retryAt : 0;
  const retry = Math.ceil((Math.max(retryAt, sharedRetryAt) - now()) / 1000);
  if (retry > 0) throw new UpstreamError('AniList is taking a breather. Please try again shortly.', 429, retry);
  const remaining = Math.min(timeoutMs, deadline - now());
  if (remaining <= 0) throw new UpstreamError('AniList is taking too long to respond. Please try again.', 504);
  const controller = new AbortController();
  let timer;
  try {
   const response = await Promise.race([
    (async () => {
     const response = await fetcher('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: queryText, variables }), signal: controller.signal });
     // Keep the body read inside the timeout too: a response can stall after its headers arrive.
     const body = await response.json().catch(() => null);
     return { response, body };
    })(),
    new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new UpstreamError('AniList is taking too long to respond. Please try again.', 504)); }, remaining); }),
   ]);
   const { response: upstream, body } = response;
   if (upstream.status === 429) {
    const delay = retrySeconds(upstream.headers.get('Retry-After'), now());
    retryAt = now() + delay * 1000;
    await cacheWrite(cooldownKey, { retryAt }, delay);
    throw new UpstreamError('AniList is taking a breather. Please try again shortly.', 429, delay);
   }
   const firstError = body?.errors?.[0];
   // An HTML 403 is an upstream transport rejection, not evidence that a profile is private.
   if (upstream.status === 403 && !/private|unauthorized/i.test(firstError?.message || '')) {
    await cacheWrite(blockedKey, { blocked: true }, 300);
    throw new UpstreamError('AniList could not be reached from this server. Connecting from your browser instead.', 502, 0, true);
   }
   if (!upstream.ok || firstError || !body?.data) {
    const message = String(firstError?.message || '');
    if (upstream.status === 404 || /not found/i.test(message)) throw new UpstreamError('No AniList user by that name. Check the spelling?', 404);
    if ([401, 403].includes(upstream.status) || /private|unauthorized/i.test(message)) throw new UpstreamError('That AniList profile or its lists are private.', 403);
    throw new UpstreamError('AniList could not load this archive right now. Please try again.', 502);
   }
   return body.data;
  } catch (error) {
   if (error instanceof UpstreamError) throw error;
   throw new UpstreamError('Could not reach AniList. Please try again in a moment.', 502);
  } finally { clearTimeout(timer); }
 }
 async function refresh(name, key, origin) {
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
   const deadline = now() + totalMs, cooldownKey = `${origin}/__archive-cache/v3/cooldown`;
   const data = await query(INITIAL, { name }, deadline, cooldownKey);
   if (!data.User?.id) throw new UpstreamError('No AniList user by that name. Check the spelling?', 404);
   for (const type of ['ANIME', 'MANGA']) {
    const collection = data[type.toLowerCase()];
    if (!collection || !Array.isArray(collection.lists)) throw new UpstreamError('AniList returned an incomplete archive. Please try again.', 502);
    let more = collection.hasNextChunk;
    for (let chunk = 2; more; chunk++) {
     const next = (await query(NEXT, { id: data.User.id, type, chunk }, deadline, cooldownKey)).collection;
     if (!next || !Array.isArray(next.lists)) throw new UpstreamError('AniList returned an incomplete archive. Please try again.', 502);
     collection.lists.push(...next.lists); more = next.hasNextChunk;
    }
    delete collection.hasNextChunk;
   }
   const value = { data: { user: data.User, anime: data.anime, manga: data.manga }, fetchedAt: now() };
   // Name lookup plus canonical user-ID cache: aliases share one public profile snapshot.
   await cacheWrite(`${origin}/__archive-cache/v3/id/${data.User.id}`, value, RETAIN_MS / 1000);
   await cacheWrite(key, { id: data.User.id }, RETAIN_MS / 1000);
   const canonical = `${origin}/__archive-cache/v3/name/${encodeURIComponent(data.User.name.toLowerCase())}`;
   if (canonical !== key) await cacheWrite(canonical, { id: data.User.id }, RETAIN_MS / 1000);
   return value;
  })();
  pending.set(key, job);
  try { return await job; } finally { pending.delete(key); }
 }
 return async function archive(request, ctx = {}) {
  if (request.method !== 'GET') return Response.json({ error: 'Use GET to open an archive.' }, { status: 405, headers: { Allow: 'GET' } });
  const url = new URL(request.url), name = (url.searchParams.get('username') || '').trim();
  if (!name || name.length > 50 || /[\u0000-\u001f\u007f]/.test(name)) return Response.json({ error: 'Enter a valid AniList username.' }, { status: 400 });
  const key = `${url.origin}/__archive-cache/v3/name/${encodeURIComponent(name.toLowerCase())}`;
  const cachedAlias = await cacheRead(key);
  let saved;
  if (cachedAlias) {
   const alias = await cachedAlias.json();
   const hit = await cacheRead(`${url.origin}/__archive-cache/v3/id/${alias.id}`);
   if (hit) { const candidate = await hit.json(); if (now() - candidate.fetchedAt < RETAIN_MS) saved = candidate; }
  }
  const respond = (value, state) => Response.json({ ...value, cache: state }, { headers: { 'Cache-Control': 'no-store', 'X-Archive-Cache': state } });
  if (saved && now() - saved.fetchedAt < FRESH_MS) return respond(saved, 'HIT');
  if (saved && ctx.waitUntil) {
   ctx.waitUntil(refresh(name, key, url.origin).catch(() => {}));
   return respond(saved, 'STALE');
  }
  try { return respond(await refresh(name, key, url.origin), 'MISS'); }
  catch (error) {
   if (saved && error.status !== 403 && error.status !== 404) return respond(saved, 'STALE');
   return Response.json({ error: error.message, retryAfter: error.retryAfter || 0, directAllowed: Boolean(error.directAllowed) }, { status: error.status || 502, headers: { 'Cache-Control': 'no-store', ...(error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) } });
  }
 };
}
