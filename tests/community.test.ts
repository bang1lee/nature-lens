import {describe,it,expect} from 'vitest';
import {periodStart,rankStories,publicLocation,coarsePoint} from '../src/lib/community';
import {observationSchema,parseBackup} from '../src/lib/domain';
const now=new Date('2026-09-27T12:00:00+09:00');
describe('period reactions',()=>{
 it('uses Korean Monday and calendar month boundaries',()=>{expect(periodStart('week',now).toISOString()).toBe('2026-09-20T15:00:00.000Z');expect(periodStart('month',now).toISOString()).toBe('2026-08-31T15:00:00.000Z')});
 it('counts unique people in the period, excludes future and unrelated reactions',()=>{
  const reactions=[{storyId:'a',actorId:'one',at:'2026-09-22T00:00:00Z'},{storyId:'a',actorId:'one',at:'2026-09-23T00:00:00Z'},{storyId:'b',actorId:'two',at:'2026-09-02T00:00:00Z'},{storyId:'a',actorId:'future',at:'2026-10-02T00:00:00Z'}];
  expect(rankStories([{id:'a'},{id:'b'}],reactions,'week',now).map(s=>s.count)).toEqual([1,0]);expect(rankStories([{id:'a'},{id:'b'}],reactions,'month',now).map(s=>s.count)).toEqual([1,1]);
 });
});
describe('location boundaries',()=>{
 it('coarsens coordinates and never exposes exact data for unknown or protected taxa',()=>{
  const grid=coarsePoint(37.123456,127.987654);expect(grid).toEqual({latitude:37.1,longitude:128});
  for(const protection of ['unknown','protected'])expect(publicLocation({region:'경기 안성',protection,publicGrid:grid})).toEqual({label:'경기 안성',hidden:true});
  expect(publicLocation({region:'경기 안성',protection:'common',publicGrid:grid})).toEqual({label:'경기 안성',hidden:false,grid});
 });
 it('old observations remain readable and arbitrary precise public points are rejected',()=>{
  const old={id:'old',title:'old',species:'',scientificName:'',date:'2026-09-29',notes:'',habitat:'',protection:'unknown',consent:false,noPeople:false,aiAssisted:false,status:'draft',sessionId:null,photo:'data:image/jpeg;base64,YQ==',demo:false,updatedAt:'2026-09-29T00:00:00Z'};
  expect(observationSchema.safeParse(old).success).toBe(true);expect(()=>parseBackup(JSON.stringify({version:1,collections:[],observations:[{...old,publicGrid:{latitude:37.123456,longitude:127.987654}}]}))).toThrow();
 });
});
