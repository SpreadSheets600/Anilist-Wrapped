'use client';
// Adapted from the React Bits GridMotion source supplied for this project.
import { isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import './GridMotion.css';
const THEMES = {
 dark: { tile: '#171a15', text: 'rgba(255,255,255,.78)', border: 'rgba(255,255,255,.07)' },
 light: { tile: '#f4f4f5', text: '#3f3f46', border: 'rgba(24,24,27,.08)' },
};
const IMAGE = /^(https?:\/\/|\/\/|\/|\.\.?\/|data:image\/|blob:)|\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i;
const INERTIA = [.42,.32,.26,.22], PACE = [1,.86,1.12,.94];
const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
const wrap = (v,total) => ((v%total)+total)%total;
const smoothstep = (a,b,v) => { const t=clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
function feather(side,zone) {
 const stops=[], mirrored=[];
 for(let i=0;i<=12;i++) { const t=i/12,alpha=t*t*t*(t*(t*6-15)+10); stops.push(`rgba(0,0,0,${alpha.toFixed(4)}) ${(t*zone).toFixed(2)}%`); }
 for(let i=0;i<=12;i++) { const t=(12-i)/12,alpha=t*t*t*(t*(t*6-15)+10); mirrored.push(`rgba(0,0,0,${alpha.toFixed(4)}) ${(100-t*zone).toFixed(2)}%`); }
 return `linear-gradient(${side},${stops.join(',')},${mirrored.join(',')})`;
}
function toTile(item) {
 if(item==null||item===false) return {kind:'empty'};
 if(isValidElement(item)) return {kind:'node',node:item};
 if(typeof item==='object'&&typeof item.src==='string') return {kind:'image',src:item.src,alt:item.alt??''};
 const text=String(item).trim();return IMAGE.test(text)?{kind:'image',src:text,alt:''}:{kind:'text',text};
}
function Tile({tile}) {
 return <div className="grid-motion__tile">{tile.kind==='image'&&<img src={tile.src} alt={tile.alt} draggable={false} decoding="async"/>}{tile.kind==='text'&&<span className="grid-motion__text">{tile.text}</span>}{tile.kind==='node'&&tile.node}</div>;
}
export default function GridMotion({items=[],rows=4,aspectRatio=1.33,gap=16,radius=14,angle=-12,tilt=0,speed=24,direction='alternate',parallax=.5,spotlight=.6,dim=.35,grayscale=false,fade=.5,tileColor,textColor,theme='dark',className='',style,active=true}) {
 const rootRef=useRef(null),planeRef=useRef(null);
 const motionRef=useRef({offsets:[],shifts:[],intro:0,pointer:{x:0,y:0,active:false}});
 const [size,setSize]=useState({width:0,height:0});
 const [still,setStill]=useState(()=>matchMedia('(max-width: 760px), (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{
  const query=matchMedia('(max-width: 760px), (hover: none), (pointer: coarse), (prefers-reduced-motion: reduce)');
  const update=()=>setStill(query.matches);query.addEventListener('change',update);
  return ()=>query.removeEventListener('change',update);
 },[]);
 const palette=THEMES[theme]??THEMES.dark;
 const settings={rows:clamp(Math.round(rows),1,12),aspect:clamp(aspectRatio,.3,4),gap:Math.max(0,gap),angle,tilt:clamp(tilt,0,75),speed,direction:['alternate','left','right'].includes(direction)?direction:'alternate',parallax:clamp(parallax,0,1),spotlight:clamp(spotlight,0,1),dim:clamp(dim,0,1),fade:clamp(fade,0,1)};
 const settingsRef=useRef(settings);settingsRef.current=settings;
 const layout=useMemo(()=>{
  const {width,height}=size;if(!width||!height)return null;
  const turn=settings.angle*Math.PI/180,lean=settings.tilt*Math.PI/180,cos=Math.abs(Math.cos(turn)),sin=Math.abs(Math.sin(turn));
  const planeHeight=(width*sin+height*cos)/Math.max(.3,Math.cos(lean))*1.12;
  const planeWidth=(width*cos+height*sin)*(1+Math.sin(lean)*.9)*1.12;
  const tileHeight=Math.max(16,(planeHeight-settings.gap*(settings.rows-1))/settings.rows),tileWidth=tileHeight*settings.aspect;
  const step=tileWidth+settings.gap,perRow=Math.ceil(planeWidth/step)+1,period=perRow*step;
  return {planeWidth,planeHeight,tileWidth,tileHeight,step,perRow,period,copies:still?1:Math.ceil(planeWidth/period)+2,top:(planeHeight-settings.rows*tileHeight-(settings.rows-1)*settings.gap)/2,perspective:Math.max(width,height)*1.5};
 },[size,settings.angle,settings.tilt,settings.rows,settings.gap,settings.aspect,still]);
 const tiles=useMemo(()=>items.map(toTile),[items]);
 useEffect(()=>{
  const root=rootRef.current;if(!root)return;
  const measure=()=>{const width=Math.round(root.clientWidth),height=Math.round(root.clientHeight);setSize(s=>s.width===width&&s.height===height?s:{width,height});};
  const observer=new ResizeObserver(measure);observer.observe(root);measure();
  const pointer=motionRef.current.pointer;
  if(still){pointer.active=false;return ()=>observer.disconnect();}
  const onMove=e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=true;};
  const onUp=e=>{if(e.pointerType==='touch')pointer.active=false;};
  const onLeave=()=>{pointer.active=false;};
  window.addEventListener('pointermove',onMove,{passive:true});window.addEventListener('pointerdown',onMove,{passive:true});window.addEventListener('pointerup',onUp);window.addEventListener('blur',onLeave);document.documentElement.addEventListener('pointerleave',onLeave);
  return ()=>{observer.disconnect();window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerdown',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('blur',onLeave);document.documentElement.removeEventListener('pointerleave',onLeave);};
 },[still]);
 useEffect(()=>{
  const root=rootRef.current,plane=planeRef.current;if(!root||!plane||!layout||!active)return;
  if(still){
   plane.style.opacity='1';
   Array.from(plane.children).forEach((row,r)=>{row.style.transform=`translateX(${-wrap(r*layout.step*.37,layout.step)}px)`;});
   return;
  }
  const motion=motionRef.current;
  const rowEls=Array.from(plane.children),tileEls=rowEls.map(row=>Array.from(row.children));
  const spots=tileEls.map(list=>new Float32Array(list.length)),written=tileEls.map(list=>new Float32Array(list.length));
  let raf=0,last=performance.now(),visible=true,alive=true;
  const frame=now=>{
   raf=0;if(!alive||document.hidden)return;
   const s=settingsRef.current,dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;
   motion.intro=Math.min(1,motion.intro+dt/.9);plane.style.opacity=String(1-(1-motion.intro)**3);
   const rect=root.getBoundingClientRect(),scale=rect.width?root.clientWidth/rect.width:1,halfWidth=root.clientWidth/2||1,halfHeight=root.clientHeight/2||1;
   const px=(motion.pointer.x-rect.left)*scale-halfWidth,py=(motion.pointer.y-rect.top)*scale-halfHeight;
   const inside=motion.pointer.active&&Math.abs(px)<=halfWidth&&Math.abs(py)<=halfHeight;
   const lean=s.tilt*Math.PI/180,turn=s.angle*Math.PI/180,depth=layout.perspective;
   let flatY=py,flatX=px;if(lean>.0001){flatY=py*depth/(depth*Math.cos(lean)+py*Math.sin(lean));flatX=px*(depth-flatY*Math.sin(lean))/depth;}
   const planeX=flatX*Math.cos(turn)+flatY*Math.sin(turn),planeY=-flatX*Math.sin(turn)+flatY*Math.cos(turn);
   const nudge=motion.pointer.active?clamp(px/halfWidth,-1,1):0,reach=(.6+2.2*s.spotlight)*Math.max(layout.tileWidth,layout.tileHeight),settle=1-Math.exp(-dt/.22);
   rowEls.forEach((row,r)=>{
    const drift=s.direction==='left'?-1:s.direction==='right'?1:r%2?1:-1;
    if(motion.offsets[r]===undefined){motion.offsets[r]=r*layout.step*.37;motion.shifts[r]=0;}
    motion.offsets[r]+=s.speed*drift*PACE[r%PACE.length]*dt;
    const target=s.parallax*layout.tileWidth*1.2*nudge*(r%2?-1:1);
    motion.shifts[r]+=(target-motion.shifts[r])*(1-Math.exp(-dt/INERTIA[r%INERTIA.length]));
    const x=-layout.period+wrap(motion.offsets[r]+motion.shifts[r],layout.period);row.style.transform=`translate3d(${x.toFixed(2)}px,0,0)`;
    const rowY=layout.top+r*(layout.tileHeight+s.gap)+layout.tileHeight/2-layout.planeHeight/2,left=x-layout.planeWidth/2+layout.tileWidth/2;
    tileEls[r].forEach((tile,k)=>{
     const wanted=inside&&s.spotlight>0?1-smoothstep(.25,1,Math.hypot(left+k*layout.step-planeX,rowY-planeY)/reach):0;
     spots[r][k]+=(wanted-spots[r][k])*settle;
     if(Math.abs(spots[r][k]-written[r][k])>.004||(wanted===0&&spots[r][k]<.004&&written[r][k]!==0)){written[r][k]=spots[r][k]<.004?0:spots[r][k];tile.style.setProperty('--spot',written[r][k].toFixed(3));}
    });
   });
   if(visible)raf=requestAnimationFrame(frame);
  };
  const resume=()=>{if(visible&&!document.hidden&&!raf){last=performance.now();raf=requestAnimationFrame(frame);}};
  const visibility=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);if(!visible){cancelAnimationFrame(raf);raf=0;}else resume();});
  const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else resume();};
  visibility.observe(root);document.addEventListener('visibilitychange',onVisibility);resume();
  return ()=>{alive=false;cancelAnimationFrame(raf);visibility.disconnect();document.removeEventListener('visibilitychange',onVisibility);};
 },[layout,tiles,active,still]);
 const rowTiles=layout?Array.from({length:settings.rows},(_,r)=>Array.from({length:layout.perRow},(_,j)=>tiles.length?tiles[(r*layout.perRow+j)%tiles.length]:{kind:'empty'})):[];
 const mask=settings.fade>0?`${feather('to right',settings.fade*34)},${feather('to bottom',settings.fade*44)}`:undefined;
 return <div ref={rootRef} className={`grid-motion${still?' grid-motion--still':''}${grayscale?' grid-motion--gray':''}${className?` ${className}`:''}`} style={{'--gm-tile':tileColor??palette.tile,'--gm-text':textColor??palette.text,'--gm-border':palette.border,'--gm-radius':`${Math.max(0,radius)}px`,'--gm-dim':settings.dim,perspective:layout&&settings.tilt>0?`${layout.perspective}px`:undefined,maskImage:mask,WebkitMaskImage:mask,maskComposite:mask?'intersect':undefined,WebkitMaskComposite:mask?'source-in':undefined,...style}}>
  {layout&&<div ref={planeRef} className="grid-motion__plane" aria-hidden="true" style={{width:layout.planeWidth,height:layout.planeHeight,transform:`translate(-50%,-50%) rotateX(${settings.tilt}deg) rotateZ(${settings.angle}deg)`,'--gm-gap':`${settings.gap}px`,'--gm-tile-w':`${layout.tileWidth}px`,'--gm-tile-h':`${layout.tileHeight}px`,'--gm-font':`${clamp(layout.tileHeight*.12,12,32)}px`}}>
   {rowTiles.map((sequence,r)=><div key={r} className="grid-motion__row" style={{top:layout.top+r*(layout.tileHeight+settings.gap)}}>{Array.from({length:layout.copies*layout.perRow},(_,k)=><Tile key={k} tile={sequence[k%layout.perRow]}/>)}</div>)}
  </div>}
 </div>;
}
