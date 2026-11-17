# 손님 베타 연결 진행 상태

## 실제 적용
- 사용자 승인 후 Supabase `Allow anonymous sign-ins` 활성화. `anonymous-enabled.png`.
- `20261116000000_member_community_rls.sql` 실제 SQL Editor 실행 성공. profiles/community_submissions의 restrictive 회원 정책을 pg_policies로 확인. `member-policy-applied.png`, `live-policies.txt`.
- 기존 observations/obs-photos에는 과거부터 anon 공개 읽기·쓰기 정책이 있음. 이번에 수정하지 않음. 신규 beta 저장은 별도 소유권·공개 동의 흐름.

## 구현 및 모의 검사
- 4d34bdb: 검증된 손님 토큰의 식별 허용, 예측·점수 차단, 기존 세션당 일5회/프로젝트 일50회 유지.
- ac83fb3: 손님 전용 세션 저장소, 회원 세션 보존, 촬영 후 명시 동의로 식별 시작, 공개 사진 저장·같은 브라우저 복구.
- 담당 에이전트 보고: 식별 브라우저5, 저장 브라우저5, 전체 단위104, 타입검사 통과. 통합 뒤 재검사 예정. 이 결과는 실제 공급자 호출/저장 성공 증거가 아님.
- expect-cli는 Claude 인증 부재로 실패. Playwright/Chrome 검사 사용.

## 통합 및 배포
- 최초 push가 원격 선행 변경으로 거절됨. 원격 d7c6010의3 commits를 별도 worktree에서 보존·병합 중. 강제 push 하지 않음.
- 원격 push 실패 뒤 요청된 Render 배포는 HTTP404. 배포 시작/성공으로 보지 않음. 최종 통합 push 후 새 배포 필요.
- 실제 식별/저장/운영 배포 검증은 아직 미완료.

## 실검사 자료
CC0 민들레 공개 사진만 사용. 출처/라이선스는 FIXTURE.json. 사용자 사진/한국 평가셋/정밀 위치는 전송하지 않음. 공개 기록에는 연결 시험이며 실제 청량산 관찰이 아님을 표시한다.

## 운영 한계
손님 계정을 새로 만들면 계정별 식별 한도는 리셋될 수 있으나 전체50회는 유지한다. 사진 저장은 계정별500개·사진4.5MB 제한만 있어 전체 저장 남용 통제는 아직 충분하지 않다. 기존 legacy 익명 공개 쓰기 경로도 별도 검토 대상이다. 게스트 기록은 다른 기기로 자동 이관/회원 계정 자동 병합하지 않는다.

## 통합 뒤 실제 확인
- 원격3 commits 보존 통합 `ec80183`, 원격 push 성공. 식별 서버 Render `dep-dbsthdtg1s2s7385tcl0` live 확인(commit ec80183).
- 실제 손님 signup200 및 JWT 익명 claim 확인, 회원 profiles 생성403/42501. `live-auth-boundary.json`.
- 배포 서버의 손님 identify는 인증 통과 후 빈 입력400, discovery/list는401. `live-gateway-boundary.json`. 사진 식별 성공 검사가 아닌 인증 경계 검사임.
- 저장 브라우저 테스트 경로 통합 `5b1c5f0`. 별도 worktree5개 모의 검사 통과.

## 실제 식별에서 발견한 원인
- 첫 실제 호출은 HTTP200이지만 not_plant를 반환했다(live-provider.json).
- 공급자 직접 검사에서 HTTP404 본문 `No localization available for ko` 확인. `lang=ko`가 지원되지 않으며 기존 어댑터가 모든404를 not_plant로 오분류했다. 모델교체 없이 지원언어 기본값 사용과 오류구분 수정 중.
- 식별 후보가 오지 않은 첫 호출을 식별 성공으로 계산하지 않는다.

## 최종 확인 · 2026-11-16 01:30 KST

