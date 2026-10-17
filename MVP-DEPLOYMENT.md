# 무료 MVP 연결 · 2026-10-17

프론트 디자인은 유지한다. 첫 공개 범위는 개인 관찰·재관찰·월간 도감이다. 실제 온라인 로그인/식별은 아래 가입과 키 설정 후 활성화한다. Mac 로컬 추론은 공개 사이트나 휴대전화에서 자동 실행되지 않는다.

## 구성과 가입

| 역할 | 선택 | 무료 조건과 제약 | 가입 |
|---|---|---|---|
| 웹 | Cloudflare Pages | 정적 요청 무료, Functions는 별도 Workers 한도 | https://dash.cloudflare.com/ |
| 로그인·DB | Supabase Free | DB500MB, 파일1GB, MAU50,000, 비활성1주 후 일시중지 | https://supabase.com/dashboard/sign-up |
| 식별 서버 | Render Free Web Service | 월750시간, 15분 유휴 시 sleep, 재개 약1분. 영구디스크 없음. 파일럿용 | https://dashboard.render.com/register |
| 식물 식별 | Pl@ntNet Free | 하루500회. 계정 중복으로 한도 우회 금지. 표시/로고 고지 준수 | https://my.plantnet.org/ |

공식 근거: [Cloudflare](https://developers.cloudflare.com/pages/functions/pricing/), [Supabase](https://supabase.com/pricing), [Render](https://render.com/docs/free), [Pl@ntNet](https://my.plantnet.org/pricing), [Pl@ntNet 이용 조건](https://my.plantnet.org/terms_of_use).

무료는 무제한 운영을 뜻하지 않는다. Render는 결제수단 등록 시 일부 초과 사용료가 발생할 수 있으므로 무료 인스턴스와 사용량/지출 제한을 확인한다. 이번 설정은 자동 업그레이드나 유료 서비스 생성을 하지 않는다. Render 무료 Postgres는 30일 만료라 사용하지 않고 Supabase를 사용한다. 로그인 이메일은 Supabase 기본 발송 제한이 있으므로 초기 테스트 후 SMTP·가입 제한을 검토한다.

## 가입 후 연결 순서

1. Supabase Free 프로젝트 생성. SQL Editor에서 `supabase/migrations/20260929000000_community_pilot.sql`, `20261017000000_identification_quota.sql` 순서로 실행. 이미 적용한 migration은 반복하지 않는다.
2. Auth 사이트 URL을 `https://nature-lens-mvp.pages.dev`, Redirect URL을 `https://nature-lens-mvp.pages.dev/mobile/` 등 실제 로그인 복귀 경로로 등록한다. 관리자 검수는 별도 서버 운영이며 일반 사용자가 자신을 전문가로 승인할 수 없다.
3. Pl@ntNet 개발자 계정 생성·이메일 확인 후 API 키 발급. 키는 채팅/코드/브라우저 환경변수에 붙이지 않고 Render의 비밀 환경변수에 입력한다.
4. Render에서 GitHub 저장소의 배포 브랜치를 연결하고 `render.yaml` Blueprint를 선택. **Free** 플랜을 유지한다. `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PLANTNET_API_KEY`를 서버 환경에 등록한다.
5. 기본 `IDENTIFY_ENABLED=false`는 그대로 두고 DB 권한·quota SQL을 먼저 확인한다. 설정 완료 후 true로 변경한다. 서비스가 돌면서 `/health`가200인 것은 프로세스 상태일 뿐 식별/인증/DB 연결 성공 증거는 아니다.
6. 웹 빌드 환경에 아래 **공개 값만** 넣고 재빌드·배포한다. service_role/Pl@ntNet 키는 절대 `NEXT_PUBLIC_`에 넣지 않는다.

```text
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_IDENTIFY_URL=https://YOUR-SERVICE.onrender.com
NEXT_PUBLIC_BASE_PATH=
```

7. 실제 계정 로그인 → 공개 테스트 사진 1장 동의 → 후보 수동 반영 → 초안 저장 → 재관찰. 실패 시 이름 없는 저장을 유지한다. 이 검증 전 실제 온라인 식별 완료로 표시하지 않는다.

## 무료 한도 방어

프로젝트 하루50회·사용자 하루5회, 중복 request ID 거절. Supabase SQL 함수가 전역 트랜잭션 잠금으로 예약을 직렬화하므로 Render 재시작으로 한도가 초기화되지 않는다. 함수는 service_role만 실행 가능하며 일반 회원·익명 사용자는 quota 테이블에 접근하지 못한다. 사진·메모·GPS 없이 사용자/요청UUID·UTC날짜만 보관하며 7일이 지난 기록은 다음 예약 시 정리한다. DB 장애면 제공자를 호출하지 않는다.

이 한도는 이 앱의 사용량이다. 같은 Pl@ntNet 키를 다른 앱에서 쓰면 계정 전체 무료 한도는 별도로 확인해야 한다. 곤충 외부 API는 무료로 활성화하지 않는다. 현재 MVP 외부 연결은 식물만이며 키 없는 곤충 경로는 비활성이다.

Render cold start 때문에 첫 조회가 늦을 수 있다. 서비스가 깨어난 뒤 새로고침하고 재시도한다. keep-alive 우회나 자동 유료 전환은 구성하지 않는다.

## 배포와 복구

```sh
npm ci
npm test
npm run typecheck
npm run build
cd deploy/pages
wrangler pages deploy ../../out --project-name nature-lens-mvp --branch main
```

현재 Next 정적 export를 그대로 사용한다. Pages 업로드 대상은 `out`만이다. `.research`, 평가사진/모델, 비밀키, 로컬 문서·스크린샷·개인 데이터는 업로드하지 않는다. Cloudflare 대시보드의 이전 deployment로 되돌릴 수 있다. 온라인 주소와 localhost는 저장소가 다르므로 기존 로컬 기록은 자동 이동하지 않으며, 필요한 경우 직접 백업·복원한다.

GitHub에는 앱 소스/테스트/배포 설정만 별도 브랜치로 보낸다. 로컬 연구 checkout과 개인 작업 로그는 공유하지 않는다. `test:identify:local`은 별도 로컬 모델이 있을 때만 실행하는 선택적 실험 테스트다. 기본 CI는 모델 바이너리나 개인 사진을 필요로 하지 않는다.

## 완료와 대기

- 준비: 웹 정적 배포, Render 무료 설정, Supabase 영속 호출한도 어댑터/SQL, 기존 Pl@ntNet 연결 재사용, 사진 처리 안내·출처 표기.
- 가입 후 검증 필요: 실제 Supabase SQL 적용·RLS·동시요청, Render 배포·인증, Pl@ntNet 실제 응답과 비용. mock 테스트 성공은 이 항목의 성공을 뜻하지 않는다.
- 다음 단계: 실제 계정으로 식물1장 왕복 확인 → 초기 파일럿5~10명 → 한국 종 품질 평가. 디자인 변경은 사용자 레퍼런스 수신 후 진행.

기존 Worker/D1 배포 설정은 wrangler.jsonc에 보존한다. 신규 Pages는 deploy/pages/wrangler.jsonc를 사용하며 기존 Worker 전송 API는 Pages에서 제공하지 않는다. Render는 비활성 모드라도 Supabase 서버 설정이 있어야 시작한다.
