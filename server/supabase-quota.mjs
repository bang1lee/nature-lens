// Only deployed on the server. Never import this module into browser code.
export class SupabaseQuotaLedger {
 constructor(url,key,fetcher=fetch){
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||!key)throw Error('Invalid quota configuration');
  this.url=parsed.origin;this.key=key;this.fetcher=fetcher;
 }
 async reserve(user,id){
  const response=await this.fetcher(`${this.url}/rest/v1/rpc/reserve_identification`,{
   method:'POST',headers:{apikey:this.key,Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},
   body:JSON.stringify({p_user_id:user,p_request_id:id}),signal:AbortSignal.timeout(5000),
  });
  if(!response.ok)throw Error('Quota unavailable');
  const result=await response.json();if(!['ok','duplicate','quota'].includes(result))throw Error('Invalid quota response');
  return result;
 }
 close(){}
}
