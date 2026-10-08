import 'fake-indexeddb/auto';
import { it,expect } from 'vitest';
import {saveObservation,readLibrary,deleteObservation} from '../src/lib/storage';
import {assertLibraryCapacity,type Observation} from '../src/lib/domain';
const record:Observation={id:'conflict-record',title:'기록',species:'잎',scientificName:'',date:'2026-09-29',notes:'관찰',habitat:'숲',protection:'unknown',consent:true,noPeople:true,aiAssisted:false,status:'reviewed',sessionId:null,photo:'data:image/jpeg;base64,YQ==',demo:false,updatedAt:'2026-09-29T00:00:00.000Z'};
it('rejects stale writes and resurrection after another tab deletes a record',async()=>{
 await saveObservation(record,null);const first=(await readLibrary()).observations.find(o=>o.id===record.id)!;
 await saveObservation({...first,consent:false,status:'draft'},first.updatedAt);
 await expect(saveObservation({...first,notes:'stale'},first.updatedAt)).rejects.toThrow('다른 창');
 const latest=(await readLibrary()).observations.find(o=>o.id===record.id)!;expect(latest.consent).toBe(false);
 await deleteObservation(record.id);await expect(saveObservation(latest,latest.updatedAt)).rejects.toThrow('다른 창');
});
it('keeps every allowed library within restore bounds',()=>{
 expect(()=>assertLibraryCapacity({observations:[record],collections:[]})).not.toThrow();
 expect(()=>assertLibraryCapacity({observations:Array.from({length:501},(_,i)=>({...record,id:String(i)})),collections:[]})).toThrow();
 expect(()=>assertLibraryCapacity({observations:[],collections:Array.from({length:101},(_,i)=>({id:String(i),name:'모음'}))})).toThrow();
 expect(()=>assertLibraryCapacity({observations:Array.from({length:9},(_,i)=>({...record,id:String(i),photo:'data:image/jpeg;base64,'+'A'.repeat(5_900_000)})),collections:[]})).toThrow();
});
it('keeps exact coordinates out of the library/backup and deletes them with the record',async()=>{
 const {readPrivateLocation}=await import('../src/lib/storage');
 const item={...record,id:'gps-private',region:'경기 안성' as const,taxonGroup:'insect' as const};
 await saveObservation(item,null,{latitude:37.123456,longitude:127.987654,accuracy:8,capturedAt:'2026-09-29T00:00:00Z'});
 expect((await readPrivateLocation(item.id))?.latitude).toBe(37.123456);
 const backup=JSON.stringify({version:1,...await readLibrary()});expect(backup).not.toContain('37.123456');expect(backup).not.toContain('127.987654');
 await deleteObservation(item.id);expect(await readPrivateLocation(item.id)).toBeUndefined();
});
it('removes stale GPS on photo replacement and permits deleting all location data',async()=>{
 const {readPrivateLocation,removeObservationLocation}=await import('../src/lib/storage');
 const item={...record,id:'gps-replace',region:'경기 안성' as const,publicGrid:{latitude:37.1,longitude:127.7}};
 const precise={latitude:37.123456,longitude:127.654321,accuracy:8,capturedAt:'2026-09-29T00:00:00Z'};
 await saveObservation(item,null,precise);const saved=(await readLibrary()).observations.find(o=>o.id===item.id)!;
 await saveObservation({...saved,photo:'data:image/jpeg;base64,Yg=='},saved.updatedAt);
 const changed=(await readLibrary()).observations.find(o=>o.id===item.id)!;expect(changed.publicGrid).toBeUndefined();expect(changed.region).toBeUndefined();expect(await readPrivateLocation(item.id)).toBeUndefined();
 await saveObservation({...changed,region:'경기 안성',publicGrid:item.publicGrid},changed.updatedAt,precise);await removeObservationLocation(item.id);
 const removed=(await readLibrary()).observations.find(o=>o.id===item.id)!;expect(removed.region).toBeUndefined();expect(removed.publicGrid).toBeUndefined();expect(removed.status).toBe('draft');expect(await readPrivateLocation(item.id)).toBeUndefined();
});
it('returns the persisted timestamp so a newly captured record can be edited immediately',async()=>{
 const item={...record,id:'immediate-ai-apply'};
 const saved=await saveObservation(item,null);
 expect(saved).toEqual((await readLibrary()).observations.find(o=>o.id===item.id));
});
