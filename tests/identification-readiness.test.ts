import {expect,it,vi} from 'vitest';
import {checkIdentificationService} from '../src/lib/ai/readiness';
it('classifies ready, disabled, invalid policy and network failure without sending a photo',async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({groups:['plant'],policyUrl:'https://example.org/policy'})));
 const ready=await checkIdentificationService('https://example.org',new AbortController().signal,fetcher);
 expect(ready).toMatchObject({state:'ready',groups:['plant']});
 expect(fetcher.mock.calls[0][1]).not.toHaveProperty('body');
 expect(await checkIdentificationService(null,new AbortController().signal,fetcher)).toEqual({state:'unconfigured'});
 expect(await checkIdentificationService('https://example.org',new AbortController().signal,async()=>new Response(JSON.stringify({groups:[],policyUrl:null})))).toEqual({state:'disabled'});
 expect(await checkIdentificationService('https://example.org',new AbortController().signal,async()=>new Response(JSON.stringify({groups:['plant'],policyUrl:'http://unsafe.test'})))).toEqual({state:'invalid'});
 expect(await checkIdentificationService('https://example.org',new AbortController().signal,async()=>{throw new TypeError('offline');})).toEqual({state:'unavailable'});
});
it('distinguishes timeout and cancellation and rejects a bad response',async()=>{
 const signal=new AbortController().signal;
 expect(await checkIdentificationService('https://example.org',signal,async()=>{throw new DOMException('slow','TimeoutError');})).toEqual({state:'timeout'});
 expect(await checkIdentificationService('https://example.org',signal,async()=>new Response('{}'))).toEqual({state:'invalid'});
 const c=new AbortController();c.abort();
 await expect(checkIdentificationService('https://example.org',c.signal,fetch)).rejects.toBeDefined();
});