### 실제 적용·배포
- 최종 앱 코드 `48d3abc`, 원격 push 완료. 기존 원격3 commits 보존 병합.
- Render 식별 서버 `e49fc74`, deployment `dep-dbstl6m7bikc73cf6ogg` live.
- Cloudflare Pages 배포 성공: https://da054fe3.nature-lens-mvp.pages.dev / 운영 https://nature-lens-mvp.pages.dev/mobile/.
- `20261116010000_beta_finalize_staging.sql` 실제 적용 성공. 기게시 내용은 불변, 본인 staging 내용과 해시 비교 후 한 트랜잭션에서 갱신·게시. 구버전 직접 state PATCH는 더 이상 허용되지 않음.

### 운영 앱 실검사
- 새 게스트 브라우저에서 명시 동의 후 실제 Pl@ntNet 후보 응답 HTTP200, 클릭부터 결과까지 6036ms. `Common dandelion / Taraxacum sect. Taraxacum`, 점수0.21307. 낮은 후보 점수이며 정답률·확정종 판정이 아님. 한국어 표준명 연결은 미완료.
- 같은 화면에서 공개 동의 후 실제 JPEG 업로드·게시 성공. 서버 객체137397bytes를 독립 다운로드해 SHA-256 일치 확인.
- 같은 게스트 인증을 유지하고 기기 DB가 비어 있는 브라우저 문맥에서 서버 사진 복구 성공. 다른 게스트는 원본 메타데이터0건, 공개 피드에서는 허용된 필드만 확인됨. 이미 게시된 내용 재게시 RPC는 false, 메모 불변 확인.
- 복구한 기록→같은 대상 재관찰→기기 저장 성공. parent/child 연결 확인, 추가 식별·사진 업로드0회. 재관찰 사진은 같은 공개 시험 사진으로 만든 로컬 시연이며 실제 현장 재방문이나 재관찰 서버 업로드 검사는 아님.
- `live-beta.json`, `live-storage-proof.json`, `live-reobservation.json`이 각각 근거.

### 로컬·모의 검사
- root 통합 `npm run verify:local`: 4작업 통과, `npm run build:cloudflare`: 정적 페이지 빌드 통과.
- root 격리SQL19개 통과. 실제 동시 세션 검사가 아닌 PGlite role 시뮬레이션.
- 담당자 모의 브라우저: 게스트7, 공개저장13, 회원4, OTP4, 앱·선택UI20, 카메라4 통과. 회원·예측·점수 회귀는 모의서비스 검사이며 실제 이메일 발송/다음날 공개/점수 지급을 검증한 것은 아님.
- 모바일390px 식별 결과와320px 상세 화면의 가로 넘침 없음, 해당 화면 자동 접근성 검사 위반0. 실제 안드로이드/iOS 카메라·GPS 센서 검사는 미실행.
- 병렬 Next가 공통 next-env.d.ts를 동시에 갱신해 일시적 구문 오류 발생. 개발서버 종료 후 생성파일 복구, root 타입·빌드 재통과. 이후 회귀 작업은 dev서버별 출력뿐 아니라 공통 생성파일 갱신도 직렬화해야 함.
- 실제 재관찰 검사 최초 실패는 보존된 시험 제목을 후보 이름으로 가정한 locator 오류였음. 제목 보존 계약에 맞춰 검사 selector 수정 후 통과. 앱 변경 없음.

### 남은 운영 범위
- 새 게스트 계정 남용과 전체 사진 저장량 상한, 이전 legacy observations/obs-photos 공개 쓰기 경로 점검은 남아 있음. 소규모 베타 기준이며 광범위 모집 전 보강 필요.
- 게스트 기록의 회원 계정 연결·기기 간 이전, 공개 철회 UI, 한국어 표준명 매핑은 미구현. 서버 사진은 공개이며 사용자에게 이 제한을 전송 전에 표시함.
- Render 무료 서비스가 잠든 경우 최초 연결은 이번6036ms보다 길어질 수 있음. 한 장의 결과로 정확도·항상 즉시 응답을 주장하지 않음.
- 사진·평가셋·회원정보를 외부 테스트에 쓰지 않았음. 공개 시험사진과 이름 없는 시험 인증 계정만 사용. 브라우저 인증자료는 git-ignored `.research`에600 권한으로 보관하고 원격전송하지 않음.
- CUA 설정 스크린샷과 실행 로그는 로컬 근거이며 GitHub 커밋에 포함하지 않음. 실제 테스트 식별/사진 한 건은 공유 피드에 시험임을 명시하여 남아 있음.
