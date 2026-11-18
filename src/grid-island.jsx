import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import GridMotion from './components/GridMotion.jsx';
import covers from './covers.json';
function CoverWall(){
 const [active,setActive]=useState(true);
 useEffect(()=>{const update=e=>setActive(e.detail);window.addEventListener('archive:gate',update);return ()=>window.removeEventListener('archive:gate',update);},[]);
 return <GridMotion items={covers} rows={4} aspectRatio={.7} gap={14} radius={9} angle={-12} speed={18} direction="alternate" parallax={.22} spotlight={.45} dim={.45} fade={.3} active={active}/>;
}
const target=document.getElementById('coverWall');
if(target)createRoot(target).render(<CoverWall/>);

function ReportWall({items}){
 const [active,setActive]=useState(true);
 useEffect(()=>{const update=e=>setActive(!e.detail);window.addEventListener('archive:gate',update);return ()=>window.removeEventListener('archive:gate',update);},[]);
 return <GridMotion items={items} rows={4} aspectRatio={.7} gap={14} radius={8} angle={-9} speed={10} parallax={.15} dim={.5} spotlight={.35} fade={.4} active={active}/>;
}
let reportRoot;
window.addEventListener('archive:report',event=>{
 reportRoot?.unmount();
 const target=document.getElementById('reportCoverWall');
 if(!target||!event.detail.items.length)return;
 reportRoot=createRoot(target);
 reportRoot.render(<ReportWall items={event.detail.items}/>);
});
