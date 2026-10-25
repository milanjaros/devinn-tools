import type { Dataset } from './models';
import { assertEditable } from './graph';

export function departmentNames(data: Dataset): string[] {
  return [...new Set([
    ...data.people.map(person => person.department),
    ...data.scenarios.flatMap(scenario => scenario.positions.map(position => position.department)),
  ].map(name => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));
}

// People are shared: deletion must remove references even in the reference scenario.
export function removePerson(data: Dataset, id: string): Dataset {
  const active = data.scenarios.find(scenario => scenario.id === data.activeScenarioId);
  if (!active) throw new Error('Aktivní varianta neexistuje.');
  assertEditable(active);
  if (!data.people.some(person => person.id === id)) throw new Error('Zaměstnanec neexistuje.');
  const now = new Date().toISOString();
  return {
    ...data,
    people: data.people.filter(person => person.id !== id),
    scenarios: data.scenarios.map(scenario => ({
      ...scenario,
      updatedAt: now,
      relationships: scenario.relationships.filter(relation => relation.sourceId !== id && relation.targetId !== id),
      positions: scenario.positions.map(position => {
        if (position.occupantId !== id) return position;
        const { occupantId: _, ...vacant } = position;
        return { ...vacant, status: 'vacant' as const };
      }),
      view: {
        ...scenario.view,
        collapsedIds: scenario.view.collapsedIds.filter(nodeId => nodeId !== id),
        positions: Object.fromEntries(Object.entries(scenario.view.positions).filter(([nodeId]) => nodeId !== id)),
      },
    })),
  };
}
