import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {isDeepStrictEqual} from 'node:util';

async function storedRecords(page:Page){
  return page.evaluate(()=>new Promise<Record<string,any>[]>((resolve,reject)=>{
    const request=indexedDB.open('nature-lens-v1',2);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const database=request.result;
      const transaction=database.transaction('observations');
      const read=transaction.objectStore('observations').getAll();
      read.onsuccess=()=>resolve(read.result);
      read.onerror=()=>reject(read.error);
      transaction.oncomplete=()=>database.close();
    };
  }));
}

test('member prepares a captured and identified record, submits it, then reobserves it',async({page})=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width:390,height:844});
  // This is a synthetic session and photo. All non-local services are intercepted.
  await page.addInitScript(()=>{
    const expires=Math.floor(Date.now()/1000)+3600;
    const access_token=`${btoa('{"alg":"none"}')}.${btoa(JSON.stringify({sub:'test-user',exp:expires}))}.test`;
    localStorage.setItem('sb-mock-auth-token',JSON.stringify({access_token,refresh_token:'test',expires_at:expires,expires_in:3600,token_type:'bearer',user:{id:'test-user',aud:'authenticated',role:'authenticated',email:'test@example.org',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}}));
  });
  const requests:{identify:Record<string,unknown>[];submissions:Record<string,unknown>[]}={identify:[],submissions:[]};
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
  await page.route('**/*',async route=>{
    const request=route.request();
    const url=new URL(request.url());
    if(url.hostname==='127.0.0.1'&&url.port==='3113')return route.continue();
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(url.hostname==='127.0.0.1'&&url.port==='8787'){
      if(url.pathname==='/capabilities')return route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'},headers});
      if(url.pathname==='/identify'){
        requests.identify.push(request.postDataJSON());
        return route.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'test',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true},headers});
      }
    }
    if(url.hostname==='mock.supabase.co'){
      if(url.pathname.endsWith('/profiles'))return route.fulfill({json:{alias:'시험별칭'},headers});
      if(url.pathname.endsWith('/map_areas'))return route.fulfill({json:[{id:'test-area',label:'시험 구역'}],headers});
      if(url.pathname.endsWith('/community_submissions')&&request.method()==='POST'){
        requests.submissions.push(request.postDataJSON());
        return route.fulfill({status:201,headers,body:''});
      }
      return route.fulfill({json:[],headers});
    }
    return route.abort();
  });

  await page.goto('/mobile/');
  await page.getByRole('button',{name:'촬영',exact:true}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await page.getByText('기록 더하기',{exact:false}).click();
  await page.getByLabel('한 줄 메모').fill('꽃과 잎을 관찰했어요');
  const find=page.getByRole('button',{name:'가입 없이 바로 확인하기',exact:true});
  await expect(find).toBeDisabled();
  expect(requests.identify).toHaveLength(0);
  await page.getByLabel('인물과 개인정보가 없는 사진이며, 사진을 식별 서비스에 보내 분석하는 데 동의합니다').check();
  await find.click();
  await page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'}).click();
  await expect(page.getByText('AI 후보를 반영한 미확정 기록입니다.')).toBeVisible();
  const [original]=await storedRecords(page);
  expect(original).toMatchObject({species:'민들레',consent:false,noPeople:false,aiAssisted:true});
  expect(requests.identify).toHaveLength(1);
  expect(requests.identify[0]).toMatchObject({taxonGroup:'plant',transmissionConsent:true,noPeople:true});
  expect(requests.identify[0]).not.toHaveProperty('notes');
  await page.getByRole('button',{name:'내 기록 보기',exact:true}).click();
  await page.getByRole('button',{name:'설정',exact:true}).click();

  const cloud=page.locator('.m-cloud');
  await cloud.getByLabel('제출할 내 기록').selectOption({label:'오늘 만난 자연'});
  await cloud.getByLabel('이 기록의 서버 전송·검수·승인 후 공개에 동의합니다').check();
  await cloud.getByLabel('사진에 사람·개인정보가 없음을 확인했습니다').check();
  await cloud.getByRole('button',{name:'선택한 기록 수정',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'관찰 기록 편집'});
  await expect(editor).toBeVisible();
  await expect(editor.getByText('이름 후보는 기록 상세에서 확인하세요.',{exact:false})).toBeVisible();
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(editor.getByLabel('식물 이름')).toHaveValue('민들레');
  await expect(editor.getByLabel('관찰 메모')).toHaveValue('꽃과 잎을 관찰했어요');
  await expect(editor.getByLabel('사진과 기록의 출판 권한·동의를 확인했습니다.')).not.toBeChecked();
  await expect(editor.getByLabel('사진에 인물과 개인정보가 없습니다.')).not.toBeChecked();
  await editor.getByLabel('사진과 기록의 출판 권한·동의를 확인했습니다.').check();
  await editor.getByLabel('사진에 인물과 개인정보가 없습니다.').check();
  await editor.getByRole('button',{name:'초안 저장',exact:true}).click();
  await expect(editor).toHaveCount(0);
  const afterEdit=await storedRecords(page);
  expect(afterEdit).toHaveLength(1);
  expect(afterEdit[0]).toMatchObject({id:original.id,consent:true,noPeople:true,aiAssisted:true,aiIdentification:original.aiIdentification});
  await expect(cloud.getByLabel('제출할 내 기록')).toHaveValue(/.+/);
  await expect(cloud.getByLabel('이 기록의 서버 전송·검수·승인 후 공개에 동의합니다')).not.toBeChecked();
  await expect(cloud.getByLabel('사진에 사람·개인정보가 없음을 확인했습니다')).not.toBeChecked();
  await cloud.getByLabel('공개 구역').selectOption('test-area');
  await cloud.getByLabel('선택한 구역의 대표 지점에 이 기록을 공개하는 데 동의합니다').check();
  await cloud.getByLabel('이 기록의 서버 전송·검수·승인 후 공개에 동의합니다').check();
  await cloud.getByLabel('사진에 사람·개인정보가 없음을 확인했습니다').check();
  await cloud.getByRole('button',{name:'검수 대기열에 제출',exact:true}).click();
  await expect(cloud.getByRole('status')).toContainText('검수 대기열에 제출했어요');
  expect(requests.submissions).toHaveLength(1);
  expect(requests.submissions[0]).toMatchObject({species:'민들레',notes:'꽃과 잎을 관찰했어요',consent_upload:true,no_people:true,map_area_id:'test-area',consent_map:true,protection:'unknown'});
  expect(requests.submissions[0]).not.toHaveProperty('publicGrid');

  await page.getByRole('button',{name:'내 기록',exact:true}).click();
  await page.getByRole('button',{name:'오늘 만난 자연 기록 열기'}).click();
  await page.getByRole('button',{name:'같은 대상 다시 관찰하기'}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await page.getByLabel('지난번과 같은 개체를 관찰했습니다').check();
  await page.getByText('기록 더하기',{exact:false}).click();
  await page.getByLabel('한 줄 메모').fill('다시 만난 꽃');
  await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
  await page.getByRole('button',{name:'내 기록 보기'}).click();
  await expect(page.locator('.m-specimen')).toContainText('이 기기에 남긴 관찰 2회');
  const afterReobservation=await storedRecords(page);
  expect(afterReobservation).toHaveLength(2);
  const repeated=afterReobservation.find(record=>record.id!==original.id)!;
  expect(repeated).toMatchObject({specimenId:original.id,previousObservationId:original.id,notes:'다시 만난 꽃',consent:false,noPeople:false});
  await page.getByRole('button',{name:'기록 수정 및 공개 준비',exact:true}).click();
  const reobserveEditor=page.getByRole('dialog',{name:'관찰 기록 편집'});
  await reobserveEditor.getByLabel('관찰 메모').fill('다시 만난 꽃의 변화');
  await reobserveEditor.getByRole('button',{name:'초안 저장',exact:true}).click();
  const editedReobservation=await storedRecords(page);
  expect(editedReobservation).toHaveLength(2);
  expect(editedReobservation.find(record=>record.id===repeated.id)).toMatchObject({specimenId:original.id,previousObservationId:original.id,notes:'다시 만난 꽃의 변화',consent:false,noPeople:false});
  await page.reload();
  await page.getByRole('button',{name:'저널',exact:true}).click();
  await expect(page.locator('.m-personal-month')).toContainText('2개의 기록 · 1개의 관찰 대상 · 1번의 재관찰');
  expect(requests.submissions).toHaveLength(1);
});

