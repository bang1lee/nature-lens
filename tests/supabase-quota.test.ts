import {it,expect,vi} from 'vitest';
import {SupabaseQuotaLedger} from '../server/supabase-quota.mjs';
import {createGateway} from '../server/gateway.mjs';
it('sends only quota IDs to Supabase and fails closed on bad RPC replies',async()=>{
 const fetcher=vi.fn(async()=>new Response('"ok"',{status:200}));
 const ledger=new SupabaseQuotaLedger('https://example.supabase.co','server-only-test-key',fetcher);
 expect(await ledger.reserve('user','request')).toBe('ok');
 const call=fetcher.mock.calls[0] as unknown as [string,RequestInit];
 expect(call[0]).toBe('https://example.supabase.co/rest/v1/rpc/reserve_identification');
 expect(JSON.parse(call[1].body as string)).toEqual({p_user_id:'user',p_request_id:'request'});
 const broken=new SupabaseQuotaLedger('https://example.supabase.co','test',async()=>new Response('{}'));
 await expect(broken.reserve('u','r')).rejects.toThrow('Invalid quota response');
});
it('gateway awaits durable quota before sending any provider request',async()=>{
 let release!:(value:string)=>void;const wait=new Promise<string>(resolve=>{release=resolve;});
 const provider=vi.fn();const gateway=createGateway({enabled:true,origins:['https://app.example'],keys:{plant:'test'},policyUrl:'https://app.example/policy'}, {authenticate:async()=> 'user',ledger:{reserve:()=>wait},sanitize:async()=>Buffer.from('photo'),provider});
 const request=new Request('https://api.example/identify',{method:'POST',headers:{Origin:'https://app.example','Content-Type':'application/json',Authorization:'Bearer test'},body:JSON.stringify({requestId:crypto.randomUUID(),observationId:'record',photo:'data:image/jpeg;base64,YQ==',taxonGroup:'plant',transmissionConsent:true,noPeople:true})});
 const result=gateway(request);expect(provider).not.toHaveBeenCalled();release('quota');expect((await result).status).toBe(429);expect(provider).not.toHaveBeenCalled();
});
