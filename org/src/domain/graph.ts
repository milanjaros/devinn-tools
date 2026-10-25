import { type Dataset, type Scenario, type Relationship, type RelationshipType, uid } from './models';

export function getPrimaryHierarchy(scenario: Scenario, type: string): Relationship[] {
  const sorted = scenario.relationships.filter(r=>r.type===type).sort((a,b)=>Number(b.primary)-Number(a.primary)||a.sourceId.localeCompare(b.sourceId)||a.id.localeCompare(b.id));
  const seen = new Set<string>();
  return sorted.filter(r=> { if(seen.has(r.targetId)) return false; seen.add(r.targetId); return true; });
}
export function getVisibleRelationships(scenario: Scenario): Relationship[] { return scenario.relationships.filter(r=>scenario.view.visibleTypes.includes(r.type)); }
export function descendants(id: string, edges: Relationship[]): Set<string> {
  const result = new Set<string>(); const queue = [id];
  while(queue.length) { const current=queue.pop()!; for(const r of edges) if(r.sourceId===current && !result.has(r.targetId) && r.targetId!==id) {result.add(r.targetId);queue.push(r.targetId);} }
  return result;
}
export function validateHierarchy(edges: Relationship[]): void {
  const children = new Map<string,string[]>();
  for(const r of edges) children.set(r.sourceId,[...(children.get(r.sourceId)||[]),r.targetId]);
  const visited=new Set<string>(), active=new Set<string>();
  function visit(id:string) { if(active.has(id)) throw new Error('Vztah by vytvořil cyklus v hierarchii.'); if(visited.has(id))return; active.add(id); for(const child of children.get(id)||[]) visit(child); active.delete(id); visited.add(id); }
  for(const id of children.keys())visit(id);
}
export function assertEditable(s:Scenario) { if(s.protected) throw new Error('Výchozí varianta je chráněná. Nejprve vytvořte kopii.'); }
export function addRelationship(s:Scenario,r:Relationship,types:RelationshipType[]):Scenario {
  assertEditable(s); const type=types.find(t=>t.id===r.type); if(!type)throw new Error('Neznámý typ vztahu.');
  if(r.sourceId===r.targetId)throw new Error('Uzel nemůže vést sám sebe.');
  if(s.relationships.some(e=>e.sourceId===r.sourceId&&e.targetId===r.targetId&&e.type===r.type))throw new Error('Tento vztah již existuje.');
  if(!type.allowMultipleParents&&s.relationships.some(e=>e.targetId===r.targetId&&e.type===r.type))throw new Error('Tento typ vztahu povoluje pouze jednoho nadřízeného. Použijte Přesunout pod.');
  const relationships=[...s.relationships.map(e=>r.primary&&e.type===r.type&&e.targetId===r.targetId?{...e,primary:false}:e),r];
  validateHierarchy(relationships.filter(e=>e.type===r.type));
  return {...s,relationships,updatedAt:new Date().toISOString()};
}
export function removeRelationship(s:Scenario,id:string):Scenario { assertEditable(s);return {...s,relationships:s.relationships.filter(r=>r.id!==id),updatedAt:new Date().toISOString()}; }
export function setPrimary(s:Scenario,id:string):Scenario {assertEditable(s);const r=s.relationships.find(e=>e.id===id);if(!r)throw new Error('Vztah neexistuje.');return {...s,relationships:s.relationships.map(e=>e.type===r.type&&e.targetId===r.targetId?{...e,primary:e.id===id}:e),updatedAt:new Date().toISOString()};}
export function moveSubtree(s:Scenario,nodeId:string,parentId:string,type:string,types:RelationshipType[]):Scenario {
  assertEditable(s);
  if(parentId===nodeId||descendants(nodeId,s.relationships.filter(r=>r.type===type)).has(parentId))throw new Error('Nelze přesunout uzel pod sebe nebo svého potomka.');
  const old=getPrimaryHierarchy(s,type).find(r=>r.targetId===nodeId);
  const remaining=s.relationships.filter(r=>r.id!==old?.id);
  const existing=remaining.find(r=>r.targetId===nodeId&&r.sourceId===parentId&&r.type===type);
  if(existing)return setPrimary({...s,relationships:remaining},existing.id);
  return addRelationship({...s,relationships:remaining},{id:uid(),sourceId:parentId,targetId:nodeId,type,primary:true,scenarioId:s.id},types);
}
export function duplicateScenario(s:Scenario,name:string):Scenario {
  const id=uid(), now=new Date().toISOString(), mapping=new Map(s.positions.map(p=>[p.id,uid()]));
  const mapId=(value:string)=>mapping.get(value)||value;
  return {...structuredClone(s),id,name,protected:false,createdAt:now,updatedAt:now,
    positions:s.positions.map(p=>({...structuredClone(p),id:mapId(p.id)})),
    relationships:s.relationships.map(r=>({...r,id:uid(),scenarioId:id,sourceId:mapId(r.sourceId),targetId:mapId(r.targetId)})),
    view:{...structuredClone(s.view),collapsedIds:s.view.collapsedIds.map(mapId),positions:Object.fromEntries(Object.entries(s.view.positions).map(([key,value])=>[mapId(key),value]))}};
}
export function fillPosition(data:Dataset,s:Scenario,positionId:string,personId:string):Scenario {
  assertEditable(s);if(!data.people.some(p=>p.id===personId))throw new Error('Zaměstnanec neexistuje.');
  if(!s.positions.some(p=>p.id===positionId&&p.status==='vacant'))throw new Error('Neobsazená pozice neexistuje.');
  const candidate={...s,positions:s.positions.map(p=>p.id===positionId?{...p,status:'filled' as const,occupantId:personId}:p),relationships:s.relationships.map(r=>({...r,sourceId:r.sourceId===positionId?personId:r.sourceId,targetId:r.targetId===positionId?personId:r.targetId})),view:{...s.view,positions:{},collapsedIds:s.view.collapsedIds.filter(id=>id!==positionId)}};
  for(const type of data.relationshipTypes) {
    const edges=candidate.relationships.filter(r=>r.type===type.id); validateHierarchy(edges);
    const keys=edges.map(r=>`${r.sourceId}/${r.targetId}`); if(new Set(keys).size!==keys.length)throw new Error('Obsazením by vznikl duplicitní vztah. Nejprve upravte vazby zaměstnance.');
    if(!type.allowMultipleParents&&new Set(edges.map(e=>e.targetId)).size!==edges.length)throw new Error('Zaměstnanec by měl více přímých nadřízených. Nejprve upravte jeho vazby.');
    if(new Set(edges.filter(e=>e.primary).map(e=>e.targetId)).size!==edges.filter(e=>e.primary).length)throw new Error('Zaměstnanec by měl více primárních vztahů.');
  }
  return {...candidate,updatedAt:new Date().toISOString()};
}
export function removePosition(s:Scenario,id:string):Scenario {assertEditable(s);return {...s,positions:s.positions.filter(p=>p.id!==id),relationships:s.relationships.filter(r=>r.sourceId!==id&&r.targetId!==id),view:{...s.view,positions:Object.fromEntries(Object.entries(s.view.positions).filter(([key])=>key!==id)),collapsedIds:s.view.collapsedIds.filter(n=>n!==id)},updatedAt:new Date().toISOString()};}
