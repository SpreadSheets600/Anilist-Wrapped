import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
await build({entryPoints:{'grid-motion':'src/grid-island.jsx','anilist-direct':'src/anilist-direct.js'},bundle:true,minify:true,format:'iife',target:['es2020'],jsx:'automatic',outdir:'static/js',define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
const html=await readFile('static/index.html','utf8');
const template=html.replace(/(["'])\/(css|js|images)\/([^"']+)(["'])/g,(_,quote,dir,path,end)=>`${quote}{{ url_for('static', filename='${dir}/${path}') }}${end}`);
await writeFile('templates/index.html',template);
console.log('Built React Bits cover wall and synchronized the Flask entrypoint.');
