import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TaxonDetails} from '../src/components/mobile/TaxonCard';
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
   if(url.startsWith('https://commons.wikimedia.org/'))return json({query:{pages:{'1':{imageinfo:[{url:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Pine.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Pine.jpg',extmetadata:{Artist:{value:'<a href="/wiki/User:A">Author &amp; Co</a>'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]}}}});
   return json({extract:'소나무(학명: Pinus densiflora)는 구과목 소나무과의 식물이다.',thumbnail:{source:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pine.jpg/320px-Pine.jpg'},content_urls:{mobile:{page:'https://ko.m.wikipedia.org/wiki/소나무'}}});
  });
  expect(info).toMatchObject({koreanName:'소나무',level:'species',matchedName:'Pinus densiflora',image:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pine.jpg/320px-Pine.jpg',url:'https://ko.m.wikipedia.org/wiki/소나무'});
  expect(info?.description).toBe('소나무는 구과목 소나무과의 식물이다.');
  expect(calls).toHaveLength(3);
  expect(info?.imageCredit).toMatchObject({author:'Author & Co',license:'CC BY-SA 4.0',sourceUrl:'https://commons.wikimedia.org/wiki/File:Pine.jpg'});
  expect(decodeURIComponent(calls[0])).toContain('sites=specieswiki&titles=Pinus densiflora');
 });
 it('hides photos without verified Commons license, author, or matching original while keeping attributed text',async()=>{
  for(const fields of [
   {Artist:{value:'Author'},LicenseShortName:{value:'CC BY 4.0'}},
   {LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by/4.0/'}},
   {Artist:{value:'Author'},LicenseShortName:{value:'CC BY 4.0'},LicenseUrl:{value:'https://evil.example/license'}},
  ]) {
   const info=await fetchTaxonInfo('Pinus densiflora',async url=>url.startsWith('https://www.wikidata.org/')?json(entity('소나무')):url.startsWith('https://commons.wikimedia.org/')?json({query:{pages:{'1':{imageinfo:[{url:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Pine.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Pine.jpg',extmetadata:fields}]}}}}):json({extract:'소나무 설명입니다.',thumbnail:{source:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pine.jpg/320px-Pine.jpg'},content_urls:{mobile:{page:'https://ko.m.wikipedia.org/wiki/소나무'}}}));
   expect(info).toMatchObject({image:null,imageCredit:null,description:'소나무 설명입니다.'});
  }
 });
 it('does not reuse text without a valid article attribution link',async()=>{
  const info=await fetchTaxonInfo('Pinus densiflora',async url=>url.startsWith('https://www.wikidata.org/')?json(entity('소나무')):json({extract:'설명입니다.',content_urls:{mobile:{page:'https://fake.wikipedia.org/wiki/x'}}}));
  expect(info).toMatchObject({koreanName:'소나무',description:null,url:null});
 });
 it('renders credits as text and never interprets metadata as markup',()=>{
  const html=renderToStaticMarkup(createElement(TaxonDetails,{lookup:{state:'done',info:{scientificName:'Pinus densiflora',matchedName:'Pinus densiflora',level:'species',koreanName:'소나무',description:'설명',image:'https://upload.wikimedia.org/test.jpg',imageCredit:{author:'<img src=x onerror=alert(1)>',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Test.jpg'},url:'https://ko.wikipedia.org/wiki/소나무'}}}));
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).toContain('CC BY-SA 4.0');
  expect(html).toContain('원문 일부를 짧게 편집');
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
