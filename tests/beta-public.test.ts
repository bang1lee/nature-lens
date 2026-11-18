import {describe,it,expect,vi} from 'vitest';
import {newObservation} from '../src/lib/domain';
import {betaMetadata, requireBetaConsent, betaPublicItemSchema} from '../src/lib/cloud/beta-public';

describe('public beta boundary',()=>{
 it('requires explicit public and no-people confirmation',()=>{
  expect(()=>requireBetaConsent({publicConsent:false,noPeople:true})).toThrow();
  expect(()=>requireBetaConsent({publicConsent:true,noPeople:false})).toThrow();
  expect(()=>requireBetaConsent({publicConsent:true,noPeople:true})).not.toThrow();
 });
 it('omits photo and both location fields without changing the local record',()=>{
  const record={...newObservation(),id:'local',title:'합성',photo:'data:image/jpeg;base64,YQ==',region:'경기 안성' as const,publicGrid:{latitude:37.1,longitude:127.3},noPeople:false};
  const metadata=betaMetadata({...record,symptoms:"비공개 관찰",symptomPhotos:[record.photo],photoLight:"shade",phenophase:"flower"});expect(metadata).not.toHaveProperty("symptoms");expect(metadata).not.toHaveProperty("symptomPhotos");expect(metadata).not.toHaveProperty("photoLight");expect(metadata).not.toHaveProperty("phenophase");expect(metadata).not.toHaveProperty('photo');expect(metadata).not.toHaveProperty('publicGrid');expect(metadata).not.toHaveProperty('region');expect(metadata.noPeople).toBe(false);expect(record.photo).toContain('data:');expect(record.publicGrid.latitude).toBe(37.1);
 });
 it('strips owner and non-public metadata from a feed item',()=>{
  const item=betaPublicItemSchema.parse({id:'11111111-1111-4111-8111-111111111111',title:'합성',species:'이름 후보',observed_on:'2026-11-15',notes:'합성 메모',photo_path:'11111111-1111-4111-8111-111111111111.jpg',published_at:'2026-11-15T00:00:00Z',owner_id:'private',record:{x:1}});
  expect(item).not.toHaveProperty('owner_id');expect(item).not.toHaveProperty('record');
 });
});