test('a conflicting edit keeps the dialog and typed memo intact',async({page})=>{
  await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:3113'?route.continue():route.abort());
  await page.goto('/mobile/');
  await page.getByRole('button',{name:'촬영',exact:true}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
  await page.getByRole('button',{name:'내 기록 보기'}).click();
  await page.getByRole('button',{name:'기록 수정 및 공개 준비',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'관찰 기록 편집'});
  await editor.getByLabel('관찰 메모').fill('아직 저장하지 않은 메모');
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const request=indexedDB.open('nature-lens-v1',2);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const database=request.result;
      const transaction=database.transaction('observations','readwrite');
      const store=transaction.objectStore('observations');
      const read=store.getAll();
      read.onsuccess=()=>store.put({...read.result[0],updatedAt:'2099-01-01T00:00:00.000Z'});
      transaction.oncomplete=()=>{database.close();resolve();};
      transaction.onerror=()=>reject(transaction.error);
    };
  }));
  await editor.getByRole('button',{name:'초안 저장',exact:true}).click();
  await expect(editor.getByRole('alert')).toContainText('다른 창에서 이 기록이 변경되거나 삭제되었습니다.');
  await expect(editor.getByLabel('관찰 메모')).toHaveValue('아직 저장하지 않은 메모');
  expect(await storedRecords(page)).toHaveLength(1);
  expect((await storedRecords(page))[0].notes).toBe('');
});

