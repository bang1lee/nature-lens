// Authenticate with Supabase instead of trusting claims supplied by the browser.
export function createSupabaseAuthenticator(url,key,fetcher=fetch){
 return async token=>{
  if(typeof token!=='string'||!token)return null;
  const r=await fetcher(`${url.replace(/\/+$/,'')}/auth/v1/user`,{
   headers:{Authorization:`Bearer ${token}`,apikey:key},signal:AbortSignal.timeout(5000),
  });
  if(!r.ok)return null;
  const user=await r.json();
  if(!user||typeof user.id!=='string'||!user.id||typeof user.is_anonymous!=='boolean')return null;
  return {id:user.id,isAnonymous:user.is_anonymous};
 };
}
