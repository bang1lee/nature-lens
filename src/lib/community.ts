export { publicLocation, coarsePoint } from './location';
export type Period = 'week' | 'month';
export type Reaction = {storyId: string; actorId: string; at: string};
export function periodStart(period: Period, now: Date): Date {
 const local = new Date(now.getTime() + 9 * 3600_000);
 const date = period === 'month' ? 1 : local.getUTCDate() - ((local.getUTCDay() + 6) % 7);
 return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), date) - 9 * 3600_000);
}
export function rankStories<T extends {id: string}>(stories: T[], reactions: Reaction[], period: Period, now: Date): (T & {count: number})[] {
 const start = periodStart(period, now).getTime(); const end = now.getTime();
 return stories.map(story => ({...story, count: new Set(reactions.filter(r => r.storyId === story.id && Date.parse(r.at) >= start && Date.parse(r.at) <= end).map(r => r.actorId)).size})).sort((a,b) => b.count - a.count || a.id.localeCompare(b.id));
}
export const DEMO_NOW = new Date('2026-09-27T12:00:00+09:00');
export type Story = {id: string; title: string; author: string; group: 'plant' | 'insect' | 'other'; species: string; region: string; date: string; image: string; story: string; care: string};
export const STORIES: Story[] = [
 {id:'flower', title:'한 걸음 늦추니, 꽃이 보였다', author:'느린산책 · 예시', group:'plant', species:'들꽃 · 이름을 알아가는 중', region:'경기 안성', date:'2026-09-23', image:'butterfly.jpg', story:'늘 지나치던 길가에서 작은 꽃을 만났어요. 예쁜 꽃 한 송이를 꺾는 대신, 내일도 이 자리에서 만날 수 있도록 사진만 남겼습니다.', care:'이름을 아는 일보다 먼저, 곁에 있어 주는 일.',},
 {id:'butterfly', title:'작은 손님에게 자리를 내어주다', author:'풀잎친구 · 예시', group:'insect', species:'흰 나비 · 종 미확정', region:'경기 수원', date:'2026-09-25', image:'butterfly.jpg', story:'꽃을 보러 가까이 갔다가 먼저 도착한 나비를 발견했어요. 날아갈까 봐 한 발 물러서서 기다렸습니다. 잠깐의 기다림 덕분에 꽃과 나비를 함께 보았어요.', care:'가까이 보고 싶은 마음만큼, 방해하지 않는 거리도 소중해요.'},
 {id:'moss', title:'비가 그친 뒤에야 보인 작은 숲', author:'초록기록 · 예시', group:'plant', species:'이끼와 어린 잎 · 동정 전', region:'경남 거제', date:'2026-09-12', image:'moss.jpg', story:'비가 그친 뒤 돌 위가 유난히 초록빛이었어요. 잠시 몸을 낮춰보니 작은 잎과 물방울이 하나의 숲처럼 보였습니다. 다음 비가 지나간 뒤에도 다시 찾아보고 싶어요.', care:'크기가 작다고, 살아가는 세계까지 작은 건 아니겠지요.'},
];
export const DEMO_REACTIONS: Reaction[] = STORIES.flatMap((s,i) => [
 ...Array.from({length:[8,12,3][i]},(_,n)=>({storyId:s.id,actorId:`week-${i}-${n}`,at:'2026-09-25T00:00:00Z'})),
 ...Array.from({length:[24,5,19][i]},(_,n)=>({storyId:s.id,actorId:`month-${i}-${n}`,at:'2026-09-15T00:00:00Z'}))
]);
export const GROUP_LABELS = {plant:'식물',insect:'곤충',other:'기타 생명'};
