import {expect,it,vi} from 'vitest';
import {createSupabaseAuthenticator} from '../server/supabase-auth.mjs';

it('uses verified Supabase users to distinguish guests from members and rejects invalid tokens',async()=>{
 const fetcher=vi.fn(async(_url:string,options:RequestInit)=>{
  const token=(options.headers as Record<string,string>).Authorization;
  if(token==='Bearer guest-token')return Response.json({id:'guest-id',is_anonymous:true});
  if(token==='Bearer member-token')return Response.json({id:'member-id',is_anonymous:false});
  if(token==='Bearer missing-classification')return Response.json({id:'ambiguous-id'});
  if(token==='Bearer forged-classification')return Response.json({id:'ambiguous-id',is_anonymous:'false'});
  return new Response('{}',{status:401});
 });
 const authenticate=createSupabaseAuthenticator('https://auth.example','public-key',fetcher as unknown as typeof fetch);
 expect(await authenticate('guest-token')).toEqual({id:'guest-id',isAnonymous:true});
 expect(await authenticate('member-token')).toEqual({id:'member-id',isAnonymous:false});
 expect(await authenticate('invalid-token')).toBeNull();
 expect(await authenticate('missing-classification')).toBeNull();
 expect(await authenticate('forged-classification')).toBeNull();
 const [url,options]=fetcher.mock.calls[0];
 expect(url).toBe('https://auth.example/auth/v1/user');
 expect(options.headers).toEqual({Authorization:'Bearer guest-token',apikey:'public-key'});
});
