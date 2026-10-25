const fs = require('fs');
const crypto = require('crypto');
const index = require('./captures/decoded/index.json');
const root = 'exports';
fs.mkdirSync(root + '/photos', {recursive:true});
function decode(s) {
  return s.replace(/&#(x[0-9a-f]+|\d+);/gi, (_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)))
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
const clean = s=>decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const photos = new Map();
for (const f of index.filter(f=>f.status===200 && f.path.includes('GetUserPhoto.ashx') && f.type?.startsWith('image/'))) {
  const body = fs.readFileSync(`captures/decoded/${f.id}.body`);
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  const file = `photos/${hash}.${f.type.includes('png')?'png':'jpg'}`;
  fs.writeFileSync(`${root}/${file}`,body);
  photos.set(new URL(f.path,'https://'+f.host).href,{file,sha256:hash,bytes:body.length});
}
const people = new Map();
let cards=0;
for (const flow of index.filter(f=>f.status===200 && /\/Relations\.aspx/i.test(f.path))) {
  const html = fs.readFileSync(`captures/decoded/${flow.id}.body`,'utf8');
  for (const match of html.matchAll(/<div\s+class=['"]ochPerson\b[^'"]*['"][^>]*>([\s\S]*?)<\/table>/g)) {
    cards++;
    const card = match[1];
    const name = clean(card.match(/<td\s+class=['"]name['"][^>]*>([\s\S]*?)<\/td>/)?.[1] || '');
    const fields = [...card.matchAll(/<td\s+class=['"]jobTitle text-muted['"][^>]*>([\s\S]*?)<\/td>/g)].map(x=>clean(x[1]));
    if (!name || fields.length<3) throw Error('Unrecognized person card');
    const photoPath = decode(card.match(/<img\s+src=['"]([^'"]+)/)?.[1] || '');
    const photoUrl = photoPath ? new URL(photoPath,'https://'+flow.host).href : null;
    const photo = photos.get(photoUrl);
    const email = decode(card.match(/mailto:([^'"]+)/)?.[1] || '').trim().toLowerCase();
    const key = name + '\0' + email;
    if (!people.has(key)) people.set(key,{name,roles:[],photo:null});
    const person = people.get(key);
    const role = {position:fields[0],department:fields[1],employer:fields[2]};
    if (!person.roles.some(r=>JSON.stringify(r)===JSON.stringify(role))) person.roles.push(role);
    if (photo && !person.photo) person.photo={...photo};
  }
}
const result = [...people.values()].sort((a,b)=>a.name.localeCompare(b.name,'cs'));
// Identical image bytes for several people are flagged for review (often default avatars).
const frequency = new Map();
for (const p of result) if(p.photo) frequency.set(p.photo.sha256,(frequency.get(p.photo.sha256)||0)+1);
for (const p of result) if(p.photo) p.photo.sharedByPeople=frequency.get(p.photo.sha256);
fs.writeFileSync(root+'/people.json',JSON.stringify(result,null,2)+'\n');
const report={source:'captures/plusportal.mitm',cards,people:result.length,roles:result.reduce((n,p)=>n+p.roles.length,0),withPhoto:result.filter(p=>p.photo).length,withoutPhoto:result.filter(p=>!p.photo).map(p=>p.name),sharedImagePeople:result.filter(p=>p.photo?.sharedByPeople>1).length};
fs.writeFileSync(root+'/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
