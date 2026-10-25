const fs = require('fs');
const {randomUUID} = require('crypto');
const assert = require('node:assert/strict');
const people = JSON.parse(fs.readFileSync('people-import.json','utf8')).people;
const byName = new Map(people.map(p=>[p.name,p.id]));
assert.equal(byName.size,people.length,'Names must be unique for matching');
const index = require('./captures/decoded/index.json');
const decode = s=>s.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');
const clean = s=>decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const edges = new Map();
let cards=0,roots=0,selfLinks=0;
for (const flow of index.filter(f=>f.status===200 && /\/Relations\.aspx/i.test(f.path))) {
  const html = fs.readFileSync(`captures/decoded/${flow.id}.body`,'utf8');
  const stack=[],tables=[];
  // The source has malformed innerLayout opening tags without a closing >.
  // Read only table/td nesting, accepting those line-terminated opening tags.
  for (const m of html.matchAll(/<\/?(?:table|td)\b[^>\r\n]*(?:>|(?=\r?\n))/gi)) {
    const tag = m[0].match(/^<\/?(\w+)/)[1].toLowerCase();
    if(m[0].startsWith('</')) {
      const node=stack.pop();
      assert(node && node.tag===tag,`Unbalanced ${tag} at ${m.index}`);
      node.end=m.index;
    } else {
      const node={tag,start:m.index,contentStart:m.index+m[0].length,parent:stack.at(-1),children:[],chart:/class=['"]ochTable['"]/.test(m[0]),manager:/class=['"]ochCellManager['"]/.test(m[0]),subordinate:/class=['"]ochCellSubordinate['"]/.test(m[0])};
      node.parent?.children.push(node);
      stack.push(node);
      if(node.chart) tables.push(node);
    }
  }
  assert.equal(stack.length,0,'Unclosed tables/cells');
  for (const table of tables) {
    const manager = table.children.find(n=>n.manager);
    assert(manager,'Chart missing manager');
    const content=html.slice(manager.contentStart,manager.end);
    const name=clean(content.match(/<td\s+class=['"]name['"][^>]*>([\s\S]*?)<\/td>/)?.[1]||'');
    assert(byName.has(name),`Unknown person: ${name}`);
    table.personId=byName.get(name);
    cards++;
    let parent=table.parent;
    if (!parent?.subordinate) { roots++; continue; }
    while(parent && !parent.chart) parent=parent.parent;
    assert(parent?.personId,'Missing parent person');
    if(parent.personId===table.personId) { selfLinks++; continue; }
    const key=parent.personId+'\0'+table.personId;
    if(!edges.has(key)) edges.set(key,{id:randomUUID(),sourceId:parent.personId,targetId:table.personId,type:'organizational',primary:true,scenarioId:'50d7e04e-b91b-4b13-aab5-f1073a14c77d'});
  }
}
assert(cards>0,'No organization chart found');
const relationships=[...edges.values()];
const ids=new Set(people.map(p=>p.id));
for(const r of relationships) assert(ids.has(r.sourceId)&&ids.has(r.targetId));
const adjacency=new Map();
for(const r of relationships){if(!adjacency.has(r.sourceId))adjacency.set(r.sourceId,[]);adjacency.get(r.sourceId).push(r.targetId);}
function visit(id,path=new Set()) {assert(!path.has(id),'Hierarchy cycle at '+id); const next=new Set(path).add(id); for(const child of adjacency.get(id)||[])visit(child,next);}
for(const id of ids)visit(id);
fs.writeFileSync('relationships.json',JSON.stringify({relationships},null,2)+'\n');
console.log(JSON.stringify({cards,roots,selfLinksSkipped:selfLinks,relationships:relationships.length,contactsInHierarchy:new Set(relationships.flatMap(r=>[r.sourceId,r.targetId])).size},null,2));
