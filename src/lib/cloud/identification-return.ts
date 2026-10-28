const KEY='nature-lens:identification-return:v1';
const TTL=24*60*60*1000;
export function rememberIdentification(id:string,storage:Pick<Storage,'setItem'>=localStorage,now=Date.now()){
 storage.setItem(KEY,JSON.stringify({id,expiresAt:now+TTL}));
}
export function pendingIdentification(storage:Pick<Storage,'getItem'|'removeItem'>=localStorage,now=Date.now()):string|null{
 try{const raw=storage.getItem(KEY);if(!raw)return null;const v=JSON.parse(raw);
  if(typeof v.id==='string'&&v.id.length>0&&v.id.length<200&&Number.isFinite(v.expiresAt)&&v.expiresAt>now&&v.expiresAt<=now+TTL)return v.id;
  storage.removeItem(KEY);
 }catch{/* Unavailable storage must not prevent normal local use. */}
 return null;
}
export function clearIdentificationReturn(storage:Pick<Storage,'removeItem'>=localStorage){try{storage.removeItem(KEY);}catch{}}
