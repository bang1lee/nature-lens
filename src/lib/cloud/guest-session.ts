import type {Session,SupabaseClient} from '@supabase/supabase-js';
import {cloudConfig} from './config';

export type GuestSessionClient={client:SupabaseClient;session:Session};
const pendingByClient=new WeakMap<SupabaseClient,Promise<GuestSessionClient>>();
let guestClient:Promise<SupabaseClient>|null=null;

/** Guest auth has its own storage so an overlapping member login cannot be overwritten. */
export function getGuestSupabase():Promise<SupabaseClient>{
 if(!cloudConfig.enabled)return Promise.reject(new Error('서버 연결이 설정되지 않았어요.'));
 if(!guestClient){
  const {url,key}=cloudConfig;
  guestClient=import('@supabase/supabase-js').then(({createClient})=>createClient(url,key,{auth:{storageKey:'nature-lens:guest-session:v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}));
  void guestClient.catch(()=>{guestClient=null;});
 }
 return guestClient;
}

/** Called only after the user chooses an action that needs a server session. */
export function getOrCreateGuestSession(mainClient:SupabaseClient):Promise<GuestSessionClient>{
 const pending=pendingByClient.get(mainClient);
 if(pending)return pending;
 const work=(async()=>{
  const current=await mainClient.auth.getSession();
  if(current.error)throw new Error('연결 상태를 확인하지 못했어요. 다시 시도해 주세요.');
  if(current.data.session&&!current.data.session.user.is_anonymous)return {client:mainClient,session:current.data.session};
  const client=await getGuestSupabase();
  const existing=await client.auth.getSession();
  if(existing.error)throw new Error('연결 상태를 확인하지 못했어요. 다시 시도해 주세요.');
  let session=existing.data.session;
  if(!session){
   const created=await client.auth.signInAnonymously();
   if(created.error||!created.data.session)throw new Error('가입 없이 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
   session=created.data.session;
  }
  const latest=await mainClient.auth.getSession();
  if(latest.error)throw new Error('연결 상태를 확인하지 못했어요. 다시 시도해 주세요.');
  if(latest.data.session&&!latest.data.session.user.is_anonymous)return {client:mainClient,session:latest.data.session};
  return {client,session};
 })();
 pendingByClient.set(mainClient,work);
 void work.then(()=>pendingByClient.delete(mainClient),()=>pendingByClient.delete(mainClient));
 return work;
}