test('slow identification readiness permits retry without losing the local photo',async({page})=>{
  test.setTimeout(45_000);
  await page.clock.install();
  await page.addInitScript(()=>{
    const expires=Math.floor(Date.now()/1000)+3600;
    const access_token=`${btoa('{"alg":"none"}')}.${btoa(JSON.stringify({sub:'test-user',exp:expires}))}.test`;
    localStorage.setItem('sb-mock-auth-token',JSON.stringify({access_token,refresh_token:'test',expires_at:expires,expires_in:3600,token_type:'bearer',user:{id:'test-user',aud:'authenticated',role:'authenticated',email:'test@example.org',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}}));
  });
  let ready=false,identificationRequests=0,release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'&&url.port==='3113')return route.continue();
    if(url.pathname==='/capabilities'){
      if(!ready)await held;
      return route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'},headers:{'access-control-allow-origin':'*'}}).catch(()=>{});
    }
    if(url.pathname==='/identify')identificationRequests++;
    if(url.hostname==='mock.supabase.co')return route.fulfill({json:[],headers:{'access-control-allow-origin':'*'}});
    return route.abort();
  });
  await page.goto('/mobile/');
  await page.getByRole('button',{name:'촬영',exact:true}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await page.getByRole('button',{name:'내 기록에 저장',exact:true}).click();
  await page.getByRole('button',{name:'내 기록 보기'}).click();
  await expect(page.getByText('서버 연결 중…',{exact:false})).toBeVisible();
  await page.clock.fastForward(46_000);
  await expect(page.getByText('서버 응답이 늦어 연결 확인을 멈췄어요.',{exact:false})).toBeVisible();
  ready=true;
  await page.getByRole('button',{name:'식별 연결 다시 확인'}).click();
  await expect(page.getByLabel('사진 전송과 처리 안내에 동의합니다')).toBeVisible();
  release();
  expect(identificationRequests).toBe(0);
  const records=await storedRecords(page);
  expect(records).toHaveLength(1);
  expect(records[0].photo).toMatch(/^data:image/);
});

