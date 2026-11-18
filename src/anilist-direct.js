import {INITIAL,NEXT} from '../server/queries.mjs';
// Used only when AniList blocks the server's egress, never to bypass a 429 cooldown.
window.ArchiveDirect = async function direct(name, signal, onStage) {
 async function query(query, variables) {
  const controller=new AbortController();let timedOut=false;
  const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},12000);
  try {
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   const response=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query,variables}),signal:controller.signal});
   const body=await response.json().catch(()=>null);
   if(response.status===429){
    const retry=response.headers.get('Retry-After');const numeric=Number(retry);
    const delay=retry&&Number.isFinite(numeric)?Math.max(1,Math.ceil(numeric)):Math.max(1,Math.ceil((Date.parse(retry)-Date.now())/1000))||60;
    throw Object.assign(new Error('AniList is taking a breather.'),{status:429,retryAfter:delay});
   }
   const error=body?.errors?.[0];
   if(response.status===404||/not found/i.test(error?.message||''))throw Object.assign(new Error('No AniList user by that name. Check the spelling?'),{status:404});
   if(/private|unauthorized/i.test(error?.message||''))throw Object.assign(new Error('That AniList profile or its lists are private.'),{status:403});
   if(!response.ok||error||!body?.data)throw new Error('AniList could not load your archive right now. Please try again.');
   return body.data;
  } catch(error){
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   if(timedOut)throw new Error('AniList is taking longer than usual. Please try again in a moment.');
   throw error;
  } finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
 }
 onStage('Connecting to your AniList profile…');
 const data=await query(INITIAL,{name});
 if(!data.User?.id)throw Object.assign(new Error('No AniList user by that name. Check the spelling?'),{status:404});
 for(const type of ['ANIME','MANGA']){
  const collection=data[type.toLowerCase()];
  if(!Array.isArray(collection?.lists))throw new Error('AniList returned an incomplete archive. Please try again.');
  let more=collection.hasNextChunk;
  for(let chunk=2;more;chunk++){
   onStage(`Opening more of your ${type==='ANIME'?'anime':'manga'}…`);
   const next=(await query(NEXT,{id:data.User.id,type,chunk})).collection;
   if(!Array.isArray(next?.lists))throw new Error('AniList returned an incomplete archive. Please try again.');
   collection.lists.push(...next.lists);more=next.hasNextChunk;
  }
  delete collection.hasNextChunk;
 }
 return {data:{user:data.User,anime:data.anime,manga:data.manga},fetchedAt:Date.now(),cache:'DIRECT'};
};
