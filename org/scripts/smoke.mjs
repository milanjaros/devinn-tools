// Dependency-free checks for domain code, using Node 24 native TypeScript stripping.
import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);throw error;}}});
const {demoDataset}=await import('../src/data/demo.ts');
const {duplicateScenario,moveSubtree,getPrimaryHierarchy,descendants,validateHierarchy,addRelationship,getVisibleRelationships,fillPosition,removePosition}=await import('../src/domain/graph.ts');
const {commit,undo,redo}=await import('../src/domain/history.ts');
const {defaultTypes}=await import('../src/domain/models.ts');
const {matches}=await import('../src/domain/search.ts');
const {removePerson,departmentNames}=await import('../src/domain/people.ts');

test('Odstranění zaměstnance vyčistí všechny varianty, uvolní pozice a jde vrátit',()=>{
  const data=demoDataset();data.activeScenarioId=data.scenarios.find(s=>!s.protected).id;
  const id='p002',original=structuredClone(data);
  for(const s of data.scenarios){s.view.collapsedIds.push(id);s.view.positions[id]={x:12,y:34};s.positions.push({id:`filled-${s.id}`,title:'Lead',department:'R&D',tagIds:[],status:'filled',occupantId:id});}
  const before=structuredClone(data),next=removePerson(data,id);
  assert.equal(next.people.length,data.people.length-1);
  for(const s of next.scenarios){assert.ok(s.relationships.every(r=>r.sourceId!==id&&r.targetId!==id));assert.ok(!s.view.collapsedIds.includes(id));assert.equal(s.view.positions[id],undefined);assert.equal(s.positions.at(-1).status,'vacant');assert.ok(!('occupantId' in s.positions.at(-1)));assert.deepEqual(s.relationships,before.scenarios.find(v=>v.id===s.id).relationships.filter(r=>r.sourceId!==id&&r.targetId!==id));}
  assert.deepEqual(next.people,original.people.filter(p=>p.id!==id));assert.deepEqual(data,before);
  const history=commit({past:[],present:data,future:[]},next);assert.deepEqual(undo(history).present,data);assert.deepEqual(redo(undo(history)).present,next);
  assert.throws(()=>removePerson({...data,scenarios:data.scenarios.map(s=>({...s,protected:true}))},id));assert.throws(()=>removePerson(data,'missing'));
});

