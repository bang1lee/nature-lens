export class DiscoveryStore {
 constructor(url,key,fetcher=fetch){this.url=new URL(url).origin;this.key=key;this.fetcher=fetcher;}
 async action(user,action,data){
  const r=await this.fetcher(`${this.url}/rest/v1/rpc/discovery_action`,{method:'POST',headers:{apikey:this.key,Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify({p_user:user,p_action:action,p_data:data}),signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw Error('Discovery unavailable');return r.json();
 }
}
