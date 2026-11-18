import { createArchiveService } from './server/archive.mjs';
let archive;
export default {
 async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/health') return Response.json({ status: 'ok' });
  if (url.pathname === '/api/archive') {
   archive ||= createArchiveService({ cache: caches.default });
   return archive(request, ctx);
  }
  return env.ASSETS.fetch(request);
 }
};