test('Našeptávání oddělení sdílí unikátní neprázdné názvy lidí a pozic',()=>{
  const data=demoDataset();data.people=data.people.slice(0,3).map((p,i)=>({...p,department:[' Vývoj ','Vývoj',''][i]}));
  data.scenarios.forEach(s=>{s.positions=[];});data.scenarios[0].positions.push({id:'vacant',title:'Lead',department:'Finance',tagIds:[],status:'vacant'});
  assert.deepEqual(departmentNames(data),['Finance','Vývoj']);
});
test('Demo: 36 zaměstnanců, 3 různé varianty, konzistentní reference a acyklické typy',()=>{
  const data=demoDataset();assert.equal(data.people.length,36);assert.equal(data.scenarios.length,3);
  for(const s of data.scenarios){for(const t of data.relationshipTypes){const edges=s.relationships.filter(r=>r.type===t.id);validateHierarchy(edges);const primaries=edges.filter(r=>r.primary).map(r=>r.targetId);assert.equal(new Set(primaries).size,primaries.length);if(!t.allowMultipleParents)assert.equal(new Set(edges.map(r=>r.targetId)).size,edges.length);}for(const r of s.relationships){assert.ok(data.people.some(p=>p.id===r.sourceId));assert.ok(data.people.some(p=>p.id===r.targetId));assert.equal(r.scenarioId,s.id);}}
  const signature=s=>JSON.stringify(s.relationships.map(r=>[r.sourceId,r.targetId,r.type,r.primary]));assert.notEqual(signature(data.scenarios[0]),signature(data.scenarios[1]));assert.notEqual(signature(data.scenarios[1]),signature(data.scenarios[2]));
});
test('Přesun celé větve a izolace ostatních vztahů i variant',()=>{
  const data=demoDataset(),original=data.scenarios[0],s=duplicateScenario(original,'Kopie'),hierarchy=getPrimaryHierarchy(s,'organizational');const branch=hierarchy.find(r=>descendants(r.targetId,hierarchy).size>0).targetId;const parent=data.people.find(p=>p.id!==branch&&!descendants(branch,hierarchy).has(p.id)&&p.id!==original.relationships[0].sourceId).id;
  const children=hierarchy.filter(r=>descendants(branch,hierarchy).has(r.targetId));const changed=moveSubtree(s,branch,parent,'organizational',defaultTypes);for(const edge of children)assert.ok(changed.relationships.some(r=>r.id===edge.id));assert.deepEqual(changed.relationships.filter(r=>r.type!=='organizational'),s.relationships.filter(r=>r.type!=='organizational'));assert.notDeepEqual(changed.relationships,s.relationships);assert.equal(original.id,'current');
});
test('Zákaz cyklů, druhého liniového rodiče a editace chráněné varianty',()=>{
  const data=demoDataset(),s=duplicateScenario(data.scenarios[0],'Test');const r=s.relationships[0],child=s.relationships.find(e=>e.sourceId===r.targetId&&e.type==='organizational');assert.throws(()=>moveSubtree(s,r.targetId,child.targetId,'organizational',defaultTypes));assert.throws(()=>moveSubtree({...data.scenarios[0],protected:true},r.targetId,'p010','organizational',defaultTypes));assert.throws(()=>addRelationship(s,{...r,id:'extra',sourceId:'p003'},defaultTypes));assert.throws(()=>validateHierarchy([{sourceId:'a',targetId:'b'},{sourceId:'b',targetId:'a'}]));
});
test('Více projektových rodičů; pouze jeden deterministický primární rodič',()=>{const s=demoDataset().scenarios[2],all=s.relationships.filter(r=>r.type==='project'),primary=getPrimaryHierarchy(s,'project');assert.ok(all.length>primary.length);assert.equal(new Set(primary.map(r=>r.targetId)).size,primary.length);assert.deepEqual(primary,getPrimaryHierarchy({...s,relationships:[...s.relationships].reverse()},'project'));});
test('Viditelnost doplňkových vztahů neovlivní primární hierarchii',()=>{const s=demoDataset().scenarios[0],before=getPrimaryHierarchy(s,'organizational');s.view.visibleTypes.push('professional');assert.ok(getVisibleRelationships(s).length>before.length);assert.deepEqual(getPrimaryHierarchy(s,'organizational'),before);});
test('Kopie přemapuje ID pozic a jejich vztahy',()=>{const s=duplicateScenario(demoDataset().scenarios[0],'Pracovní');s.positions.push({id:'v1',title:'Architect',department:'R&D',tagIds:[],status:'vacant'});s.relationships.push({id:'v-edge',scenarioId:s.id,sourceId:'p001',targetId:'v1',type:'organizational',primary:true});const copy=duplicateScenario(s,'Další');assert.notEqual(copy.positions[0].id,'v1');assert.equal(copy.relationships.at(-1).targetId,copy.positions[0].id);assert.ok(copy.relationships.every(r=>r.scenarioId===copy.id));});
test('Obsazení pozice převádí vazby na existujícího zaměstnance',()=>{const d=demoDataset(),s=duplicateScenario(d.scenarios[0],'Obsazení');s.relationships=s.relationships.filter(r=>r.sourceId!=='p002'&&r.targetId!=='p002');s.positions.push({id:'v1',title:'Lead',department:'R&D',tagIds:[],status:'vacant'});s.relationships.push({id:'v-edge',scenarioId:s.id,sourceId:'p001',targetId:'v1',type:'organizational',primary:true});const next=fillPosition(d,s,'v1','p002');assert.equal(next.positions[0].occupantId,'p002');assert.equal(next.relationships.at(-1).targetId,'p002');assert.equal(next.relationships.some(r=>r.targetId==='v1'),false);});
test('Bezpečné odstranění pozice odstraní souřadnice a ponechá lidi',()=>{const d=demoDataset(),s=duplicateScenario(d.scenarios[0],'Odstranění');s.positions.push({id:'v1',title:'Lead',department:'R&D',tagIds:[],status:'vacant'});s.view.positions.v1={x:2,y:4};const next=removePosition(s,'v1');assert.equal(next.positions.length,0);assert.equal(next.view.positions.v1,undefined);assert.equal(d.people.length,36);});
test('Undo/Redo a zahazování budoucí historie',()=>{const h=commit({past:[],present:1,future:[]},2);assert.equal(undo(h).present,1);assert.equal(redo(undo(h)).present,2);assert.deepEqual(commit(undo(h),3).future,[]);});
test('Vyhledávání bez diakritiky a podle odborného štítku',()=>{const d=demoDataset();assert.ok(matches(d.people[0],d.tags,'jan novak','','',[]));assert.ok(d.people.some(p=>matches(p,d.tags,'AUTOSAR','','',[])));assert.ok(!matches(d.people[0],d.tags,'AUTOSAR','','',[]));});