vi.mock('../src/lib/image',()=>({preparePhoto:vi.fn(async()=> 'data:image/jpeg;base64,YQ==')}));
import type {SupabaseClient} from '@supabase/supabase-js';
import {publishBetaObservation,listBetaFeed,listMyBetaObservations,restoreBetaObservation} from '../src/lib/cloud/beta-public';
const owner='11111111-1111-4111-8111-111111111111';
function fakeCloud(){
 let row:Record<string,any>|null=null,photo:Blob|null=null,userId=owner,uploads=0,failPublish=false,failUpload=false,afterInsert=()=>{},beforePublish=()=>{},afterPublish=()=>{};
 const copy=<T,>(value:T):T=>structuredClone(value);
 const client={auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},storage:{from:()=>({getPublicUrl:(p:string)=>({data:{publicUrl:`https://example.invalid/${p}`}}),upload:async(_p:string,b:Blob)=>{uploads++;if(failUpload){failUpload=false;return {error:{statusCode:'503'}};}if(photo)return {error:{statusCode:'409'}};photo=b;return {error:null};},download:async()=>photo?{data:photo,error:null}:{data:null,error:{}}})},rpc:async(name:string,args:Record<string,any>)=>{
  if(name!=='finalize_beta_public_observation')throw new Error('unexpected RPC');
  beforePublish();
  if(failPublish){failPublish=false;return {data:null,error:{message:'offline'}};}
  if(!row||row.owner_id!==userId||row.id!==args.p_id||row.state!=='staging'||row.photo_sha256!==args.p_photo_sha256||JSON.stringify(row.record)!==JSON.stringify(args.p_expected_record))return {data:false,error:null};
  row={...row,record:copy(args.p_new_record),state:'published',published_at:'2026-11-15T00:00:00Z'};
  afterPublish();return {data:true,error:null};
 },from:(table:string)=>{
  let op='select',values:Record<string,unknown>={};const filters:Record<string,unknown>={};
  const finish=()=>{if(table==='beta_public_feed')return {data:row?.state==='published'?[{id:row.id,title:row.record.title,species:row.record.species,observed_on:row.record.date,notes:row.record.notes,photo_path:row.photo_path,published_at:row.published_at,owner_id:'do-not-expose'}]:[],error:null};
   if(op==='insert'){if(row)return {data:null,error:{code:'23505'}};row={...copy(values),owner_id:owner,state:'staging',published_at:null};afterInsert();return {data:copy(row),error:null};}
   if(op==='update'){beforePublish();if(failPublish){failPublish=false;return {data:null,error:{message:'offline'}};}if(row&&row.state==='staging'){row={...row,...values,published_at:'2026-11-15T00:00:00Z'};afterPublish();return {data:copy(row),error:null};}return {data:null,error:null};}
   const match=row&&Object.entries(filters).every(([key,val])=>row?.[key]===val);return {data:match?copy(row):null,error:null};};
  const q:any={select:()=>q,eq:(k:string,v:unknown)=>{filters[k]=v;return q;},order:()=>q,limit:()=>q,insert:(v:Record<string,unknown>)=>{op='insert';values=v;return q;},update:(v:Record<string,unknown>)=>{op='update';values=v;return q;},single:async()=>finish(),maybeSingle:async()=>finish(),then:(yes:(v:unknown)=>unknown,no:(e:unknown)=>unknown)=>{const result=finish();return Promise.resolve(table==='beta_public_observations'&&op==='select'?{...result,data:result.data?[result.data]:[]}:result).then(yes,no);}};return q;
 }};
 return {client:client as unknown as SupabaseClient,getRow:()=>row,getUploads:()=>uploads,setUser:(id:string)=>{userId=id;},failNextPublish:()=>{failPublish=true;},failNextUpload:()=>{failUpload=true;},setAfterInsert:(fn:()=>void)=>{afterInsert=fn;},setBeforePublish:(fn:()=>void)=>{beforePublish=fn;},setAfterPublish:(fn:()=>void)=>{afterPublish=fn;},changeStagingNotes:(notes:string)=>{if(row)row={...row,record:{...row.record,notes}};}};
}
const synthetic=()=>({...newObservation(),id:'own-observation',title:'합성 기록',species:'후보 이름',notes:'합성 관찰',photo:'data:image/png;base64,YQ==',region:'경기 안성' as const,publicGrid:{latitude:37.1,longitude:127.3},noPeople:false,previousObservationId:'old',specimenId:'specimen',sessionId:'local-collection'});
const agreed={publicConsent:true,noPeople:true} as const;
it('requires consent before writes; retries the exact record without duplicate uploads and rejects changes',async()=>{
 const cloud=fakeCloud(),record=synthetic(),getUser=vi.spyOn(cloud.client.auth,'getUser');await expect(publishBetaObservation(cloud.client,owner,record,{publicConsent:false,noPeople:true} as any)).rejects.toThrow();await expect(publishBetaObservation(cloud.client,owner,record,{publicConsent:true,noPeople:false} as any)).rejects.toThrow();expect(getUser).not.toHaveBeenCalled();expect(cloud.getRow()).toBeNull();expect(cloud.getUploads()).toBe(0);
 const first=await publishBetaObservation(cloud.client,owner,record,agreed);expect(first.alreadyPublished).toBe(false);expect(cloud.getRow()?.record).not.toHaveProperty('region');expect(cloud.getRow()?.record).not.toHaveProperty('publicGrid');expect(cloud.getRow()?.record.noPeople).toBe(false);expect(cloud.getRow()?.photo_path).not.toContain(owner);
 const again=await publishBetaObservation(cloud.client,owner,record,agreed);expect(again.alreadyPublished).toBe(true);expect(cloud.getUploads()).toBe(1);
 const published=structuredClone(cloud.getRow());await expect(publishBetaObservation(cloud.client,owner,{...record,notes:'수정된 내용'},agreed)).rejects.toThrow('다른 버전');expect(cloud.getUploads()).toBe(1);expect(cloud.getRow()).toEqual(published);
});
it('recovers a previously uploaded photo after publication fails, without overwriting it',async()=>{
 const cloud=fakeCloud(),record=synthetic();cloud.failNextPublish();await expect(publishBetaObservation(cloud.client,owner,record,agreed)).rejects.toThrow('공개 저장 결과');
 const retry=await publishBetaObservation(cloud.client,owner,record,agreed);expect(retry.alreadyPublished).toBe(false);expect(cloud.getUploads()).toBe(2);expect(cloud.getRow()?.state).toBe('published');
});
it('recovers an interrupted staging upload after the observation metadata changes',async()=>{
 const cloud=fakeCloud(),record=synthetic();cloud.failNextUpload();
 await expect(publishBetaObservation(cloud.client,owner,record,agreed)).rejects.toThrow('사진 전송');
 const old=structuredClone(cloud.getRow());
 if(!old)throw new Error('staging row missing');
 const edited={...record,notes:'촬영 후 고친 메모',species:'새 이름 후보'};
 const result=await publishBetaObservation(cloud.client,owner,edited,agreed);
 expect(result.alreadyPublished).toBe(false);
 expect(cloud.getRow()).toMatchObject({state:'published',photo_path:old.photo_path,photo_sha256:old.photo_sha256,record:{notes:'촬영 후 고친 메모',species:'새 이름 후보'}});
 expect(cloud.getUploads()).toBe(2);
});
it('does not claim success when another tab changes staging before publication',async()=>{
 const cloud=fakeCloud(),record=synthetic();
 cloud.setBeforePublish(()=>cloud.changeStagingNotes('다른 창에서 변경'));
 await expect(publishBetaObservation(cloud.client,owner,record,agreed)).rejects.toThrow();
 expect(cloud.getRow()?.state).toBe('staging');
});
it('checks the final published record instead of trusting the publish response',async()=>{
 const cloud=fakeCloud(),record=synthetic();
 cloud.setAfterPublish(()=>cloud.changeStagingNotes('다른 내용이 공개됨'));
 await expect(publishBetaObservation(cloud.client,owner,record,agreed)).rejects.toThrow('다른 버전');
});
it('stops before photo upload if the active identity changes after staging',async()=>{
 const cloud=fakeCloud();let current=true;cloud.setAfterInsert(()=>{current=false;});
 await expect(publishBetaObservation(cloud.client,owner,synthetic(),agreed,()=>current)).rejects.toThrow('연결 상태');
 expect(cloud.getRow()?.state).toBe('staging');expect(cloud.getUploads()).toBe(0);
});
it('rejects a changed account and strips owner info from public feed',async()=>{
 const cloud=fakeCloud(),record=synthetic();cloud.setUser('22222222-2222-4222-8222-222222222222');await expect(publishBetaObservation(cloud.client,owner,record,agreed)).rejects.toThrow('연결 상태');expect(cloud.getRow()).toBeNull();cloud.setUser(owner);await publishBetaObservation(cloud.client,owner,record,agreed);const feed=await listBetaFeed(cloud.client);expect(feed).toHaveLength(1);expect(feed[0]).not.toHaveProperty('owner_id');
});

