import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import type { Dataset, Scenario } from '../domain/models';
import { type History, commit, undo, redo } from '../domain/history';
import { validateDataset } from '../domain/validation';
import { createSaveQueue, loadDataset } from '../persistence/database';
import { demoDataset } from '../data/demo';

interface Store { data:Dataset; scenario:Scenario; change:(fn:(data:Dataset)=>Dataset,history?:boolean)=>void; changeScenario:(fn:(s:Scenario)=>Scenario,history?:boolean)=>void; undo:()=>void;redo:()=>void;canUndo:boolean;canRedo:boolean;status:string;retrySave:()=>void }
const Context=createContext<Store|null>(null);
export function StoreProvider({children}:{children:ReactNode}) {
  const [history,setHistory]=useState<History<Dataset>|null>(null),ref=useRef<History<Dataset>|null>(null);
  const [status,setStatus]=useState('Načítání…'),[error,setError]=useState('');
  const queue=useRef(createSaveQueue()),revision=useRef(0),pending=useRef(false);
  const persist=useCallback((data:Dataset)=>{const version=++revision.current;pending.current=true;setStatus('Ukládání…');queue.current(data).then(()=>{if(version===revision.current){pending.current=false;setStatus('Uloženo v prohlížeči');}}).catch((e:unknown)=>{if(version===revision.current){setStatus('Chyba ukládání');notifications.show({color:'red',title:'Data se nepodařilo uložit',message:e instanceof Error?e.message:'Exportujte zálohu a zkuste uložení znovu.'});}});},[]);
  useEffect(()=>{let mounted=true;loadDataset().then(saved=>{if(!mounted)return;const data=saved?validateDataset(saved):demoDataset();const h={past:[],present:data,future:[]};ref.current=h;setHistory(h);if(!saved||saved.scenarios.some(s=>s.id==='current'&&s.protected))persist(data);else setStatus('Uloženo v prohlížeči');}).catch(e=>{if(mounted)setError(`Data se nepodařilo načíst: ${String(e)}. Původní data nebyla přepsána.`);});return()=>{mounted=false;};},[persist]);
  useEffect(()=>{const listener=(e:BeforeUnloadEvent)=>{if(pending.current){e.preventDefault();}};window.addEventListener('beforeunload',listener);return()=>window.removeEventListener('beforeunload',listener);},[]);
  const change=useCallback((fn:(data:Dataset)=>Dataset,record=true)=>{try{const h=ref.current;if(!h)return;const next=validateDataset(fn(structuredClone(h.present)));const updated=record?commit(h,next):{...h,present:next};ref.current=updated;setHistory(updated);persist(next);}catch(e){notifications.show({title:'Změnu nelze provést',message:e instanceof Error?e.message:String(e),color:'red'});}},[persist]);
  const travel=useCallback((direction:'undo'|'redo')=>{const h=ref.current;if(!h)return;const next=direction==='undo'?undo(h):redo(h);ref.current=next;setHistory(next);persist(next.present);},[persist]);
  useEffect(()=>{function key(e:KeyboardEvent){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)){e.preventDefault();travel(e.shiftKey?'redo':'undo');}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[travel]);
  if(error)return <main style={{padding:40}}><h1>Úložiště není dostupné</h1><p role="alert">{error}</p><button onClick={()=>location.reload()}>Zkusit znovu</button></main>;
  if(!history)return <main style={{padding:40}}>Načítání Organization Structure Designer…</main>;
  const data=history.present,scenario=data.scenarios.find(s=>s.id===data.activeScenarioId)!;
  return <Context.Provider value={{data,scenario,change,changeScenario:(fn,record=true)=>change(d=>({...d,scenarios:d.scenarios.map(s=>s.id===d.activeScenarioId?fn(s):s)}),record),undo:()=>travel('undo'),redo:()=>travel('redo'),canUndo:!!history.past.length,canRedo:!!history.future.length,status,retrySave:()=>persist(data)}}>{children}</Context.Provider>;
}
export function useStore(){const value=useContext(Context);if(!value)throw new Error('StoreProvider chybí.');return value;}
