import type { Person, Position, Tag } from './models';
export const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function matches(entity:Person|Position,tags:Tag[],query:string,title:string,department:string|null,tagIds:string[]):boolean {
  const haystack=normalize([('name' in entity?entity.name:''),entity.title,entity.department,...entity.tagIds.map(id=>tags.find(t=>t.id===id)?.name||'')].join(' '));
  return normalize(query).split(/\s+/).every(term=>haystack.includes(term))&&normalize(entity.title).includes(normalize(title))&&(!department||entity.department===department)&&tagIds.every(t=>entity.tagIds.includes(t));
}
