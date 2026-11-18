import test from 'node:test';
import assert from 'node:assert/strict';
import {createArchiveService,FRESH_MS,RETAIN_MS,retrySeconds} from '../server/archive.mjs';
class MemoryCache {
 values=new Map();
 async match(key){return this.values.get(String(key))?.clone();}
 async put(key,response){this.values.set(String(key),response.clone());}
}
const initial=()=>({data:{User:{id:42,name:'AnimeFan',avatar:{large:''},favourites:{characters:{nodes:[]},staff:{nodes:[]}}},anime:{hasNextChunk:false,lists:[{entries:[{media:{id:1},progress:12}]}]},manga:{hasNextChunk:false,lists:[]}}});
const request=name=>new Request(`https://archive.test/api/archive?username=${encodeURIComponent(name)}`);
const json=(value,status=200,headers={})=>Response.json(value,{status,headers});
test('normalized usernames and canonical names share a cache indexed by user ID',async()=>{
 const cache=new MemoryCache();let calls=0;
 const service=createArchiveService({cache,fetcher:async()=>{calls++;return json(initial());}});
 assert.equal((await service(request('Alias'))).headers.get('X-Archive-Cache'),'MISS');
 assert.equal((await service(request(' alias '))).headers.get('X-Archive-Cache'),'HIT');
 assert.equal((await service(request('ANIMEFAN'))).headers.get('X-Archive-Cache'),'HIT');
 assert.equal(calls,1);assert([...cache.values.keys()].some(k=>k.endsWith('/id/42')));
});
test('simultaneous requests for one profile reuse a single upstream request',async()=>{
 let calls=0;let release;const waiting=new Promise(r=>release=r);
 const service=createArchiveService({cache:new MemoryCache(),fetcher:async()=>{calls++;await waiting;return json(initial());}});
 const a=service(request('AnimeFan')),b=service(request('animefan'));await new Promise(r=>setTimeout(r,0));release();
 const [ra,rb]=await Promise.all([a,b]);assert.equal(ra.status,200);assert.equal(rb.status,200);assert.equal(calls,1);
});
test('large lists fetch every remaining chunk before caching a complete archive',async()=>{
 const queries=[];const service=createArchiveService({cache:new MemoryCache(),fetcher:async(_,options)=>{
  const body=JSON.parse(options.body);queries.push(body.variables);
  if(body.variables.name){const first=initial();first.data.anime.hasNextChunk=true;return json(first);}
  return json({data:{collection:{hasNextChunk:body.variables.chunk===2,lists:[{entries:[{media:{id:body.variables.chunk}}]}]}}});
 }});
 const response=await (await service(request('AnimeFan'))).json();
 assert.equal(response.data.anime.lists.length,3);assert.deepEqual(queries.slice(1),[{id:42,type:'ANIME',chunk:2},{id:42,type:'ANIME',chunk:3}]);
});
test('expired fresh data returns instantly and refreshes in the background',async()=>{
 let now=1000,calls=0;const tasks=[];const service=createArchiveService({cache:new MemoryCache(),now:()=>now,fetcher:async()=>{calls++;return json(initial());}});
 await service(request('AnimeFan'));now+=FRESH_MS+1;
 const response=await service(request('AnimeFan'),{waitUntil:p=>tasks.push(p)});
 assert.equal(response.headers.get('X-Archive-Cache'),'STALE');await Promise.all(tasks);
 assert.equal(calls,2);assert.equal((await service(request('AnimeFan'))).headers.get('X-Archive-Cache'),'HIT');
});
test('snapshots older than 24 hours are not served as a fallback',async()=>{
 let now=1000,failed=false;const service=createArchiveService({cache:new MemoryCache(),now:()=>now,fetcher:async()=>failed?json({},503):json(initial())});
 await service(request('AnimeFan'));now+=RETAIN_MS+1;failed=true;
 assert.equal((await service(request('AnimeFan'))).status,502);
});
test('Retry-After stops new upstream requests across profiles and service instances',async()=>{
 const cache=new MemoryCache();let calls=0;const fetcher=async()=>{calls++;return json({},429,{'Retry-After':'17'});};
 const service=createArchiveService({cache,fetcher});
 const first=await service(request('AnimeFan'));assert.equal(first.status,429);assert.equal(first.headers.get('Retry-After'),'17');
 const second=createArchiveService({cache,fetcher});assert.equal((await second(request('AnotherFan'))).status,429);assert.equal(calls,1);
});
test('upstream timeout ends the request even if fetch ignores abort',async()=>{
 const service=createArchiveService({cache:new MemoryCache(),timeoutMs:15,fetcher:()=>new Promise(()=>{})});
 const response=await service(request('AnimeFan'));assert.equal(response.status,504);assert.match((await response.json()).error,/too long/);
});
test('timeout also bounds a stalled JSON response body',async()=>{
 const service=createArchiveService({cache:new MemoryCache(),timeoutMs:15,fetcher:async()=>({ok:true,status:200,headers:new Headers(),json:()=>new Promise(()=>{})})});
 assert.equal((await service(request('AnimeFan'))).status,504);
});
test('private, missing, and incomplete responses are never stored as successful archives',async()=>{
 for(const response of [json({errors:[{message:'Private'}]},403),json({errors:[{message:'Not found'}]},404),json({data:{User:{id:42,name:'AnimeFan'},anime:null,manga:null}})]){
  const cache=new MemoryCache();let calls=0;const service=createArchiveService({cache,fetcher:async()=>{calls++;return response.clone();}});
  assert.notEqual((await service(request('AnimeFan'))).status,200);assert.notEqual((await service(request('AnimeFan'))).status,200);
  assert.equal(calls,2);assert.equal(cache.values.size,0);
 }
});
test('cache outages do not prevent a successful recap',async()=>{
 const service=createArchiveService({cache:{match:async()=>{throw Error('cache down');},put:async()=>{throw Error('cache down');}},fetcher:async()=>json(initial())});
 assert.equal((await service(request('AnimeFan'))).status,200);
});
test('bad input and unsupported methods never call AniList',async()=>{
 let calls=0;const service=createArchiveService({fetcher:async()=>{calls++;return json(initial());}});
 assert.equal((await service(request(''))).status,400);assert.equal((await service(request('x'.repeat(51)))).status,400);
 assert.equal((await service(new Request(request('AnimeFan'),{method:'POST'}))).status,405);assert.equal(calls,0);
});
test('retry delays accept seconds and HTTP dates',()=>{
 assert.equal(retrySeconds('23',0),23);assert.equal(retrySeconds('Thu, 01 Jan 1970 00:01:00 GMT',0),60);assert.equal(retrySeconds(null,0),60);
});

test('an upstream egress rejection is not misreported as a private profile',async()=>{
 const cache=new MemoryCache();let calls=0;
 const service=createArchiveService({cache,fetcher:async()=>{calls++;return new Response('<html>Forbidden</html>',{status:403,headers:{'Content-Type':'text/html'}});}});
 const first=await service(request('AnimeFan'));assert.equal(first.status,502);assert.equal((await first.json()).directAllowed,true);
 const next=await service(request('AnotherFan'));assert.equal(next.status,502);assert.equal((await next.json()).directAllowed,true);assert.equal(calls,1);
});
