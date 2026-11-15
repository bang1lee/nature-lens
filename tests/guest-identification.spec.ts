import {test,expect,type Page} from '@playwright/test';

const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function session(anonymous=true,id=userId){
 const expires=Math.floor(Date.now()/1000)+3600;
 const jwt=`${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,exp:expires})).toString('base64url')}.test`;
 return {access_token:jwt,refresh_token:'refresh',expires_in:3600,expires_at:expires,token_type:'bearer',user:{id,is_anonymous:anonymous,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}};
}
async function photo(page:Page){
 await page.goto('/mobile/');
 await page.getByRole('button',{name:'촬영',exact:true}).click();
 await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
}
async function consent(page:Page){
 await page.getByLabel('인물과 개인정보가 없는 사진이며, 사진을 식별 서비스에 보내 분석하는 데 동의합니다').check();
 await page.getByRole('button',{name:'가입 없이 바로 확인하기'}).click();
}
test('explicit consent starts guest identification once, while saving a recoverable local record',async({page})=>{
 let signups=0,identifications=0,publicWrites=0;
 const guest=session();
 await page.route('https://mock.supabase.co/**',route=>{
  if(new URL(route.request().url()).pathname==='/auth/v1/signup'){signups++;return route.fulfill({json:guest});}
  if(route.request().method()!=='GET')publicWrites++;
  return route.fulfill({json:[]});
 });
 await page.route('**/capabilities',route=>route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}}));
 await page.route('**/identify',route=>{
  identifications++;
  expect(route.request().headers().authorization).toBe(`Bearer ${guest.access_token}`);
  expect(route.request().postDataJSON()).toMatchObject({taxonGroup:'plant',transmissionConsent:true,noPeople:true});
  return route.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'mock',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true}});
 });
 await photo(page);
 expect(signups).toBe(0);expect(identifications).toBe(0);
 await expect(page.getByRole('button',{name:'가입 없이 바로 확인하기'})).toBeDisabled();
 await consent(page);
 await expect(page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'})).toBeVisible();
 expect(signups).toBe(1);expect(identifications).toBe(1);expect(publicWrites).toBe(0);
 const records=await page.evaluate(()=>new Promise<any[]>((resolve,reject)=>{const open=indexedDB.open('nature-lens-v1',2);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('observations'),all=tx.objectStore('observations').getAll();all.onsuccess=()=>resolve(all.result);tx.oncomplete=()=>db.close();};}));
 expect(records).toHaveLength(1);expect(records[0].photo).toMatch(/^data:image/);expect(records[0].aiIdentification.decision.state).toBe('candidates');
});

test('changing the target while connecting requires a new identification action',async({page})=>{
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
 let signups=0,identifications=0;
 await page.route('https://mock.supabase.co/**',route=>{
  if(new URL(route.request().url()).pathname==='/auth/v1/signup'){signups++;return route.fulfill({json:session()});}
  return route.fulfill({json:[]});
 });
 await page.route('**/capabilities',async route=>{await pending;await route.fulfill({json:{groups:['plant','insect'],policyUrl:'https://example.org/privacy'}});});
 await page.route('**/identify',route=>{identifications++;return route.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'mock',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true}});});
 await photo(page);await consent(page);
 await page.getByText('찾을 생물 바꾸기').click();await page.getByLabel('찾을 생물').selectOption('insect');
 release();
 await page.getByLabel('인물과 개인정보가 없는 사진입니다').check();await page.getByLabel('사진 전송과 처리 안내에 동의합니다').check();
 await page.waitForTimeout(500);
 expect(signups).toBe(0);expect(identifications).toBe(0);
 await page.getByRole('button',{name:'이름 후보 찾기',exact:true}).click();
 await expect.poll(()=>identifications).toBe(1);
});

test('a member sign-in during guest creation is kept and used for identification',async({page})=>{
 let release!:()=>void,started!:()=>void;
 const pending=new Promise<void>(resolve=>{release=resolve;}),signupStarted=new Promise<void>(resolve=>{started=resolve;});
 const guest=session(),member=session(false,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
 let bearer='';
 await page.route('https://mock.supabase.co/**',async route=>{
  if(new URL(route.request().url()).pathname==='/auth/v1/signup'){started();await pending;return route.fulfill({json:guest});}
  return route.fulfill({json:[]});
 });
 await page.route('**/capabilities',route=>route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}}));
 await page.route('**/identify',route=>{bearer=route.request().headers().authorization;return route.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'mock',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true}});});
 await photo(page);await consent(page);await signupStarted;
 await page.evaluate(value=>{localStorage.setItem('sb-mock-auth-token',JSON.stringify(value));const channel=new BroadcastChannel('sb-mock-auth-token');channel.postMessage({event:'SIGNED_IN',session:value});channel.close();},member);
 release();
 await expect(page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'})).toBeVisible();
 expect(bearer).toBe(`Bearer ${member.access_token}`);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sb-mock-auth-token')!).user.id)).toBe(member.user.id);
});

test('failed guest setup keeps the photo and retries only on a new click',async({page})=>{
 let signups=0,identifications=0;
 await page.route('https://mock.supabase.co/**',route=>{
  if(new URL(route.request().url()).pathname==='/auth/v1/signup'){
   signups++;
   return signups===1?route.fulfill({status:400,json:{message:'anonymous unavailable'}}):route.fulfill({json:session()});
  }
  return route.fulfill({json:[]});
 });
 await page.route('**/capabilities',route=>route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}}));
 await page.route('**/identify',route=>{identifications++;return route.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'mock',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true}});});
 await photo(page);await consent(page);
 await expect(page.getByText('가입 없이 연결하지 못했어요.',{exact:false})).toBeVisible();
 expect(signups).toBe(1);expect(identifications).toBe(0);
 await expect(page.getByAltText('이름을 확인할 관찰 사진')).toBeVisible();
 await page.getByRole('button',{name:'이름 후보 찾기',exact:true}).click();
 await expect(page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'})).toBeVisible();
 expect(signups).toBe(2);expect(identifications).toBe(1);
});

test('an anonymous identification session does not grant access to member prediction',async({page})=>{
 let discoveries=0;
 await page.route('https://mock.supabase.co/**',route=>new URL(route.request().url()).pathname==='/auth/v1/signup'?route.fulfill({json:session()}):route.fulfill({json:[]}));
 await page.route('**/capabilities',route=>route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'}}));
 await page.route('**/discovery-capabilities',route=>route.fulfill({json:{discovery:true}}));
 await page.route('**/discovery/*',route=>{discoveries++;return route.abort();});
 await page.route('**/identify',route=>route.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'mock',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true}}));
 await photo(page);await consent(page);
 await expect(page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'})).toBeVisible();
 await page.getByRole('radio',{name:/다음날 확인하기/}).click();
 await expect(page.getByLabel('식별 로그인 이메일')).toBeVisible();
 await expect(page.getByLabel('내가 예상한 식물 이름')).toHaveCount(0);
 expect(discoveries).toBe(0);
});
