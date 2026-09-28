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