test('identified member photo can be publicly saved after separate consent and retry',async({page})=>{
  test.setTimeout(60_000);
  await page.setViewportSize({width:390,height:844});
  const memberId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await page.addInitScript(id=>{
    const expires=Math.floor(Date.now()/1000)+3600;
    const access_token=`${btoa('{"alg":"none"}')}.${btoa(JSON.stringify({sub:id,exp:expires}))}.test`;
    localStorage.setItem('sb-mock-auth-token',JSON.stringify({access_token,refresh_token:'test',expires_at:expires,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',email:'test@example.org',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}}));
  },memberId);
  const rows:Record<string,any>[]=[],posted:Record<string,any>[]=[],finalizations:Record<string,any>[]=[];
  let uploads=0,publishedReads=0;
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    if(url.hostname==='127.0.0.1'&&url.port==='3113')return route.continue();
    if(method==='OPTIONS')return route.fulfill({status:204,headers});
    if(url.hostname==='127.0.0.1'&&url.port==='8787'){
      if(url.pathname==='/capabilities')return route.fulfill({json:{groups:['plant'],policyUrl:'https://example.org/privacy'},headers});
      if(url.pathname==='/identify')return route.fulfill({json:{state:'candidates',provider:'plantnet',modelVersion:'test',candidates:[{scientificName:'Taraxacum officinale',commonName:'민들레',score:.95}],needsHumanReview:true},headers});
    }
    if(url.hostname!=='mock.supabase.co')return route.abort();
    if(url.pathname==='/auth/v1/user')return route.fulfill({json:{id:memberId,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'},headers});
    if(url.pathname==='/rest/v1/rpc/finalize_beta_public_observation'&&method==='POST'){
      const body=request.postDataJSON();finalizations.push(body);
      const row=rows.find(item=>item.owner_id===memberId&&item.id===body.p_id&&item.state==='staging'&&item.photo_sha256===body.p_photo_sha256&&isDeepStrictEqual(item.record,body.p_expected_record));
      if(row){row.record=body.p_new_record;row.state='published';row.published_at=new Date().toISOString();}
      return route.fulfill({json:Boolean(row),headers});
    }
    if(url.pathname==='/rest/v1/beta_public_observations'){
      if(method==='POST'){
        const body=request.postDataJSON();posted.push(body);
        const row={...body,owner_id:memberId,state:'staging',published_at:null};rows.push(row);
        return route.fulfill({status:201,json:row,headers});
      }
      const filtered=rows.filter(row=>(!url.searchParams.has('local_id')||row.local_id===url.searchParams.get('local_id')?.replace('eq.',''))&&(!url.searchParams.has('id')||row.id===url.searchParams.get('id')?.replace('eq.','')));
      if(method==='PATCH')return route.fulfill({status:405,json:{message:'use finalization RPC'},headers});
      if(method==='GET'&&filtered.some(row=>row.state==='published'))publishedReads++;
      return route.fulfill({json:filtered,headers});
    }
    if(url.pathname.startsWith('/storage/v1/object/')){
      if(method==='POST'){uploads++;return uploads===1?route.fulfill({status:503,json:{message:'unavailable'},headers}):route.fulfill({json:{Key:'saved'},headers});}
      return route.fulfill({status:404,json:{message:'missing'},headers});
    }
    return route.fulfill({json:[],headers});
  });
  await page.goto('/mobile/');await page.getByRole('button',{name:'촬영',exact:true}).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles('public/icon-192.png');
  await page.getByText('기록 더하기',{exact:false}).click();await page.getByLabel('한 줄 메모').fill('노란 꽃을 봤어요');
  await page.getByLabel('인물과 개인정보가 없는 사진이며, 사진을 식별 서비스에 보내 분석하는 데 동의합니다').check();
  await page.getByRole('button',{name:'가입 없이 바로 확인하기'}).click();
  const kept=page.getByRole('img',{name:'방금 담은 자연 사진'});await expect(kept).toBeVisible();
  await page.getByRole('button',{name:'민들레 이름을 미확정 초안에 반영'}).click();
  const panel=page.getByLabel('공개 베타 사진 저장');
  await expect(panel.getByText('사진과 기록이 누구에게나 공개돼요.',{exact:false})).toBeVisible();
  const publish=panel.getByRole('button',{name:'공개로 저장'});await expect(publish).toBeDisabled();
  await panel.getByLabel('이 사진과 기록을 공개 베타에 저장하는 데 동의해요').check();await expect(publish).toBeDisabled();
  await panel.getByLabel('사진에 사람이나 개인 정보가 없어요').check();
  expect((await new AxeBuilder({page}).include('.beta-publish').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
  await publish.click();await expect(panel.getByRole('alert')).toBeVisible();await expect(kept).toBeVisible();
  expect(posted).toHaveLength(1);expect(posted[0].record).toMatchObject({species:'민들레',notes:'노란 꽃을 봤어요',aiAssisted:true});
  await publish.click();await expect(panel.getByRole('status')).toContainText('공개 베타에 저장했어요');
  expect(posted).toHaveLength(1);expect(rows).toHaveLength(1);expect(uploads).toBe(2);
  expect(finalizations).toHaveLength(1);expect(finalizations[0]).toMatchObject({p_id:rows[0].id,p_photo_sha256:rows[0].photo_sha256,p_expected_record:posted[0].record,p_new_record:posted[0].record});
  expect(rows[0].state).toBe('published');expect(publishedReads).toBeGreaterThan(0);
  await page.getByRole('button',{name:'내 기록 보기',exact:true}).click();
  await expect(page.getByRole('button',{name:'같은 대상 다시 관찰하기',exact:true})).toBeVisible();
});
