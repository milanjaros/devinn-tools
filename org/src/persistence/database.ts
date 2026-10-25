import { openDB, type DBSchema } from 'idb';
import type { Dataset } from '../domain/models';
interface OrgDB extends DBSchema { snapshots:{key:string;value:Dataset} }
export function openDatabase(name='organization-designer') {return openDB<OrgDB>(name,1,{upgrade(db){db.createObjectStore('snapshots');}});}
export async function loadDataset(name?:string):Promise<Dataset|undefined> {const db=await openDatabase(name);try{return await db.get('snapshots','current');}finally{db.close();}}
export async function saveDataset(data:Dataset,name?:string) {const db=await openDatabase(name);try{const tx=db.transaction('snapshots','readwrite');await tx.store.put(data,'current');await tx.done;}finally{db.close();}}
// Serialize full snapshots. A slow earlier write can never overwrite a newer snapshot.
export function createSaveQueue(write: (data:Dataset)=>Promise<void> = saveDataset) {
  let tail=Promise.resolve();
  return (data:Dataset) => {const snapshot=structuredClone(data);const result=tail.catch(()=>{}).then(()=>write(snapshot));tail=result;return result;};
}
