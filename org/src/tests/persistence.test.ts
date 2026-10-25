import { expect, it } from 'vitest';
import { demoDataset } from '../data/demo';
import { createSaveQueue, loadDataset, saveDataset } from '../persistence/database';
it('obnoví celý stav z IndexedDB',async()=>{const name=`test-${crypto.randomUUID()}`,data=demoDataset();await saveDataset(data,name);expect(await loadDataset(name)).toEqual(data);});
it('zachová pořadí rychlých změn i při pomalém zápisu',async()=>{const order:string[]=[],data=demoDataset();const queue=createSaveQueue(async d=>{if(d.people[0].name==='První')await new Promise(resolve=>setTimeout(resolve,25));order.push(d.people[0].name);});data.people[0].name='První';const a=queue(data);data.people[0].name='Druhý';const b=queue(data);await Promise.all([a,b]);expect(order).toEqual(['První','Druhý']);});
it('pokračuje po neúspěšném zápisu',async()=>{let count=0;const queue=createSaveQueue(async()=>{if(++count===1)throw new Error('disk');});await expect(queue(demoDataset())).rejects.toThrow('disk');await expect(queue(demoDataset())).resolves.toBeUndefined();});
