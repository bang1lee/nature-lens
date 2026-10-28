# 실제 로그인·공동 관찰 연결 · 2026-10-29

## 이번 완료
- 사용자 이메일 로그인 완료 후 Aside에서 로그인 표시를 확인하고 한 차례 새로고침 후 유지 확인. Codex IAB 앱은 별도 브라우저라 로그인 전이며 세션을 복사하지 않았다.
- 사용자 승인 직전 Supabase SQL metadata SELECT에서 public 스키마는 observations 하나, 공동 관찰/식별 관련 두 함수는 없음을 확인. 기존 observations는 12개 열을 가진 별도 구조이며 보존했다. 사용자 행·키·토큰은 조회하지 않았다.
- 사용자가 공동 관찰 저장 구조/접근 권한 적용을 명시 승인했다. 기존 supabase/migrations/20260929000000_community_pilot.sql을 단일 트랜잭션으로 실행하고 Success 확인. 원격 migration 이력 테이블에는 등록하지 않았으므로 나중에 CLI 연결 시 이력을 정합화해야 한다. CREATE 파일을 재실행하지 않는다.
- 적용 파일 SHA256: f413aa1e293717f2c4478aeac428daa21bf7e7926908deb9c0cb304cc8c8675c.
- 원격 metadata: profiles/community_submissions의 RLS=true와 5개 소유자 정책 확인. 기존 observations도 RLS=true로 남아 있다.
- Aside에서 연결 재확인 후 경고 소멸, 로그인 유지, 별칭 입력/제출 폼/내 제출 빈 목록/승인 피드 빈 상태 확인. community-ready.webp. 임의 별칭 생성, 사진 전송, 실제 기록 승인·삭제 없음.
- 공개 REST 조회는 community_feed=200(빈 배열), profiles/community_submissions=401/42501(익명 접근 거절). rest-readiness.json. limit=0이므로 전체 데이터 개수 증거는 아니며 UI의 빈 피드와 구분한다.

## 로컬 검증과 한계
- verify-community-db.mjs + local-db-check.log: PGlite 0.5.13의 메모리 PostgreSQL에서 12/12 통과. 실제 migration을 읽어 적용했고 소유자 읽기, 타인 조회/철회 거절, 브라우저 승인 금지, 승인 전 공개 제외, 승인 후 공개/철회, 기존 observations 보존을 검사했다.
- auth.users/auth.uid와 역할만 모사한 SQL 검증. 실제 Supabase JWT·두 실계정 간 격리·실제 사진 바이트·동시 요청 검증이 아니다. 기존 pgTAP 검사 자체를 실행했다고 주장하지 않는다.
- 재실행: 임시 폴더에 npm install --prefix /tmp/nature-lens-db-check-20261029 --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.5.13 후 앱 루트에서 node docs/integration-20261025/system-20261026/session-20261029/verify-community-db.mjs /tmp/nature-lens-db-check-20261029/node_modules/@electric-sql/pglite/dist/index.js.
- 이전 앱 변경 854b3e6의 GitHub CI run 40542221940 success 확인. https://github.com/bang1lee/nature-lens/actions/runs/40542221940
- 이번에는 서버 구조만 연결하고 기존 앱 디자인/모델/배포 파일은 변경하지 않았다. 배포는 이전 https://15fcf1b9.nature-lens-mvp.pages.dev 유지.

## 다음 행동과 작업 순서
1. 사용자가 Aside 설정의 공개 별칭(2–20자)을 선택해 저장. 키/비밀번호 추가 입력은 필요 없음.
2. 별칭 저장 실응답 확인 → 사용자가 선택·동의한 자료로 검수 대기 제출/철회 검증. 사진 전송을 자동 수행하지 않는다.
3. 실제 식별은 공급자 키·식별 서버·서버 전용 할당량 migration 연결이 별도 남음. 로그인 성공을 식별 성공으로 간주하지 않는다.
4. 사진/재관찰은 여전히 기기 보관. 이번 연결은 개별 동의한 공동 관찰 제출이며 개인 클라우드 자동 동기화가 아니다.
5. 일반 사용자 공개 전에 SMTP/발송 한도와 두 계정 RLS를 확인한다. 개인 로그인 성공으로 기본 메일 제한이 없어진 것은 아니다.

참고: https://pglite.dev/docs/ · https://supabase.com/docs/guides/database/postgres/row-level-security

