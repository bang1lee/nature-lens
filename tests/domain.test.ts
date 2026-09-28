import { describe, it, expect } from 'vitest';
import { publicationIssues, canPublish, parseBackup, observationSchema, type Observation } from '../src/lib/domain';
const record:Observation = { id:'one', title:'숲에서 만난 잎', species:'소나무', scientificName:'Pinus densiflora', date:'2026-09-29', notes:'잎을 관찰했다.', habitat:'숲', protection:'unknown', consent:true, noPeople:true, aiAssisted:false, status:'reviewed', sessionId:null, photo:'data:image/jpeg;base64,YQ==', demo:false, updatedAt:'2026-09-29T00:00:00.000Z' };
describe('publication gate',()=>{
 it('allows only reviewed and consented observations',()=>{expect(canPublish(record)).toBe(true); for(const patch of [{consent:false},{noPeople:false},{status:'draft' as const},{species:''},{notes:''}]) expect(canPublish({...record,...patch})).toBe(false)});
 it('rejects food and medical claims in every public text field',()=>{for(const key of ['title','species','scientificName','notes','habitat']) expect(publicationIssues({...record,[key]:'약용 효과가 있다'})).not.toHaveLength(0)});
 it('normalizes spacing for forbidden claims',()=>{expect(canPublish({...record,notes:'식 용 가능'})).toBe(false)});
});
describe('backup import',()=>{
 const backup=(r:unknown)=>JSON.stringify({version:1,observations:[r],collections:[]});
 it('resets review on import',()=>expect(parseBackup(backup(record)).observations[0].status).toBe('draft'));
 it('rejects external images and impossible dates',()=>{expect(()=>parseBackup(backup({...record,photo:'https://tracker.example/a.png'}))).toThrow(); expect(()=>parseBackup(backup({...record,date:'2026-02-30'}))).toThrow()});
 it('rejects unknown fields, duplicate ids and malformed files',()=>{expect(()=>parseBackup(backup({...record,latitude:37}))).toThrow(); expect(()=>parseBackup('{}')).toThrow(); expect(()=>parseBackup(JSON.stringify({version:1,observations:[record,record],collections:[]}))).toThrow()});
 it('accepts safe text as text, not markup interpretation',()=>{expect(observationSchema.parse({...record,title:'<script>alert(1)</script>'}).title).toContain('<script>')});
});
