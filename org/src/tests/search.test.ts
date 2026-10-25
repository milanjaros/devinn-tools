import { expect, it } from 'vitest';
import { demoDataset } from '../data/demo';
import { matches } from '../domain/search';
it('hledá bez diakritiky a kombinuje všechny vybrané štítky',()=>{const d=demoDataset();expect(matches(d.people[0],d.tags,'jan novak','','',[])).toBe(true);const dotnet=d.tags.find(t=>t.name==='.NET')!;expect(d.people.some(p=>matches(p,d.tags,'.net','','',[dotnet.id]))).toBe(true);expect(matches(d.people[0],d.tags,'','','',[dotnet.id])).toBe(false);});
