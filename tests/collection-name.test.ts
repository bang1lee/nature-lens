import { describe, expect, it } from 'vitest';
import { collectionWriteSchema as collectionSchema, collectionSchema as legacyCollectionSchema } from '../src/lib/domain';
describe('collection name normalization', () => {
 it.each(['', '   ', '\t\n', '\u3000\u00a0'])('rejects blank name %j', name => {
  expect(collectionSchema.safeParse({id:'c1',name}).success).toBe(false);
 });
 it('trims outer Unicode whitespace and keeps internal spaces', () => {
  expect(collectionSchema.parse({id:'c1',name:'\u3000  숲  관찰 \u00a0'}).name).toBe('숲  관찰');
 });
 it('checks 80-character limit after normalization', () => {
  expect(collectionSchema.parse({id:'c1',name:' '+ '가'.repeat(80) +' '}).name).toHaveLength(80);
  expect(collectionSchema.safeParse({id:'c1',name:'가'.repeat(81)}).success).toBe(false);
 });
 it('preserves ID validation and strict object validation', () => {
  expect(collectionSchema.safeParse({id:'',name:'숲'}).success).toBe(false);
  expect(collectionSchema.safeParse({id:'c1',name:'숲',extra:true}).success).toBe(false);
 });
});

it('keeps legacy whitespace-only collections readable for repair', () => {
 expect(legacyCollectionSchema.parse({id:'old',name:'   '}).name).toBe('   ');
});
