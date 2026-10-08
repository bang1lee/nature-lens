import { beforeEach, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { newObservation } from '../src/lib/domain';
import { readLibrary, saveObservation } from '../src/lib/storage';
import { TRANSFER_MAX_BYTES } from '../src/lib/transfer-contract';
import { buildTransferEnvelope, encryptTransferText, decryptTransfer, validateEnvelope, formatTransferLink, parseTransferLink, previewTransfer, restoreTransfer, readLimited, uploadTransfer, fetchTransfer, fetchServiceCapabilities } from '../src/lib/transfer';
vi.mock('../src/lib/image', () => ({ preparePhoto: async () => 'data:image/jpeg;base64,YWJj' }));
beforeEach(async () => { await deleteDB('nature-lens-v1'); });
const fixture = () => ({ ...newObservation(), title:'숲에서 만난 잎', photo:'data:image/jpeg;base64,YWJj', notes:'잎맥을 살펴봤어요' });
it('encrypts a complete backup and previews without writing, then restores only new ids as drafts',async()=>{
 await saveObservation(fixture(),null);const built=await buildTransferEnvelope();
 expect(built.observations).toBe(1);expect(built.collections).toBe(0);
 const text=await decryptTransfer(built.envelope,built.keyB64u);
 await deleteDB('nature-lens-v1');expect(previewTransfer(text).observations).toBe(1);expect((await readLibrary()).observations).toHaveLength(0);
 expect(await restoreTransfer(text)).toBe(1);expect(await restoreTransfer(text)).toBe(0);
 const stored=(await readLibrary()).observations;expect(stored[0].status).toBe('draft');expect(stored[0].photo).toMatch(/^data:image/);
});
it('uses a fresh IV for every encrypted payload',async()=>{
 const seen=new Set<string>();for(let i=0;i<100;i++){const b=await encryptTransferText('{"version":1}');seen.add(Buffer.from(b.envelope.slice(4,16)).toString('hex'));}expect(seen.size).toBe(100);
});
it('rejects tampered ciphertext, wrong keys and a changed envelope magic',async()=>{
 const first=await encryptTransferText('private observation');const second=await encryptTransferText('other');
 const changed=first.envelope.slice();changed[changed.length-1]^=1;
 await expect(decryptTransfer(changed,first.keyB64u)).rejects.toMatchObject({kind:'decrypt'});
 await expect(decryptTransfer(first.envelope,second.keyB64u)).rejects.toMatchObject({kind:'decrypt'});
 const magic=first.envelope.slice();magic[0]=0;await expect(decryptTransfer(magic,first.keyB64u)).rejects.toMatchObject({kind:'decrypt'});
});
it('accepts the exact envelope boundary and rejects the next byte before network upload',async()=>{
 const bytes=new Uint8Array(TRANSFER_MAX_BYTES);bytes.set(new TextEncoder().encode('NLT1'));expect(()=>validateEnvelope(bytes)).not.toThrow();
 expect(()=>validateEnvelope(new Uint8Array(TRANSFER_MAX_BYTES+1))).toThrowError(/1MiB/);
 let calls=0;await expect(uploadTransfer(new Uint8Array(TRANSFER_MAX_BYTES+1),async()=>{calls++;return new Response();})).rejects.toMatchObject({kind:'too-large'});expect(calls).toBe(0);
});
it('cancels a stream when its output exceeds the bounded reader limit',async()=>{
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({pull(c){c.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}});
 await expect(readLimited(stream,10)).rejects.toMatchObject({kind:'too-large'});expect(cancelled).toBe(true);
});
it('rejects gzip output over 50MiB instead of materializing an unbounded backup',async()=>{
 const compressed=await encryptTransferText(' '.repeat(50*1024*1024+1));
 await expect(decryptTransfer(compressed.envelope,compressed.keyB64u)).rejects.toMatchObject({kind:'too-large',message:expect.stringContaining('50MiB')});
});
it('preserves root and GitHub base paths while keeping all secrets in the fragment',()=>{
 const input={version:'v1' as const,id:'a'.repeat(22),readToken:'b'.repeat(43),key:'c'.repeat(43)};
 const url=formatTransferLink('https://example.com',input,'/nature-lens');expect(new URL(url).pathname).toBe('/nature-lens/transfer/');expect(new URL(url).search).toBe('');expect(parseTransferLink(new URL(url).hash)).toEqual(input);
 expect(new URL(formatTransferLink('https://example.com',input,'')).pathname).toBe('/transfer/');
 for(const hash of ['#v1.a.b.c','#v2.'+input.id+'.'+input.readToken+'.'+input.key,'#v1.'+input.id+'.'+input.readToken+'.'+input.key+'.extra'])expect(()=>parseTransferLink(hash)).toThrow();
});
it('rejects malformed upload success and oversized GET replies',async()=>{
 const b=await encryptTransferText('ok');await expect(uploadTransfer(b.envelope,async()=>Response.json({id:'wrong'}))).rejects.toMatchObject({kind:'network'});
 const link={version:'v1' as const,id:'a'.repeat(22),readToken:'b'.repeat(43),key:'c'.repeat(43)};
 await expect(fetchTransfer(link,undefined,async()=>new Response(new Uint8Array(TRANSFER_MAX_BYTES+1),{headers:{'content-type':'application/octet-stream'}}))).rejects.toMatchObject({kind:'too-large'});
});
it('fails closed when capabilities return HTML or incompatible JSON',async()=>{
 expect((await fetchServiceCapabilities(undefined,async()=>new Response('<html/>'))).transfer.available).toBe(false);
 expect((await fetchServiceCapabilities(undefined,async()=>Response.json({transfer:{available:true}}))).transfer.available).toBe(false);
});
