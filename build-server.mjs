import {readFile,writeFile} from 'node:fs/promises';
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
const path=new URL('./bot/server.ts',import.meta.url);
const source=await readFile(path,'utf8');
const marker=source.indexOf('const html=');
if(marker<0)throw Error('HTML marker missing');
const end=source.indexOf('\n',marker);
await writeFile(path,source.slice(0,marker)+'const html='+JSON.stringify(html)+';'+source.slice(end));
console.log('Server HTML updated');
