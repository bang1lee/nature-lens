import {afterEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {cloudErrorMessage,fetchAlias,requestMagicLink} from '../src/lib/cloud/api';

afterEach(()=>vi.useRealTimers());

it('gives a mail-specific next step for delivery limits and unauthorized recipients',async()=>{
 for(const [failure,expected] of [
  [{code:'over_email_send_rate_limit',status:429,message:'email rate limit exceeded'},/메일.*한도/],
  [{code:'email_address_not_authorized',status:400,message:'Email address not authorized'},/SMTP/],
 ] as const){
  const client={auth:{signInWithOtp:vi.fn().mockResolvedValue({data:{user:null,session:null},error:failure})}} as unknown as SupabaseClient;
  await expect(requestMagicLink(client,'test@example.org','https://example.org/mobile/')).rejects.toThrow(expected);
 }
});

it('preserves a community setup error after the API translates it',async()=>{
 const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:{code:'PGRST205',message:"Could not find the table 'public.profiles' in the schema cache"}})})})})} as unknown as SupabaseClient;
 const error=await fetchAlias(client,'test-user').catch(e=>e);
 expect(cloudErrorMessage(error)).toMatch(/공동 관찰.*준비/);
 expect(cloudErrorMessage(error)).toMatch(/내 기록/);
});

it('ends an unanswered login request without claiming mail delivery or retrying it',async()=>{
 vi.useFakeTimers();
 const send=vi.fn(()=>new Promise<never>(()=>{}));
 const client={auth:{signInWithOtp:send}} as unknown as SupabaseClient;
 const outcome=requestMagicLink(client,'test@example.org','https://example.org/mobile/').catch(e=>e);
 await vi.advanceTimersByTimeAsync(15_000);
 expect(await outcome).toBeInstanceOf(Error);
 expect((await outcome).message).toMatch(/메일함/);
 expect(send).toHaveBeenCalledTimes(1);
});
