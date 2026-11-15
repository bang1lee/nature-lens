import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {observationSchema,type Observation} from '../domain';
import {preparePhoto} from '../image';

const BUCKET='nature-lens-beta-public';
const RECORD_COLUMNS='id,local_id,photo_path,photo_sha256,record,state,published_at';
const FEED_COLUMNS='id,title,species,observed_on,notes,photo_path,published_at';
const betaRecordSchema=observationSchema.omit({photo:true,region:true,publicGrid:true});
export type BetaMetadata=z.infer<typeof betaRecordSchema>;
export type BetaOwnedObservation={id:string;localId:string;record:BetaMetadata;photoPath:string};
export type BetaFeedItem={id:string;title:string;species:string;observedOn:string;notes:string;photoUrl:string};
export type BetaPublishResult={id:string;localId:string;photoUrl:string;alreadyPublished:boolean};
export type BetaConfirmation={publicConsent:true;noPeople:true};
const confirmSchema=z.object({publicConsent:z.literal(true),noPeople:z.literal(true)}).strict();
export function requireBetaConsent(confirm:unknown):asserts confirm is BetaConfirmation {
 if(!confirmSchema.safeParse(confirm).success)throw new Error('공개 저장과 사진에 사람·개인정보가 없다는 확인이 모두 필요해요.');
}
export function betaMetadata(observation:Observation):BetaMetadata {
 const {photo:_photo,region:_region,publicGrid:_grid,...metadata}=observationSchema.parse(observation);
 return betaRecordSchema.parse(metadata);
}
const rowSchema=z.object({id:z.uuid(),local_id:z.string().min(1).max(100),photo_path:z.string().regex(/^[0-9a-f-]{36}\.jpg$/),photo_sha256:z.string().regex(/^[0-9a-f]{64}$/),record:betaRecordSchema,state:z.enum(['staging','published']),published_at:z.string().nullable()});
type Row=z.infer<typeof rowSchema>;
export const betaPublicItemSchema=z.object({id:z.uuid(),title:z.string().max(120),species:z.string().max(100),observed_on:z.string().max(10),notes:z.string().max(4000),photo_path:z.string().regex(/^[0-9a-f-]{36}\.jpg$/),published_at:z.string()}).strip();
function stable(value:unknown):string {if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}';return JSON.stringify(value);}
async function sha(blob:Blob):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');}
async function network<T>(work:PromiseLike<T>):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('서버 응답이 늦어 결과를 확인하지 못했어요. 내 공개 기록을 확인한 뒤 다시 시도해 주세요.')),30_000);})]);}
 finally{clearTimeout(timer);}
}
async function own(client:SupabaseClient,userId:string){
 if(!z.uuid().safeParse(userId).success)throw new Error('연결 상태를 다시 확인해 주세요.');
 const {data,error}=await network(client.auth.getUser());if(error||data.user?.id!==userId)throw new Error('연결 상태가 바뀌었어요. 다시 확인해 주세요.');
}
async function photoBlob(observation:Observation):Promise<Blob>{
 const original=await (await fetch(observation.photo)).blob();
 const clean=await preparePhoto(new File([original],'observation',{type:original.type}));
 const blob=await (await fetch(clean)).blob();
 if(blob.type!=='image/jpeg'||blob.size===0||blob.size>4_500_000)throw new Error('사진을 공개 저장 형식으로 준비하지 못했어요.');
 return blob;
}
function link(client:SupabaseClient,path:string){return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;}
async function existing(client:SupabaseClient,userId:string,localId:string):Promise<Row|null>{
 const {data,error}=await network(client.from('beta_public_observations').select(RECORD_COLUMNS).eq('owner_id',userId).eq('local_id',localId).maybeSingle());
 if(error)throw new Error('공개 저장 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');return data?rowSchema.parse(data):null;
}
function compatible(row:Row,metadata:BetaMetadata,hash:string){
 if(row.photo_sha256!==hash||stable(row.record)!==stable(metadata))throw new Error('이 기록의 다른 버전이 이미 공개 저장되었어요. 수정한 내용은 새 기록으로 공개해 주세요.');
}
export async function publishBetaObservation(client:SupabaseClient,userId:string,record:Observation,confirm:BetaConfirmation,isCurrent:()=>boolean=()=>true):Promise<BetaPublishResult>{
 const assertCurrent=()=>{if(!isCurrent())throw new Error('연결 상태가 바뀌었어요. 다시 확인해 주세요.');};
 requireBetaConsent(confirm);const metadata=betaMetadata(record);
 if(metadata.demo)throw new Error('예제 기록은 공개 저장할 수 없어요.');
 assertCurrent();await own(client,userId);assertCurrent();
 const image=await photoBlob(record),hash=await sha(image);
 assertCurrent();
 let row=await existing(client,userId,metadata.id);
 if(!row){
  assertCurrent();
  const id=crypto.randomUUID(),photoPath=`${id}.jpg`;
  const {data,error}=await network(client.from('beta_public_observations').insert({id,owner_id:userId,local_id:metadata.id,photo_path:photoPath,photo_sha256:hash,record:metadata,public_consent:true,no_people:true}).select(RECORD_COLUMNS).single());
  if(error){row=await existing(client,userId,metadata.id);if(!row)throw new Error('공개 저장을 시작하지 못했어요. 연결 상태와 저장 용량을 확인해 주세요.');}
  else row=rowSchema.parse(data);
 }
 assertCurrent();
 if(row.state==='published'){compatible(row,metadata,hash);return {id:row.id,localId:row.local_id,photoUrl:link(client,row.photo_path),alreadyPublished:true};}
 if(row.photo_sha256!==hash)throw new Error('이 기록의 다른 사진이 이미 공개 저장 준비 중이에요. 새 기록으로 공개해 주세요.');
 await own(client,userId);assertCurrent();
 const bucket=client.storage.from(BUCKET),upload=await network(bucket.upload(row.photo_path,image,{contentType:'image/jpeg',upsert:false}));
 if(upload.error){const recovered=await network(bucket.download(row.photo_path));if(recovered.error||!recovered.data||await sha(recovered.data)!==hash)throw new Error('사진 전송을 완료하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');}
 assertCurrent();await own(client,userId);assertCurrent();
 let confirmed=false;
 try{
  const {data,error}=await network(client.rpc('finalize_beta_public_observation',{p_id:row.id,p_expected_record:row.record,p_new_record:metadata,p_photo_sha256:hash}));
  confirmed=!error&&data===true;
 }catch{/* The transaction may have completed despite a lost response. */}
 assertCurrent();
 const latest=await existing(client,userId,metadata.id);assertCurrent();
 if(latest?.state!=='published')throw new Error('공개 저장 결과를 확인하지 못했어요. 내 서버 기록을 확인한 뒤 다시 시도해 주세요.');
 compatible(latest,metadata,hash);
 return {id:latest.id,localId:latest.local_id,photoUrl:link(client,latest.photo_path),alreadyPublished:!confirmed};
}
export async function listBetaFeed(client:SupabaseClient):Promise<BetaFeedItem[]>{
 const {data,error}=await network(client.from('beta_public_feed').select(FEED_COLUMNS).order('published_at',{ascending:false}).limit(100));
 if(error)throw new Error('공개 베타 기록을 불러오지 못했어요. 연결을 확인해 주세요.');
 return z.array(betaPublicItemSchema).parse(data??[]).map(item=>({id:item.id,title:item.title,species:item.species,observedOn:item.observed_on,notes:item.notes,photoUrl:link(client,item.photo_path)}));
}
export async function listMyBetaObservations(client:SupabaseClient,userId:string):Promise<BetaOwnedObservation[]>{
 await own(client,userId);const {data,error}=await network(client.from('beta_public_observations').select(RECORD_COLUMNS).eq('owner_id',userId).eq('state','published').order('published_at',{ascending:false}).limit(500));
 if(error)throw new Error('내 서버 기록을 불러오지 못했어요. 연결을 확인해 주세요.');
 return z.array(rowSchema).parse(data??[]).map(r=>({id:r.id,localId:r.local_id,record:r.record,photoPath:r.photo_path}));
}
export async function restoreBetaObservation(client:SupabaseClient,userId:string,item:BetaOwnedObservation):Promise<Observation>{
 await own(client,userId);const {data,error}=await network(client.from('beta_public_observations').select(RECORD_COLUMNS).eq('id',item.id).eq('owner_id',userId).eq('state','published').maybeSingle());
 if(error||!data)throw new Error('내 서버 기록을 확인하지 못했어요.');const row=rowSchema.parse(data);
 const result=await network(client.storage.from(BUCKET).download(row.photo_path));if(result.error||!result.data||await sha(result.data)!==row.photo_sha256)throw new Error('사진을 안전하게 불러오지 못했어요.');
 const bytes=new Uint8Array(await result.data.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return observationSchema.parse({...row.record,sessionId:null,photo:`data:image/jpeg;base64,${btoa(binary)}`});
}
