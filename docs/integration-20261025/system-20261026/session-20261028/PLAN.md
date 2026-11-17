# 로그인 연결 · 2026-10-28

기준 d779641. 사용자: URL 저장 완료, 완료 기준·독립 작업 분담·구현과 검증 요청. 기존 agent-system-engineering 운영 계약을 재사용하며 디자인/모델을 유지한다.

## 완료 기준과 책임
- 주 담당: 실서비스 read-only 설정 대조, 일반/저장기록 PKCE callback, 통합검사, 승인된 Git/Pages 배포.
- 독립 구현: CloudPanel/API에서 인증과 커뮤니티 준비 상태 분리, 대기 종료/메일 재요청 제어, 자체 단위·브라우저 검사.
- 독립 QA: callback 실패·기존 세션·다른 브라우저·사진 보존·출시 경계 검토.
- 통과: PKCE code 교환 한 번, 완료/실패 구분, 원 관찰 ID·사진 보존, 자동사진전송 없음, 서버 schema 오류에도 로그인과 기기저장 가능. build/타입/관련 회귀검사 후 실제 배포화면 확인.
- 실서비스 완료는 별도: 실제 이메일 왕복, 계정 간 DB/RLS 격리, 공급자 실식별까지 각각 검증해야 한다. 모의 응답·Auth settings HTTP200은 이 증거를 대체하지 않는다.

## 현재 확인과 분기
- Supabase UI Site URL과 Redirect URL 모두 https://nature-lens-mvp.pages.dev/mobile/ 저장 확인.
- Auth settings GET200, email enabled. 키 값 기록하지 않음.
- profiles/community_submissions/community_feed에 select+limit=0 요청: 각각404 PGRST205. 기존 storage migration 존재하므로 빈 DB라 가정하거나 전체 migration을 덮어쓰지 않는다.
- 로그인 배포를 먼저 연결하고 커뮤니티 미설정은 명시한다. 실제 이메일 링크 열기는 사용자가 수행한다. 식별 API 키/실제 RLS는 별도 대기.
- initial run + repair 최대2회. 브라우저 인증 도구 차단은 같은 원인 반복 없이 Playwright 모의/수동 확인으로 보완하고 차단을 기록.

## 순서
설정 대조 → [callback 수정 ∥ CloudPanel 수정 ∥ 독립 검수] → 관련 모의/회귀 통합 → 빌드 → 배포 확인 → 사용자 실제 로그인 → DB/RLS 및 식별 제공자 연결.

## 실행 중 발견
- 회귀 initial: 앱 19건 중 18통과, 마지막 카메라 검사는 기능 실행 전 page.goto(load) 30초 제한에 걸림. 실패 snapshot에는 보드가 렌더됨. 코드 변경 없이 해당 검사 1회 재실행하여 1/1 통과(18.1초); 원 실패를 숨기지 않고 초기 log와 retry log를 함께 보존. 정확한 load 지연 원인은 미확정이며 앱 기능 실패로 단정하지 않는다.
- 일반 로그인 PKCE 5개 추가 검사 모두 최초 통과. 기존 세션이 있는 만료 링크도 로그인 성공으로 오인하지 않음.
- expect CLI는 Claude 인증 오류로 차단. 기능/axe는 기존 Playwright 검사로 수행했으며 expect 통과로 표시하지 않는다.
