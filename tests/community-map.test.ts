import {describe,it,expect} from 'vitest';
import {mapPointSchema, mapFeatures, mapSelection} from '../src/lib/cloud/map';

describe('public map boundary',()=>{
 const a={id:'11111111-1111-4111-8111-111111111111',area_id:'ridge',area_label:'산책 구역',latitude:37.02,longitude:127.31};
 it('accepts only the explicit public projection',()=>{
  expect(mapPointSchema.parse({...a,owner_id:'private',photo:'private'})).toEqual(a);
  expect(mapPointSchema.safeParse({...a,latitude:100}).success).toBe(false);
 });
 it('groups records with the same representative area without inventing locations',()=>{
  const b={...a,id:'22222222-2222-4222-8222-222222222222'};
  expect(mapFeatures([a,b]).features.map(f=>f.geometry.coordinates)).toEqual([[127.31,37.02],[127.31,37.02]]);
  expect(mapSelection([a,b],'ridge').map(x=>x.id)).toEqual([a.id,b.id]);
 });
});

import {submissionPayloadSchema} from '../src/lib/cloud/contract';
it('accepts map consent only with a selected public area',()=>{
 const base={title:'꽃',species:'꽃',scientific_name:'',observed_on:'2026-10-01',notes:'기록',habitat:'',taxon_group:'plant',region:null,protection:'common',photo:'data:image/jpeg;base64,YQ==',consent_upload:true,no_people:true,ai_assisted:false};
 expect(submissionPayloadSchema.safeParse({...base,consent_map:true,map_area_id:null}).success).toBe(false);
 expect(submissionPayloadSchema.safeParse({...base,consent_map:true,map_area_id:'ridge'}).success).toBe(true);
 expect(submissionPayloadSchema.safeParse(base).success).toBe(true);
});
