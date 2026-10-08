import { z } from 'zod';
import { publicGridSchema, regionLabelSchema } from './location';
const text = (max:number) => z.string().max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;},'올바른 관찰일을 입력해 주세요.');
export const collectionSchema=z.object({id:text(100).min(1),name:text(80).min(1)}).strict();
// Validate new edits without making legacy backups or stored collections unreadable.
export const collectionWriteSchema=collectionSchema.extend({name:z.string().trim().min(1,'컬렉션 이름을 입력해 주세요.').max(80)});
export const observationSchema=z.object({
 taxonGroup:z.enum(['plant','insect','other']).optional(),region:regionLabelSchema.optional(),publicGrid:publicGridSchema.optional(),
 id:text(100).min(1),title:text(120).min(1),species:text(100),scientificName:text(140),date,
 notes:text(4000),habitat:text(150),protection:z.enum(['unknown','protected','common']),
 consent:z.boolean(),noPeople:z.boolean(),aiAssisted:z.boolean(),status:z.enum(['draft','reviewed']),
 sessionId:text(100).nullable(),photo:z.string().max(6_000_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),demo:z.boolean(),updatedAt:z.iso.datetime(),
}).strict();
export type Observation=z.infer<typeof observationSchema>;
export type Collection=z.infer<typeof collectionSchema>;
const backupSchema=z.object({version:z.literal(1),observations:z.array(observationSchema).max(500),collections:z.array(collectionSchema).max(100)}).strict();
export type Backup=z.infer<typeof backupSchema>;
export function containsForbiddenClaim(text:string):boolean{
 return /식용|약용|먹을|먹어|섭취|복용|효능|치료|독성없|edible|medicinal|cures?/i.test(text.normalize('NFKC').replace(/[\s\p{Cf}\p{P}]/gu,''));
}
export function publicationIssues(o:Pick<Observation,'title'|'species'|'scientificName'|'notes'|'habitat'|'consent'|'noPeople'>):string[]{
 const issues:string[]=[];
 if(!o.species.trim()) issues.push('생물 이름을 확인해 주세요.');
 if(!o.notes.trim()) issues.push('관찰 메모를 작성해 주세요.');
 if(!o.consent) issues.push('사진과 기록의 출판 동의를 확인해 주세요.');
 if(!o.noPeople) issues.push('인물이 없는 사진인지 확인해 주세요.');
 if(containsForbiddenClaim([o.title,o.species,o.scientificName,o.notes,o.habitat].join(' '))) issues.push('식용·약용·효능 정보는 출판할 수 없습니다. 해당 내용을 삭제해 주세요.');
 return issues;
}
export function canPublish(o:Observation){return o.status==='reviewed'&&publicationIssues(o).length===0;}
export function parseBackup(raw:string):Backup{
 if(raw.length>50*1024*1024) throw new Error('백업 파일은 50MB 이하여야 합니다.');
 const parsed=backupSchema.parse(JSON.parse(raw));
 if(new Set(parsed.observations.map(o=>o.id)).size!==parsed.observations.length || new Set(parsed.collections.map(c=>c.id)).size!==parsed.collections.length) throw new Error('중복 ID가 있는 백업입니다.');
 const collectionIds=new Set(parsed.collections.map(c=>c.id));
 if(parsed.observations.some(o=>o.sessionId!==null&&!collectionIds.has(o.sessionId))) throw new Error('컬렉션 정보가 누락된 백업입니다.');
 return {...parsed,observations:parsed.observations.map(o=>({...o,status:'draft'}))};
}
export function newObservation():Observation{return {id:crypto.randomUUID(),title:'',species:'',scientificName:'',date:new Date().toLocaleDateString('en-CA'),notes:'',habitat:'',protection:'unknown',consent:false,noPeople:false,aiAssisted:false,status:'draft',sessionId:null,photo:'',demo:false,updatedAt:new Date().toISOString()};}
export function assertLibraryCapacity(data:{observations:Observation[];collections:Collection[]}){
 if(data.observations.length>500||data.collections.length>100||new TextEncoder().encode(JSON.stringify({version:1,...data})).byteLength>45*1024*1024) throw new Error('작업실 한도(45MB·500건·100컬렉션)에 도달했습니다. 전체 백업 후 필요 없는 기록을 정리해 주세요.');
}
