import { createBackup, restoreBackupFile } from './backup';
import { parseBackup } from './domain';
import {
  TRANSFER_API_PATH, TRANSFER_MAX_BYTES, TRANSFER_MIN_BYTES, TRANSFER_DECOMPRESSED_MAX_BYTES,
  TRANSFER_MAGIC, TRANSFER_ID_PATTERN, TRANSFER_SECRET_PATTERN,
  type TransferErrorKind, type TransferLink, type CreateTransferResponse, type CapabilitiesResponse,
  type SentTransferRecord, SENT_TRANSFERS_STORAGE_KEY, RESTORED_TRANSFERS_STORAGE_KEY,
} from './transfer-contract';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const encoder = new TextEncoder();
const magic = encoder.encode(TRANSFER_MAGIC);
export class TransferError extends Error {
  constructor(public kind: TransferErrorKind, public size?: number) {
    super(({ 'too-large':'사진을 포함한 크기가 전달 한도(1MiB)를 넘어요. 파일 백업을 이용해 주세요.', 'link-invalid':'링크가 잘렸거나 올바르지 않아요. 전체 링크를 다시 복사해 주세요.', 'not-found':'만료됐거나 삭제됐거나 잘못된 링크예요.', decrypt:'링크의 키가 맞지 않거나 내용이 손상됐어요. 기존 기록은 변경하지 않았습니다.', 'invalid-backup':'올바른 Nature Lens 백업이 아닙니다. 기존 기록은 변경하지 않았습니다.', quota:'지금은 전달 보관 한도에 도달했어요. 파일 백업을 이용하거나 나중에 다시 시도해 주세요.', 'rate-limited':'요청이 많아요. 잠시 뒤 다시 시도해 주세요.', disabled:'이 주소에서는 암호화 임시 전달을 사용할 수 없어요. 파일 백업을 이용하세요.', network:'서버에 연결하지 못했어요. 백업 파일을 이용할 수도 있어요.' } satisfies Record<TransferErrorKind,string>)[kind]);
    if(kind==='too-large'&&size!==undefined&&size>TRANSFER_DECOMPRESSED_MAX_BYTES)this.message='복원할 백업이 50MiB를 넘어요. 기존 기록은 변경하지 않았습니다.';
    this.name='TransferError';
  }
}
export function transferErrorMessage(error: unknown): string {
  return error instanceof TransferError ? error.message : '처리하지 못했어요. 기존 기록은 그대로예요. 파일 백업을 이용해 주세요.';
}
function toB64(bytes: Uint8Array): string {
  let value='';for(const b of bytes)value+=String.fromCharCode(b);
  return btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64(value:string):Uint8Array {
  if(!TRANSFER_SECRET_PATTERN.test(value))throw new TransferError('link-invalid');
  try { const result=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));if(result.length!==32||toB64(result)!==value)throw new Error();return result; }
  catch {throw new TransferError('link-invalid');}
}
export async function readLimited(stream: ReadableStream<Uint8Array> | null, max:number):Promise<Uint8Array> {
  if(!stream)throw new TransferError('network');
  const reader=stream.getReader();const chunks:Uint8Array[]=[];let size=0;
  try { while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>max){await reader.cancel().catch(()=>{});throw new TransferError('too-large',size);}chunks.push(next.value);} }
  finally {reader.releaseLock();}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
}
export function validateEnvelope(bytes:Uint8Array): void {
  if(bytes.byteLength>TRANSFER_MAX_BYTES)throw new TransferError('too-large',bytes.byteLength);
  if(bytes.byteLength<TRANSFER_MIN_BYTES||magic.some((b,i)=>bytes[i]!==b))throw new TransferError('decrypt');
}
export async function encryptTransferText(text:string):Promise<{envelope:Uint8Array;keyB64u:string}> {
  if(!globalThis.CompressionStream||!globalThis.crypto?.subtle)throw new TransferError('disabled');
  const compressed=await readLimited(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')),TRANSFER_MAX_BYTES-32);
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:magic},key,compressed.buffer as ArrayBuffer));
  const envelope=new Uint8Array(16+ciphertext.length);envelope.set(magic);envelope.set(iv,4);envelope.set(ciphertext,16);validateEnvelope(envelope);
  return {envelope,keyB64u:toB64(new Uint8Array(await crypto.subtle.exportKey('raw',key)))};
}
export async function buildTransferEnvelope() {
  const backup=await createBackup();if(backup.blob.size>TRANSFER_DECOMPRESSED_MAX_BYTES)throw new TransferError('too-large',backup.blob.size);
  const text=await backup.blob.text();const data=parseBackup(text);return {...await encryptTransferText(text),observations:backup.observations,collections:data.collections.length};
}
export async function decryptTransfer(envelope:Uint8Array,keyB64u:string):Promise<string> {
  validateEnvelope(envelope);let decrypted:ArrayBuffer;
  try {
    const raw=fromB64(keyB64u);const key=await crypto.subtle.importKey('raw',raw.buffer as ArrayBuffer,{name:'AES-GCM'},false,['decrypt']);
    decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:envelope.slice(4,16),additionalData:magic},key,envelope.slice(16));
  }catch{throw new TransferError('decrypt');}
  try {
    const text=await readLimited(new Blob([decrypted]).stream().pipeThrough(new DecompressionStream('gzip')),TRANSFER_DECOMPRESSED_MAX_BYTES);
    return new TextDecoder('utf-8',{fatal:true}).decode(text);
  }catch(e){if(e instanceof TransferError)throw e;throw new TransferError('decrypt');}
}
export function previewTransfer(text:string) {
  try { const data=parseBackup(text);return {observations:data.observations.length,collections:data.collections.length,items:data.observations.slice(0,6).map(o=>({id:o.id,title:o.title,photo:o.photo})),titles:data.observations.map(o=>o.title)}; }
  catch {throw new TransferError('invalid-backup');}
}
export async function restoreTransfer(text:string):Promise<number> { previewTransfer(text);return restoreBackupFile(new File([text],'transfer.json',{type:'application/json'})); }
export function parseTransferLink(hash:string):TransferLink {
  const parts=hash.replace(/^#/,'').split('.');
  if(parts.length!==4||parts[0]!=='v1'||!TRANSFER_ID_PATTERN.test(parts[1])||!TRANSFER_SECRET_PATTERN.test(parts[2])||!TRANSFER_SECRET_PATTERN.test(parts[3]))throw new TransferError('link-invalid');
  // Validate the key's canonical 32-byte representation before attempting crypto.
  fromB64(parts[3]);
  return {version:'v1',id:parts[1],readToken:parts[2],key:parts[3]};
}
export function formatTransferLink(origin:string,link:TransferLink,basePath=base):string {
  const url=new URL(origin);if(!/^https?:$/.test(url.protocol)||url.username||url.password)throw new TransferError('link-invalid');
  const prefix=basePath?'/'+basePath.replace(/^\/+|\/+$/g,''):'';
  const hash=`v1.${link.id}.${link.readToken}.${link.key}`;parseTransferLink(hash);
  return `${url.origin}${prefix}/transfer/#${hash}`;
}
const unavailable:CapabilitiesResponse={localStorage:true,transfer:{available:false,maxBytes:TRANSFER_MAX_BYTES,ttlSeconds:86400},sync:false,identify:false};
export async function fetchServiceCapabilities(signal?:AbortSignal,fetcher:typeof fetch=fetch):Promise<CapabilitiesResponse> {
  try {const response=await fetcher(`${base}/api/capabilities`,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),cache:'no-store',credentials:'omit'});if(!response.ok) return unavailable;
    const v=await response.json();if(v?.localStorage!==true||v?.sync!==false||v?.identify!==false||typeof v?.transfer?.available!=='boolean'||v.transfer.maxBytes!==TRANSFER_MAX_BYTES||!Number.isInteger(v.transfer.ttlSeconds)||v.transfer.ttlSeconds<=0)return unavailable;return v;
  }catch{return unavailable;}
}
async function responseError(response:Response):Promise<never> {
  if(response.status===404)throw new TransferError('not-found');
  if(response.status===413)throw new TransferError('too-large');
  if(response.status===503)throw new TransferError('disabled');
  if(response.status===429){let code='';try{code=(await response.json()).error;}catch{}throw new TransferError(code==='rate-limited'?'rate-limited':'quota');}
  throw new TransferError('network');
}
export async function uploadTransfer(envelope:Uint8Array,fetcher:typeof fetch=fetch):Promise<CreateTransferResponse> {
  validateEnvelope(envelope);
  try {const response=await fetcher(`${base}${TRANSFER_API_PATH}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:envelope.slice().buffer,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(25000)});if(!response.ok) return await responseError(response);
    const v=await response.json();if(response.status!==201||!TRANSFER_ID_PATTERN.test(v?.id)||!TRANSFER_SECRET_PATTERN.test(v?.readToken)||!TRANSFER_SECRET_PATTERN.test(v?.deleteToken)||!Number.isFinite(Date.parse(v?.expiresAt))||v?.size!==envelope.length)throw new TransferError('network');return v;
  }catch(e){if(e instanceof TransferError)throw e;throw new TransferError('network');}
}
export async function fetchTransfer(link:TransferLink,signal?:AbortSignal,fetcher:typeof fetch=fetch):Promise<Uint8Array> {
  parseTransferLink(`v1.${link.id}.${link.readToken}.${link.key}`);
  try {const response=await fetcher(`${base}${TRANSFER_API_PATH}/${link.id}`,{headers:{Authorization:`Bearer ${link.readToken}`},credentials:'omit',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});if(!response.ok)return await responseError(response);
    if(!response.headers.get('Content-Type')?.startsWith('application/octet-stream'))throw new TransferError('network');
    const size=Number(response.headers.get('Content-Length'));if(size>TRANSFER_MAX_BYTES){await response.body?.cancel().catch(()=>{});throw new TransferError('too-large',size);}
    const bytes=await readLimited(response.body,TRANSFER_MAX_BYTES);validateEnvelope(bytes);return bytes;
  }catch(e){if(e instanceof TransferError)throw e;throw new TransferError('network');}
}
export async function deleteTransfer(id:string,deleteToken:string,fetcher:typeof fetch=fetch):Promise<void> {
  if(!TRANSFER_ID_PATTERN.test(id)||!TRANSFER_SECRET_PATTERN.test(deleteToken))throw new TransferError('link-invalid');
  try {const r=await fetcher(`${base}${TRANSFER_API_PATH}/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${deleteToken}`},credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(25000)});if(r.status===404)return;if(!r.ok)return await responseError(r);const v=await r.json();if(v?.deleted!==true)throw new TransferError('network');}
  catch(e){if(e instanceof TransferError)throw e;throw new TransferError('network');}
}
export function readSentTransfers():SentTransferRecord[] {
  try {const list=JSON.parse(localStorage.getItem(SENT_TRANSFERS_STORAGE_KEY)||'[]');if(!Array.isArray(list))return [];
    return list.filter(v=>TRANSFER_ID_PATTERN.test(v?.id)&&TRANSFER_SECRET_PATTERN.test(v?.deleteToken)&&Number.isFinite(Date.parse(v?.expiresAt))&&Number.isInteger(v?.observations)&&v.observations>=0).slice(-32).map(({id,deleteToken,expiresAt,observations})=>({id,deleteToken,expiresAt,observations}));
  }catch{return [];}
}
export function writeSentTransfers(list:SentTransferRecord[]):void {localStorage.setItem(SENT_TRANSFERS_STORAGE_KEY,JSON.stringify(list.map(({id,deleteToken,expiresAt,observations})=>({id,deleteToken,expiresAt,observations}))));}
export function wasTransferRestored(id:string):boolean {try{return JSON.parse(localStorage.getItem(RESTORED_TRANSFERS_STORAGE_KEY)||'[]').includes(id);}catch{return false;}}
export function markTransferRestored(id:string):void {let ids:string[]=[];try{const raw=JSON.parse(localStorage.getItem(RESTORED_TRANSFERS_STORAGE_KEY)||'[]');if(Array.isArray(raw))ids=raw.filter(v=>typeof v==='string'&&TRANSFER_ID_PATTERN.test(v));}catch{}localStorage.setItem(RESTORED_TRANSFERS_STORAGE_KEY,JSON.stringify([...new Set([...ids,id])].slice(-100)));}
