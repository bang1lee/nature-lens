# 공개 베타 관찰 흐름 · 2026-11-15

## 승인 범위와 구현
기존 디자인·식별 모델을 유지한다. 새 기록에서 촬영 → 바로 확인하기 / 다음날 확인하기 → 명시적인 서버 공개 저장 → 같은 대상 재관찰을 연결한다. 기존 기기 기록은 자동 전송하지 않는다. 로그인·전송 동의·공개 동의는 각 행동에서 확인한다.

- 선택지는 아이콘+짧은 라벨로 통일. 세부 메모·위치·공개 범위 설명은 펼침 영역에 둔다.
- 사진은 인증 왕복 전 기기에 보존한다. 로그인 자체로 사진을 보내지 않는다.
- 공개 사진/기록 저장, 공개 피드, 동일 계정의 다른 기기 복원을 신규 테이블·버킷으로 분리한다. 기존 observations/obs-photos 및 승인형 지도는 변경하지 않는다.
- 식별/예측 401 재인증 경로와 중복 요청·복구를 검사한다. 예측 점수는 기존 서버 판정만 사용한다.

## 실제 Supabase 적용
`20261115000000_beta_public_observations.sql`을 관리 SQL Editor에서 실행했고 Success를 확인했다. 사전 확인에서 새 테이블/버킷은 없었으며 기존 Storage 정책 두 개 모두 obs-photos 버킷에 한정됐다.
사후 확인: RLS=true, 새 기록 0건, 공개 버킷 JPEG 4,500,000bytes 제한. 공개 view는 id/title/species/observed_on/notes/photo_path/published_at만 제공한다. 원본 obs-photos는 그대로 유지됐다.
실제 익명 REST 요청: 공개 feed HTTP 200(0건), 소유자용 테이블 HTTP 401/42501. 근거 `live-anon-check.json`, `db-applied.png`.

## 로그인 배포 조건
이메일 인증번호 API/UI와 모의 검사는 구현했다. 실제 Supabase 메일 설정은 'Set up custom SMTP to edit templates'이며 기본 메일은 링크만 포함한다. 따라서 `NEXT_PUBLIC_AUTH_OTP_ENABLED`는 켜지 않는다. 기존 이메일 링크 로그인을 유지한다. SMTP 연결 후 Confirm signup와 Magic link 템플릿에 `.Token`을 넣고 실제 신규/기존 계정 검증 후 활성화한다. 확인 없이 인증번호를 받을 수 있다고 안내하지 않는다. 근거 `smtp-required.png`.

## 한계
공개 사진 삭제/철회 UI는 아직 없다. 앱 내 기기 삭제·기존 지도 철회는 베타 사진을 지우지 않는다. 사진은 업로드 시점부터 URL로 공개 접근 가능하다. 정상 앱은 JPEG 재인코딩으로 메타데이터를 제거하지만 직접 API 업로드의 EXIF까지 서버가 강제 제거하지는 않는다. 현재 저장된 공개 버전은 불변이며 수정은 새 기록으로 공개해야 한다. 상세는 ../beta-public-20261115/API-LOCAL.md.
실제 회원의 메일 도착·로그인, 실제 식물 사진의 공급자 식별, 실서버 회원 사진 업로드/다른 기기 복원은 모의 검사 통과와 별개다. 이 작업에서 사용자 사진을 시험 전송하지 않았다.

## 하네스
로컬 DB 모형/SDK·브라우저 모의 검사, 실제 서비스 설정/익명 요청, 배포 결과를 구분한다. expect-cli는 Claude 인증이 없어 실행되지 않는다. 검증 결과와 배포 식별자는 아래에 추가한다.

실제 식별 readiness: /health, /capabilities, /discovery-capabilities 모두 HTTP 200. 식물 지원과 discovery=true를 확인했다. 단, 첫 응답이 32.7–32.9초여서 기존 12초 연결 확인은 너무 짧았다. 사진 없는 readiness 대기만 45초로 늘리고 첫 연결 안내를 축약했다. 이는 식물 사진 분석 성공이나 공급자 정확도 검증이 아니다. 근거 live-readiness.json.

## 배포 전 검증 결과
- `npm run verify:local`: Nx 4/4 통과, 캐시 0/4. 웹·Worker 타입, 경계 검사, 단위 검사.
- 전체 단위 23파일/100건, 격리 PGlite SQL 13건 통과. 실제 Supabase Storage 동작을 대체하지 않는다.
- `beta-photos.playwright.config.ts`: 모의 5/5 통과. 실패→재시도·중복 방지·다른 기기 복구, 인증 중 사진 미전송, 계정 전환 경합, 재관찰 연결, 촬영→식별 후보 적용→공개 저장. 320px 및 axe 검사 포함.
- OTP 모의 4/4, 기존 매직링크 8/8·쿨다운 4/4, 포인트 2/2. 자세한 재현과 시간초과 재실행 내역은 AUTH.md.
- 테스트 데이터는 격리 브라우저/모의 서비스이며 사용자 사진·세션을 테스트에 복제하지 않았다.

## 빌드와 배포 시도
- `npm run deploy:pages`의 Next 정적 빌드 및 오프라인 shell 생성 성공. shell 버전 `143013ee9cb1`.
- 실제 산출물(out)을 localhost:3144로 제공해 격리 Chrome에서 촬영 → 사진 선택 → 바로 확인 → 로그인 경계 → 공개 저장 화면을 확인했다. 외부 쓰기 요청은 모두 차단했고 로컬 시험 이미지는 앱 아이콘을 썼다. `built-capture.png`, `built-login.png`, `built-public-save.png`.
- Cloudflare 업로드는 인증 만료로 실패. `wrangler whoami`도 expired/unrefreshable을 확인했다. 기존 운영 배포를 새 버전 성공으로 보고하지 않는다.
- 배포 권한만 포함한 Wrangler OAuth 재로그인을 시작하고 사용자에게 열린 Cloudflare 창에서 로그인 요청했다. 현재 로그인 입력 대기이며 계정/사용자 읽기·Pages 쓰기 범위다. 로그인 후 이미 빌드한 out을 업로드하고 운영 배포 검사를 이어간다.
