import {describe,it,expect} from 'vitest';
import {fetchTaxonInfo,nameCandidates,shortDescription} from '../src/lib/taxon-info';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const entity=(title?:string,label?:string)=>({entities:title||label?{Q1:{...(title?{sitelinks:{kowiki:{title}}}:{}),...(label?{labels:{ko:{value:label}}}:{})}}:{'-1':{missing:''}}});
const sparql=(title?:string,label?:string)=>({results:{bindings:title||label?[{...(title?{title:{value:title}}:{}),...(label?{label:{value:label}}:{})}]:[]}});

describe('encyclopedia lookup for a scientific name',()=>{
 it('tries the full name, the binomial, then the genus and rejects unsafe input',()=>{
  expect(nameCandidates('Pinus densiflora')).toEqual([{name:'Pinus densiflora',level:'species'},{name:'Pinus',level:'genus'}]);
  expect(nameCandidates('Taraxacum sect. Taraxacum')).toEqual([{name:'Taraxacum',level:'genus'}]);
  expect(nameCandidates('Acer pictum subsp. mono')).toEqual([{name:'Acer pictum',level:'species'},{name:'Acer',level:'genus'}]);
  expect(nameCandidates('Pinus" } UNION { ?s ?p ?o')).toEqual([]);
  expect(nameCandidates('')).toEqual([]);
 });
 it('keeps a short description without the bracketed scientific-name aside',()=>{
  expect(shortDescription('소나무(학명: Pinus densiflora)는 구과목 소나무과의 식물이다. 대한민국, 일본이 원산이다. 전국 산야에서 흔하게 자란다.')).toBe('소나무는 구과목 소나무과의 식물이다. 대한민국, 일본이 원산이다.');
  expect(shortDescription('   ')).toBeNull();
 });
 it('returns the Korean article name, description and an allowed image for an exact species match',async()=>{
  const calls:string[]=[];
  const info=await fetchTaxonInfo('Pinus densiflora',async url=>{calls.push(url);
   if(url.startsWith('https://www.wikidata.org/'))return json(entity('소나무','소나무'));
   return json({extract:'소나무(학명: Pinus densiflora)는 구과목 소나무과의 식물이다.',thumbnail:{source:'https://upload.wikimedia.org/a.jpg'},content_urls:{mobile:{page:'https://ko.m.wikipedia.org/wiki/소나무'}}});
  });
  expect(info).toMatchObject({koreanName:'소나무',level:'species',matchedName:'Pinus densiflora',image:'https://upload.wikimedia.org/a.jpg',url:'https://ko.m.wikipedia.org/wiki/소나무'});
  expect(info?.description).toBe('소나무는 구과목 소나무과의 식물이다.');
  expect(calls).toHaveLength(2);
  expect(decodeURIComponent(calls[0])).toContain('sites=specieswiki&titles=Pinus densiflora');
 });
 it('falls back to the genus and marks it, and drops images or links from other hosts',async()=>{
  const info=await fetchTaxonInfo('Taraxacum sect. Taraxacum',async url=>url.startsWith('https://www.wikidata.org/')?json(entity('민들레 (식물)')):json({extract:'민들레는 여러해살이풀이다.',thumbnail:{source:'https://evil.example/a.jpg'},content_urls:{mobile:{page:'https://evil.example/x'}}}));
  expect(info).toMatchObject({koreanName:'민들레',level:'genus',matchedName:'Taraxacum',image:null,url:null});
 });
 it('returns nothing when no Korean name or description exists, and the name survives a failed summary',async()=>{
  const wd=(url:string,a:unknown,b:unknown)=>url.startsWith('https://www.wikidata.org/')?json(a):url.startsWith('https://query.wikidata.org/')?json(b):json({},500);
  expect(await fetchTaxonInfo('Obscurus plantus',async url=>wd(url,entity(),sparql()))).toBeNull();
  expect(await fetchTaxonInfo('Obscurus plantus',async url=>wd(url,entity(undefined,'Obscurus plantus'),sparql(undefined,'Obscurus plantus')))).toBeNull();
  const info=await fetchTaxonInfo('Zelkova serrata',async url=>wd(url,entity('느티나무'),sparql()));
  expect(info).toMatchObject({koreanName:'느티나무',description:null,image:null});
 });
 it('uses the slower exact taxon-name query when the title lookup has no Korean entry, and survives one source failing',async()=>{
  const calls:string[]=[];
  const info=await fetchTaxonInfo('Acer pictum',async url=>{calls.push(new URL(url).hostname);return url.startsWith('https://www.wikidata.org/')?json(entity()):url.startsWith('https://query.wikidata.org/')?json(sparql('고로쇠나무')):json({extract:'고로쇠나무는 단풍나무과의 나무이다.'});});
  expect(info).toMatchObject({koreanName:'고로쇠나무',level:'species'});
  expect(calls).toEqual(['www.wikidata.org','query.wikidata.org','ko.wikipedia.org']);
  const viaFallback=await fetchTaxonInfo('Acer pictum',async url=>url.startsWith('https://www.wikidata.org/')?json({},503):url.startsWith('https://query.wikidata.org/')?json(sparql('고로쇠나무')):json({},500));
  expect(viaFallback).toMatchObject({koreanName:'고로쇠나무'});
  await expect(fetchTaxonInfo('Acer pictum',async()=>json({},503))).rejects.toThrow();
 });
});
