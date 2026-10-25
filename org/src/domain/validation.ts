import { z } from 'zod';
import { defaultTypes, defaultView, type Dataset, type Scenario } from './models';
import { validateHierarchy } from './graph';

const id=z.string().trim().min(1,'ID nesmí být prázdné.').max(200);
const photo=z.string().refine(v=>/^https?:\/\//i.test(v)||/^data:image\/(png|jpeg|webp|gif);base64,/i.test(v),'Fotografie musí být HTTP(S) URL nebo vložený obrázek.').nullable().default(null);
export const personSchema=z.object({id,name:z.string().trim().min(1,'Vyplňte jméno.'),title:z.string().trim().min(1,'Vyplňte pozici.'),department:z.string().trim().nullish().transform(value=>value??''),photo,email:z.string().trim().refine(value=>!value||z.email().safeParse(value).success,'Zadejte platný e-mail.').default(''),phone:z.string().trim().default(''),employer:z.string().trim().default(''),tagIds:z.array(id).default([]),description:z.string().optional()});
const tagSchema=z.object({id,name:z.string().trim().min(1),category:z.string().optional(),color:z.string().regex(/^#[\da-f]{6}$/i).optional()});
const positionSchema=z.object({id,title:z.string().trim().min(1),department:z.string().trim().nullish().transform(value=>value??''),tagIds:z.array(id).default([]),description:z.string().optional(),status:z.enum(['vacant','filled']).default('vacant'),occupantId:id.optional()});
// The public JSON format uses position; keep title internally and accept older files.
function readPosition(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return Object.hasOwn(record, 'position') ? { ...record, title: record.position } : record;
}
const jsonPersonSchema=z.preprocess(readPosition,personSchema);
const jsonPositionSchema=z.preprocess(readPosition,positionSchema);
const typeSchema=z.object({id,name:z.string().trim().min(1),color:z.string().regex(/^#[\da-f]{6}$/i),lineStyle:z.enum(['solid','dashed','dotted']).default('solid'),allowMultipleParents:z.boolean().default(false)});
const relationSchema=z.object({id,sourceId:id,targetId:id,type:id,primary:z.boolean().default(false),scenarioId:id.optional()});
const viewSchema=z.object({layoutType:id.default('organizational'),visibleTypes:z.array(id).default(['organizational']),showDepartments:z.boolean().default(false),showTags:z.boolean().default(false),showContacts:z.boolean().default(false),onlyMatches:z.boolean().default(false),collapsedIds:z.array(id).default([]),positions:z.record(z.string(),z.object({x:z.number().finite(),y:z.number().finite()})).default({})});
const scenarioSchema=z.object({id,name:z.string().trim().min(1),description:z.string().optional(),createdAt:z.iso.datetime().optional(),updatedAt:z.iso.datetime().optional(),protected:z.boolean().default(false),positions:z.array(jsonPositionSchema).default([]),relationships:z.array(relationSchema).default([]),view:viewSchema.optional()});
export const importSchema=z.object({schemaVersion:z.literal(1),people:z.array(jsonPersonSchema).optional(),tags:z.array(tagSchema).optional(),relationshipTypes:z.array(typeSchema).optional(),scenarios:z.array(scenarioSchema).optional(),relationships:z.array(relationSchema).optional(),activeScenarioId:id.optional()});
export type ImportData=z.infer<typeof importSchema>;
function unique(ids:string[],label:string) {const seen=new Set<string>();for(const id of ids){if(seen.has(id))throw new Error(`Duplicitní ID v ${label}: ${id}`);seen.add(id);}}
export function parseImport(raw:unknown):ImportData {
  const result=importSchema.safeParse(raw);
  if(!result.success)throw new Error(result.error.issues.map(i=>`${i.path.join('.') || 'JSON'}: ${i.message}`).join('\n'));
  const input=result.data;
  unique(input.people?.map(p=>p.id)||[],'zaměstnancích');unique(input.tags?.map(p=>p.id)||[],'štítcích');unique(input.scenarios?.map(p=>p.id)||[],'variantách');unique(input.relationshipTypes?.map(p=>p.id)||[],'typech vztahů');
  unique([...(input.scenarios||[]).flatMap(s=>s.relationships.map(r=>r.id)),...(input.relationships||[]).map(r=>r.id)],'vztazích');
  unique([...(input.people||[]).map(p=>p.id),...(input.scenarios||[]).flatMap(s=>s.positions.map(p=>p.id))],'uzlech');
  return input;
}
export function validateDataset(data:Dataset):Dataset {
  // Older JSON and IndexedDB snapshots have no contact fields or visibility flag.
  data={...data,people:data.people.map(person=>personSchema.parse(person)),scenarios:data.scenarios.map(s=>({...s,protected:s.id==='current'?false:s.protected,view:{...s.view,showContacts:s.view.showContacts??false}}))};
  unique(data.people.map(p=>p.id),'zaměstnancích');unique(data.tags.map(t=>t.id),'štítcích');unique(data.scenarios.map(s=>s.id),'variantách');unique(data.relationshipTypes.map(t=>t.id),'typech');
  unique([...data.people.map(p=>p.id),...data.scenarios.flatMap(s=>s.positions.map(p=>p.id))],'uzlech');unique(data.scenarios.flatMap(s=>s.relationships.map(r=>r.id)),'vztazích');
  const people=new Set(data.people.map(p=>p.id)),tags=new Set(data.tags.map(t=>t.id)),types=new Set(data.relationshipTypes.map(t=>t.id));
  for(const p of [...data.people,...data.scenarios.flatMap(s=>s.positions)])for(const tag of p.tagIds)if(!tags.has(tag))throw new Error(`Neexistující štítek ${tag} u ${p.id}.`);
  for(const s of data.scenarios){
    const nodes=new Set([...people,...s.positions.filter(p=>p.status==='vacant').map(p=>p.id)]);
    for(const p of s.positions)if(p.status==='filled'&&(!p.occupantId||!people.has(p.occupantId)))throw new Error(`Pozice ${p.id} nemá platného zaměstnance.`);
    for(const r of s.relationships){if(r.scenarioId!==s.id)throw new Error(`Vztah ${r.id} patří jiné variantě.`);if(!nodes.has(r.sourceId)||!nodes.has(r.targetId))throw new Error(`Vztah ${r.id} odkazuje na neexistující uzel.`);if(!types.has(r.type))throw new Error(`Neznámý typ vztahu ${r.type}.`);}
    for(const t of data.relationshipTypes){const edges=s.relationships.filter(r=>r.type===t.id);validateHierarchy(edges);unique(edges.map(r=>`${r.sourceId}/${r.targetId}`),`vztazích ${t.name}`);unique(edges.filter(r=>r.primary).map(r=>r.targetId),`primárních rodičích ${t.name}`);if(!t.allowMultipleParents)unique(edges.map(r=>r.targetId),`nadřízených ${t.name}`);}
    if(!types.has(s.view.layoutType)||s.view.visibleTypes.some(t=>!types.has(t)))throw new Error(`Neznámý typ vztahu v nastavení varianty ${s.name}.`);
    for(const id of [...s.view.collapsedIds,...Object.keys(s.view.positions)])if(!nodes.has(id))throw new Error(`Nastavení varianty odkazuje na neexistující uzel ${id}.`);
  }
  if(!data.scenarios.length||!data.scenarios.some(s=>s.id===data.activeScenarioId))throw new Error('Chybí aktivní organizační varianta.');
  return data;
}
const mergeById=<T extends {id:string}>(old:T[],incoming:T[],overwrite:boolean)=>[...old.map(p=>overwrite?(incoming.find(n=>n.id===p.id)||p):p),...incoming.filter(n=>!old.some(p=>p.id===n.id))];
export function importDataset(current:Dataset,raw:unknown,mode:'merge'|'replace',overwrite=false):Dataset {
  const input=parseImport(raw),now=new Date().toISOString();
  const scenarios:Scenario[]=(input.scenarios||[]).map(s=>({...s,createdAt:s.createdAt||now,updatedAt:s.updatedAt||now,view:s.view||defaultView(),relationships:s.relationships.map(r=>({...r,scenarioId:s.id}))}));
  const base=mode==='merge'?structuredClone(current):{schemaVersion:1 as const,people:[],tags:[],relationshipTypes:input.relationshipTypes?[]:structuredClone(defaultTypes),scenarios:[],activeScenarioId:''};
  let result:Dataset={...base,people:mergeById(base.people,input.people||[],overwrite),tags:mergeById(base.tags,input.tags||[],overwrite),relationshipTypes:mergeById(base.relationshipTypes,input.relationshipTypes||[],overwrite),scenarios:mergeById(base.scenarios,scenarios,overwrite)};
  if(input.relationships?.length){
    for(const r of input.relationships){if(!r.scenarioId)throw new Error(`Vztah ${r.id} mimo variantu musí obsahovat scenarioId.`);const target=result.scenarios.find(s=>s.id===r.scenarioId);if(!target)throw new Error(`Neexistující varianta ${r.scenarioId}.`);target.relationships=mergeById(target.relationships,[{...r,scenarioId:r.scenarioId}],overwrite);}
  }
  if(!result.scenarios.length)result.scenarios=[{id:'imported',name:'Importovaná organizace',createdAt:now,updatedAt:now,protected:false,positions:[],relationships:[],view:defaultView()}];
  result.activeScenarioId=input.activeScenarioId&&result.scenarios.some(s=>s.id===input.activeScenarioId)?input.activeScenarioId:result.scenarios.some(s=>s.id===base.activeScenarioId)?base.activeScenarioId:result.scenarios[0].id;
  return validateDataset(result);
}
export function countConflicts(data:Dataset,input:ImportData) {return (['people','tags','relationshipTypes','scenarios'] as const).reduce((n,key)=>n+(input[key]||[]).filter(i=>data[key].some(p=>p.id===i.id)).length,0)+(input.relationships||[]).filter(r=>data.scenarios.some(s=>s.relationships.some(e=>e.id===r.id))).length;}
function stringifyExport(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item) && Object.hasOwn(item, 'title')) {
      const { title, ...rest } = item;
      return { ...rest, position: title };
    }
    return item;
  }, 2);
}
export function exportDataset(data:Dataset,scope:'all'|'people'|'scenario',scenarioId=data.activeScenarioId):string {
  if(scope==='all')return stringifyExport(data);
  if(scope==='people')return stringifyExport({schemaVersion:1,people:data.people,tags:data.tags});
  const s=data.scenarios.find(s=>s.id===scenarioId);if(!s)throw new Error('Varianta neexistuje.');
  // People are shared and appear once in every scenario, including unconnected people.
  return stringifyExport({schemaVersion:1,people:data.people,tags:data.tags,relationshipTypes:data.relationshipTypes,scenarios:[s],activeScenarioId:s.id});
}