it('restores only the owner’s published record without precise location or missing collection link',async()=>{
 const cloud=fakeCloud(),record=synthetic();await publishBetaObservation(cloud.client,owner,record,agreed);const list=await listMyBetaObservations(cloud.client,owner);expect(list).toHaveLength(1);const restored=await restoreBetaObservation(cloud.client,owner,list[0]);expect(restored).toMatchObject({id:record.id,specimenId:'specimen',previousObservationId:'old',sessionId:null,photo:'data:image/jpeg;base64,YQ=='});expect(restored).not.toHaveProperty('publicGrid');expect(restored).not.toHaveProperty('region');cloud.setUser('22222222-2222-4222-8222-222222222222');await expect(restoreBetaObservation(cloud.client,owner,list[0])).rejects.toThrow('연결 상태');
});
it('a stalled account check returns a retryable status instead of waiting forever',async()=>{
 vi.useFakeTimers();try{const cloud=fakeCloud();(cloud.client.auth as any).getUser=()=>new Promise(()=>{});const operation=publishBetaObservation(cloud.client,owner,synthetic(),agreed);const assertion=expect(operation).rejects.toThrow('응답이 늦어');await vi.advanceTimersByTimeAsync(30_000);await assertion;expect(cloud.getRow()).toBeNull();}finally{vi.useRealTimers();}
});
