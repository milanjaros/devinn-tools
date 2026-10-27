import {mkdir, copyFile, readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const destination=new URL('./www/',import.meta.url);
await mkdir(destination,{recursive:true});
for(const file of ['index.html','style.css','transport.js','app.js']) {
  await copyFile(new URL(`../app/public/${file}`,import.meta.url),new URL(file,destination));
}
// Never let the mobile build silently include references to server-root assets.
const html=await readFile(new URL('index.html',destination),'utf8');
if(/(?:src|href)="\//.test(html))throw new Error('Mobile assets must use relative URLs.');
console.log(`Shared web UI prepared: ${fileURLToPath(destination)}`);
