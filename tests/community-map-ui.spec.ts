import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';
test.beforeEach(async({page})=>{await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')}));});
const examplePhoto='data:image/jpeg;base64,'+readFileSync('public/community/moss.jpg').toString('base64');

test('synthetic map records, same-area detail and withdrawal refresh',async({page})=>{
 let order='';let rows=[{id:'11111111-1111-4111-8111-111111111111',area_id:'test-area',area_label:'시험 구역',latitude:37.013,longitude:127.334},{id:'22222222-2222-4222-8222-222222222222',area_id:'test-area',area_label:'시험 구역',latitude:37.013,longitude:127.334}];
 await page.route('https://mock.supabase.co/**',async route=>{const url=route.request().url();if(url.includes('community_map_points')){order=new URL(url).searchParams.get('order')??'';return route.fulfill({json:rows,headers:{'access-control-allow-origin':'*'}});}if(url.includes('community_feed'))return route.fulfill({json:{id:rows[0]?.id,title:'합성 민들레',species:'민들레',scientific_name:'',observed_on:'2026-10-01',notes:'시험 기록',taxon_group:'plant',region:null,photo:examplePhoto,author_alias:'시험',approved_at:'2026-10-01T00:00:00Z'},headers:{'access-control-allow-origin':'*'}});return route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}});});
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile/');await page.getByRole('button',{name:'지도 열기'}).click();
 await expect(page.getByRole('heading',{name:'함께 발견한 자연'})).toBeVisible();await expect(page.getByRole('button',{name:'시험 구역 · 2개'})).toBeVisible();
 expect(order).toBe('approved_at.desc,id.asc');await expect(page.locator('.maplibregl-ctrl-attrib a[href="https://www.openstreetmap.org/copyright"]')).toBeAttached();await expect(page.locator('.community-map-canvas')).toHaveAttribute('data-map-rendered-points',/^[1-9]/,{timeout:20000});await page.locator('.community-map-canvas canvas').click({position:{x:175,y:165}});await expect(page.getByRole('heading',{name:'시험 구역의 기록 2개'})).toBeVisible();await expect(page.getByText('모두 같은 대표 지점에 표시됩니다.')).toBeVisible();await page.getByRole('button',{name:'공개 기록 1 보기'}).click();await expect(page.getByRole('heading',{name:'합성 민들레'})).toBeVisible();
 await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:'/tmp/nature-lens-community-map-records.png',fullPage:true});
 rows=[];await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('heading',{name:'합성 민들레'})).toHaveCount(0);await expect(page.getByText('아직 지도에 공개된 기록이 없어요.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations;expect(violations).toEqual([]);
 await page.locator('.community-map-canvas').screenshot({path:'/tmp/nature-lens-cheongnyangsan-map.png'});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:'/tmp/nature-lens-community-map.png',fullPage:true});
});


test('late detail replies cannot reopen a previously selected record and failed refresh hides stale data',async({page})=>{
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];let fail=false;let release!:()=>void;const wait=new Promise<void>(r=>release=r);
 const rows=ids.map(id=>({id,area_id:'test-area',area_label:'시험 구역',latitude:37.013,longitude:127.334}));
 await page.route('https://mock.supabase.co/**',async route=>{const url=new URL(route.request().url());const headers={'access-control-allow-origin':'*'};if(url.pathname.includes('community_map_points'))return fail?route.fulfill({status:400,headers,body:'unavailable'}):route.fulfill({json:rows,headers});if(url.pathname.includes('community_feed')){const id=url.searchParams.get('id')?.replace('eq.','')??ids[0];if(id===ids[0])await wait;return route.fulfill({json:{id,title:id===ids[0]?'늦게 온 기록':'선택한 기록',species:'꽃',scientific_name:'',observed_on:'2026-10-01',notes:'시험',taxon_group:'plant',region:null,photo:'data:image/png;base64,YQ==',author_alias:'시험',approved_at:'2026-10-01T00:00:00Z'},headers});}return route.fulfill({json:[],headers});});
 await page.goto('/mobile/');await page.getByRole('button',{name:'지도 열기'}).click();await page.getByRole('button',{name:'시험 구역 · 2개'}).click();await page.getByRole('button',{name:'공개 기록 1 보기'}).click();await page.getByRole('button',{name:'공개 기록 2 보기'}).click();await expect(page.getByRole('heading',{name:'선택한 기록'})).toBeVisible();release();await page.waitForTimeout(300);await expect(page.getByRole('heading',{name:'늦게 온 기록'})).toHaveCount(0);
 fail=true;await page.getByRole('button',{name:'지도 기록 새로고침'}).click();await expect(page.getByText('지도 기록을 불러올 수 없어요.',{exact:false})).toBeVisible();await expect(page.getByRole('heading',{name:'선택한 기록'})).toHaveCount(0);await expect(page.getByRole('button',{name:'시험 구역 · 2개'})).toHaveCount(0);
});


test('a cluster containing distinct public areas zooms in',async({page})=>{
 const rows=[{id:'11111111-1111-4111-8111-111111111111',area_id:'a',area_label:'구역 A',latitude:37.013,longitude:127.334},{id:'22222222-2222-4222-8222-222222222222',area_id:'b',area_label:'구역 B',latitude:37.014,longitude:127.335}];
 await page.route('https://mock.supabase.co/**',async route=>route.fulfill({json:route.request().url().includes('community_map_points')?rows:[],headers:{'access-control-allow-origin':'*'}}));
 await page.setViewportSize({width:390,height:844});await page.goto('/mobile/');await page.getByRole('button',{name:'지도 열기'}).click();const map=page.locator('.community-map-canvas');await expect(map).toHaveAttribute('data-map-rendered-points',/^[1-9]/,{timeout:20000});const before=Number(await map.getAttribute('data-map-zoom'));await map.locator('canvas').click({position:{x:175,y:165}});await expect.poll(async()=>Number(await map.getAttribute('data-map-zoom')),{timeout:10000}).toBeGreaterThan(before);
});
