const fs = require('fs');
const assert = require('node:assert/strict');
const people = require('./exports/people.json');
const index = require('./captures/decoded/index.json');
const decode = s => s.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1),16) : Number(n)))
  .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ');
const clean = s => decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const contacts = new Map(), codes = new Map();
for (const flow of index.filter(f => f.status === 200 && /\/Relations\.aspx/i.test(f.path))) {
  const html = fs.readFileSync(`captures/decoded/${flow.id}.body`,'utf8');
  for (const m of html.matchAll(/<option\s+value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)) {
    const label = clean(m[2]);
    const parts = label.match(/^(.+?)\s+\((\d+)\)\s*-/);
    if (!parts) continue;
    if (!codes.has(parts[1])) codes.set(parts[1],new Set());
    codes.get(parts[1]).add(parts[2]);
  }
  for (const m of html.matchAll(/<div\s+class=['"]ochPerson\b[^'"]*['"][^>]*>([\s\S]*?)<\/table>/g)) {
    const card = m[1];
    const name = clean(card.match(/<td\s+class=['"]name['"][^>]*>([\s\S]*?)<\/td>/)?.[1] || '');
    const fields = [...card.matchAll(/<td\s+class=['"]jobTitle text-muted['"][^>]*>([\s\S]*?)<\/td>/g)].map(x=>clean(x[1]));
    if (!contacts.has(name)) contacts.set(name,{emails:new Set(),phones:new Set()});
    const c = contacts.get(name);
    const email = decode(card.match(/mailto:([^'"]+)/)?.[1] || '').trim();
    if (email) c.emails.add(email);
    if (fields[3]) c.phones.add(fields[3]);
  }
}
const join = values => [...new Set(values.filter(Boolean))].join('; ');
const output = {schemaVersion:1,people:people.map((p,i)=>{
  const c = contacts.get(p.name);
  assert(c,`Missing source card: ${p.name}`);
  const image = fs.readFileSync('exports/'+p.photo.file);
  const mime = p.photo.file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const record = {
    id:'p'+String(i+1).padStart(3,'0'),name:p.name,
    employer:join(p.roles.map(r=>r.employer)),
    position:join(p.roles.map(r=>r.position)),
    department:join(p.roles.map(r=>r.department)),
    photo:`data:${mime};base64,${image.toString('base64')}`,
    email:join([...c.emails]),phone:join([...c.phones]),description:''
  };
  const sourceCodes = [...(codes.get(p.name)||[])];
  if (sourceCodes.length === 1) record.code = sourceCodes[0];
  else if (sourceCodes.length > 1) record.codes = sourceCodes;
  assert(Buffer.from(record.photo.split(',')[1],'base64').equals(image));
  return record;
})};
fs.writeFileSync('people-import.json',JSON.stringify(output,null,2)+'\n');
const saved = JSON.parse(fs.readFileSync('people-import.json','utf8'));
assert.equal(new Set(saved.people.map(p=>p.id)).size,people.length);
console.log(JSON.stringify({people:saved.people.length,withEmail:saved.people.filter(p=>p.email).length,withPhone:saved.people.filter(p=>p.phone).length,withCode:saved.people.filter(p=>p.code).length,bytes:fs.statSync('people-import.json').size},null,2));