## 별칭 저장 후 확인
- 사용자 별칭 저장 후 Aside에서 입력 폼 대신 저장된 별칭이 표시되고, 한 차례 새로고침 후에도 로그인·별칭 유지 확인. 별칭/이메일 값은 기록하지 않았다. 제출 오류 없음. 기록 미선택 상태라 제출 버튼 비활성은 정상이다.
- 다음 사용자 설정은 기존 어댑터의 Pl@ntNet 개발자 계정 가입: https://my.plantnet.org/signup . 2026-10-29 공식 가격 https://my.plantnet.org/pricing 에서 무료 일500회 확인. API키 채팅 전달 없이 다음 단계에서 서버에만 설정한다. 실제 사진 제출/철회와 식별 공급자 실응답은 아직 미검증.

## 식별 키 로컬 입력 완료
- 사용자 재발급 키를 로컬 비밀번호 입력창으로 저장 완료. 값은 출력하지 않고 존재 여부, 파일 권한0600, Git ignore를 확인했다. 공급자 인증/식별 실응답 검증은 아직 아니다.
- Render 로그인 화면을 열어 다음 사용자 행동은 가입·로그인 하나로 안내했다. 아직 서비스 생성/키 전송/배포는 수행하지 않았다.

## Render 인증 확인
- Render 관리 키 저장 존재/0600/Git ignore 확인. owners/services read-only API 각각200. 현재 서비스0개; 유료 생성/외부 키 업로드 없음.
- 현 server/supabase-quota.mjs는 서버 전용 Supabase 키를 요구하므로 사용자에게 service_role 로컬 입력창 안내. 원격 할당량 migration 미적용, 식별 서버 미배포, 실제 식별 미검증 상태 유지.

## 식별 서버 및 공개 앱 연결 완료
- service_role 키의 역할/대상 프로젝트 일치 확인. 키 값은 기록하지 않았다. 서버의 키는 Render 환경 설정으로 전달했고, Render 관리 키는 로컬에만 유지했다.
- 무료 web_service srv-dbh3hou1egvs739c70pg, Singapore, https://nature-lens-identify.onrender.com . repo bang1lee/nature-lens, branch codex/cloudflare-mvp-20261017, autoDeployTrigger=off, Node22.22.2. 생성201 후 첫 배포와 활성화 배포 모두 live. render-create.json/render-enable.json.
- 기존 identification_quota.sql을 begin/commit으로 감싸 Supabase SQL Editor에 적용. migration 이력 별도 정합화 필요. 횟수 데이터만 저장하며 기존 관찰/사진은 변경하지 않았다.
- 로컬 SQL 검사6개 통과: 사용자5회/프로젝트50회/중복/익명 함수·테이블 거절. 실제 동시성·실계정 소진 테스트는 아니다. quota-sql-check.log.
- 실제 RPC에 null 입력으로 쓰기 없는 검사: service_role은 invalid_request(P0001), 익명은42501 거절. 테이블 metadata 조회200.
- 실제 gateway /health200, 허용 origin /capabilities200 groups=[plant], 로그인 없는 /identify401, 다른 origin403 확인. 사진 전송0건. 공급자 API 키 유효성/실제 동정 성공은 아직 미검증.
- .env.local의 NEXT_PUBLIC_IDENTIFY_URL을 서버 주소로 설정한 뒤 Cloudflare 빌드·타입검사 통과. out의82개 파일에서 Pl@ntNet/service_role/Render관리키 원문 미포함 확인. 최초 검사 명령은 작업 디렉터리 오류로 실행되지 않아 앱 루트에서 즉시 재검사했다.
- 공개 앱 배포 성공: https://40440f40.nature-lens-mvp.pages.dev (main alias https://nature-lens-mvp.pages.dev). 소스5747bd6, 서버 URL 빌드 환경 반영. 디자인·모델 변경 없음.
- 다음: 사용자가 로그인한 Aside에서 새로고침 후 식물 사진을 골라 ‘저장 전에 사진에서 이름 찾기’를 펼치고 개인정보 없음/전송 동의를 확인해 식별 요청. 실제 결과·저장·동일 개체 재관찰을 이어 검증한다.
- 한계: Render 무료 서버는 유휴 후 시작에 시간이 걸린다. 앱의 연결 확인12초보다 길 수 있어 ‘식별 연결 다시 확인’이 필요할 수 있다. 곤충 공급자는 미연결이다.
