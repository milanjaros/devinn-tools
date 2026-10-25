export interface Tag { id: string; name: string; category?: string; color?: string }
export interface Person { id: string; name: string; title: string; department: string; photo: string | null; email: string; phone: string; employer: string; tagIds: string[]; description?: string }
export interface Position { id: string; title: string; department: string; tagIds: string[]; description?: string; status: 'vacant' | 'filled'; occupantId?: string }
export interface RelationshipType { id: string; name: string; color: string; lineStyle: 'solid' | 'dashed' | 'dotted'; allowMultipleParents: boolean }
export interface Relationship { id: string; sourceId: string; targetId: string; type: string; primary: boolean; scenarioId: string }
export interface ViewSettings { layoutType: string; visibleTypes: string[]; showDepartments: boolean; showTags: boolean; showContacts: boolean; onlyMatches: boolean; collapsedIds: string[]; positions: Record<string, {x:number;y:number}> }
export interface Scenario { id: string; name: string; description?: string; createdAt: string; updatedAt: string; protected: boolean; positions: Position[]; relationships: Relationship[]; view: ViewSettings }
export interface Dataset { schemaVersion: 1; people: Person[]; tags: Tag[]; relationshipTypes: RelationshipType[]; scenarios: Scenario[]; activeScenarioId: string }
export const uid = () => crypto.randomUUID();
export const defaultTypes: RelationshipType[] = [
  { id: 'organizational', name: 'Organizační vedení', color: '#648b7b', lineStyle: 'solid', allowMultipleParents: false },
  { id: 'professional', name: 'Odborné vedení', color: '#8d74c6', lineStyle: 'dashed', allowMultipleParents: true },
  { id: 'project', name: 'Projektové vedení', color: '#cd984d', lineStyle: 'dotted', allowMultipleParents: true },
];
export const defaultView = (): ViewSettings => ({layoutType:'organizational',visibleTypes:['organizational'],showDepartments:false,showTags:false,showContacts:false,onlyMatches:false,collapsedIds:[],positions:{}});
export function createScenario(name: string): Scenario { const now = new Date().toISOString(); return {id:uid(),name,createdAt:now,updatedAt:now,protected:false,positions:[],relationships:[],view:defaultView()}; }
export function emptyDataset(): Dataset {
  const scenario = createScenario('Moje organizace');
  return { schemaVersion: 1, people: [], tags: [], relationshipTypes: structuredClone(defaultTypes), scenarios: [scenario], activeScenarioId: scenario.id };
}
export function nodeIds(data: Dataset, scenario: Scenario): string[] { return [...data.people.map(p=>p.id), ...scenario.positions.filter(p=>p.status==='vacant').map(p=>p.id)]; }
