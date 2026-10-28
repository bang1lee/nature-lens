import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import DecisionResult,{decisionDemos} from '../src/components/mobile/DecisionResult';
import {decisionSchema,fromGatewayResult} from '../src/lib/ai/decision';

describe('identification decision presentation',()=>{
 it('validates all demo states and never offers an apply action in demo mode',()=>{
  for(const decision of Object.values(decisionDemos)){
   expect(decisionSchema.parse(decision)).toEqual(decision);
   const html=renderToStaticMarkup(createElement(DecisionResult,{decision,demo:true,onCandidate:()=>{throw new Error('demo must not apply');}}));
   expect(html).toContain('실제 분석 아님');
   expect(html).toContain('aria-live="polite"');
   expect(html).not.toContain('<button');
  }
 });
 it('shows real gateway candidates as unconfirmed, not calibrated confidence or verified Korean names',()=>{
  const decision=fromGatewayResult({state:'candidates',provider:'plantnet',modelVersion:'test',needsHumanReview:true,candidates:[{scientificName:'Pinus densiflora',commonName:'Japanese red pine',score:.8}]});
  const html=renderToStaticMarkup(createElement(DecisionResult,{decision,onCandidate:()=>{}}));
  expect(html).toContain('한국어 이름 미확인');
  expect(html).toContain('정답 확률이 아니에요');
  expect(html).toContain('미확정 초안에 반영');
  expect(html).toContain('전문가 미검수');
 });
 it('does not allow ancestor, abstain or unavailable decisions to be applied as species names',()=>{
  for(const state of ['ancestor','abstain','unavailable'] as const){
   const html=renderToStaticMarkup(createElement(DecisionResult,{decision:decisionDemos[state],onCandidate:()=>{}}));
   expect(html).not.toContain('<button');
  }
 });
});
