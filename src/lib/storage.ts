import { openDB } from 'idb';
import { privateLocationSchema, type PrivateLocation } from './location';
import { observationSchema, collectionSchema, assertLibraryCapacity, type Observation, type Collection, type Backup } from './domain';
const db = () => openDB('nature-lens-v1',2,{upgrade(db,oldVersion){if(oldVersion<1){db.createObjectStore('observations',{keyPath:'id'});db.createObjectStore('collections',{keyPath:'id'});}if(oldVersion<2)db.createObjectStore('privateLocations');}});
export async function readLibrary():Promise<{observations:Observation[];collections:Collection[]}> {
 const d=await db();try{return {observations:(await d.getAll('observations')).map(x=>observationSchema.parse(x)),collections:(await d.getAll('collections')).map(x=>collectionSchema.parse(x))};}finally{d.close();}
}
export async function saveObservation(record:Observation,expectedUpdatedAt:string|null,location?:PrivateLocation|null){
 const parsed=observationSchema.parse(record);const precise=location?privateLocationSchema.parse(location):location;const d=await db();const tx=d.transaction(['observations','collections','privateLocations'],'readwrite');
 try{
  const existing=await tx.objectStore('observations').get(parsed.id) as Observation|undefined;
  if((existing?.updatedAt??null)!==expectedUpdatedAt)throw new Error('다른 창에서 이 기록이 변경되거나 삭제되었습니다. 내용을 따로 복사한 뒤 편집 창을 닫고 기록을 다시 열어 주세요.');
  if(existing && existing.photo!==parsed.photo){delete parsed.publicGrid; delete parsed.region;}
  parsed.updatedAt=new Date(Math.max(Date.now(),existing?Date.parse(existing.updatedAt)+1:0)).toISOString();
  const observations=(await tx.objectStore('observations').getAll()).filter(o=>o.id!==parsed.id);observations.push(parsed);
  const collections=await tx.objectStore('collections').getAll();assertLibraryCapacity({observations,collections});
  await tx.objectStore('observations').put(parsed);if(precise)await tx.objectStore('privateLocations').put(precise,parsed.id);else if(precise===null || (existing && existing.photo!==parsed.photo))await tx.objectStore('privateLocations').delete(parsed.id);await tx.done;
 }catch(e){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw e;}finally{d.close();}
}
export async function deleteObservation(id:string){const d=await db();try{const tx=d.transaction(['observations','privateLocations'],'readwrite');await tx.objectStore('observations').delete(id);await tx.objectStore('privateLocations').delete(id);await tx.done;}finally{d.close();}}
export async function saveCollection(record:Collection){
 const c=collectionSchema.parse(record);const d=await db();const tx=d.transaction(['observations','collections'],'readwrite');
 try{const observations=await tx.objectStore('observations').getAll();const collections=(await tx.objectStore('collections').getAll()).filter(x=>x.id!==c.id);collections.push(c);assertLibraryCapacity({observations,collections});await tx.objectStore('collections').put(c);await tx.done;}catch(e){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw e;}finally{d.close();}
}
export async function restoreLibrary(backup:Backup){
 const d=await db();const tx=d.transaction(['observations','collections'],'readwrite');let added=0;
 try{
  const observations=await tx.objectStore('observations').getAll();const collections=await tx.objectStore('collections').getAll();
  const ids=new Set(observations.map(o=>o.id));const cids=new Set(collections.map(c=>c.id));
  const incoming=backup.observations.filter(o=>!ids.has(o.id));const incomingC=backup.collections.filter(c=>!cids.has(c.id));
  assertLibraryCapacity({observations:[...observations,...incoming],collections:[...collections,...incomingC]});
  for(const c of incomingC)await tx.objectStore('collections').add(c);
  for(const o of incoming){await tx.objectStore('observations').add({...o,status:'draft',updatedAt:new Date().toISOString()});added++;}
  await tx.done;return added;
 }catch(e){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw e;}finally{d.close();}
}

export async function readPrivateLocation(id:string):Promise<PrivateLocation|undefined>{const d=await db();try{return await d.get('privateLocations',id);}finally{d.close();}}
export async function removePrivateLocation(id:string){const d=await db();try{await d.delete('privateLocations',id);}finally{d.close();}}

export async function removeObservationLocation(id:string){const d=await db();const tx=d.transaction(['observations','privateLocations'],'readwrite');try{const record=await tx.objectStore('observations').get(id) as Observation|undefined;if(record){delete record.region;delete record.publicGrid;record.status='draft';record.updatedAt=new Date(Math.max(Date.now(),Date.parse(record.updatedAt)+1)).toISOString();await tx.objectStore('observations').put(record);}await tx.objectStore('privateLocations').delete(id);await tx.done;}finally{d.close();}}
