import {it,expect,vi} from 'vitest';
import {parseIdentificationEndpoint,requestIdentification} from '../src/lib/ai/client';
it('only allows HTTPS or local gateway URLs without credentials/query/hash',()=>{
 expect(parseIdentificationEndpoint('https://api.example.org')).toBe('https://api.example.org');
 for(const url of ['http://api.example.org','https://secret@api.example.org','https://api.example.org?key=a','https://api.example.org#x'])expect(parseIdentificationEndpoint(url)).toBeNull();
});
it('rejects invalid requests before fetch and attaches user token only to gateway',async()=>{
 const fetcher=vi.fn();await expect(requestIdentification('http://localhost:8787','token',{},new AbortController().signal,fetcher)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
});
