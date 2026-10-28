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
