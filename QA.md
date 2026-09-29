# MVP 검증 기록 · 2026-09-29

- 도메인·저장 테스트 9개: 출판 동의·인물 확인, 금지어, 손상/외부URL 백업, 중복 ID, 검수 초기화, 동일 기록의 오래된 탭 저장 거절, 삭제 기록 부활 거절, 복원 가능한 용량/수량 한도.
- Playwright 브라우저 흐름 4개: 관찰 검수·수정 무효화·새로고침 보존·인쇄 화면, 실제 이미지 입력·컬렉션·검색·Escape 초점 복귀·390px 모바일, 1440px 화면, 백업의 새 브라우저 복원 및 중복 복원.
- axe WCAG A/AA 검사: 데스크톱 관찰실과 모바일 관찰실. 첫 검사에서 대비 부족 발견 후 수정, 재검사 0건. 전체 사이트의 공식 접근성 인증은 아님.
- 정적 production `/nature-lens/` 경로: 첫 방문 캐시, 네트워크 차단 후 재로딩, 오프라인 검수, PDF 렌더링 및 표지+관찰 2페이지 확인.
- TypeScript, production build, npm audit 확인. 외부 API·RLS는 미구현이므로 검증 완료로 주장하지 않음.
- expect-cli v0.0.19: 3분 시간 초과로 결과 없음. 위의 재현 가능한 Playwright/axe 검사를 별도로 실행함.

## 독립 검수 후 수정
1. 탭 A의 오래된 편집 내용이 탭 B의 동의 철회를 덮어쓰는 문제: IndexedDB 트랜잭션에서 원본 updatedAt 비교, 충돌 거절. 회귀 테스트 실패 확인 후 통과.
2. 내보내기는 가능하지만 복원이 불가능한 큰 백업: 모든 저장/복원에 45MB·500관찰·100컬렉션 한도 적용. 회귀 테스트 실패 확인 후 통과.
3. PDF 마지막 빈 페이지: 마지막 관찰의 강제 다음 페이지 및 화면 최소 높이 제거. 페이지 수 회귀 검사.

## 남은 운영 검증
실제 이용자 10명/관찰 100건, 동의 증빙 확인, 종 정확도 50장 테스트, 클라우드 보안·RLS, 실제 캠프 운영은 아직 실시하지 않았다.

## 모바일 스켈레톤 추가
- `/mobile/`: 홈·내 기록·촬영·모아보기·설정, 사진 확인·간단 메모·초안 저장·완료·상세.
- 모바일 테스트 4개 추가, 전체 브라우저 8개 통과. 390px/412px, 이름 없이 저장, 새로고침 보존, 잘못된 이미지/재시도, X 취소 확인, 브라우저 뒤로 가기 경고 검증.
- 홈·카메라·기록 폼·목록 접근성 점검. 기록 폼의 설명 대비 수정 후 회귀 검사 통과.
- production offline cache에 `/mobile/`을 추가, 네트워크 차단 상태에서 기존 기록을 모바일 화면에서도 읽는 smoke test 추가.
- expect-cli 추가 실행도 3분 시간 초과. Playwright/axe로 별도 검증.
- 실제 iPhone/Android 하드웨어, HEIC, 모바일 OS 강제 종료 복구, 네이티브 카메라·앱스토어 패키지 검증은 미실시. beforeunload 확인은 브라우저가 제공할 때 동작하며 OS 강제 종료를 막지 못한다.

## 2026-09-29 community/journal skeleton

- 15 unit tests: period boundaries, duplicate/future reaction handling, coarse location schema, precise coordinate isolation, photo replacement and location deletion.
- 11 Chromium browser tests passed: community sorting/likes persistence/filter, mobile capture, GPS allow/deny, existing publication/backup flow and axe WCAG checks.
- Production base-path build, offline navigation, original two-page recordbook and six-page monthly journal PDF passed with zero page errors.
- Community photos, authors, stories and reactions are explicitly fictional examples. No backend community, scheduled publication or real device camera/GPS accuracy verification yet.
- expect-cli v0.0.19 invoked separately; its current CLI lacks the skill's --cookies/--base-url flags, so environment URL and default cookies were used. Result recorded after completion below.
- expect-cli returned no test report and timed out after 3 minutes. It is not counted as a passed check; the explicit Playwright/axe and production checks above passed.

## 세 방향 연결 준비 증분
- Sonnet 5.5 Magpie quick synthetic coding: 6 checks passed. Large implementation run interrupted first by sandbox dependency network access, later by prompt-length/429; no successful Opus review claimed. Main agent completed remaining implementation.
- Unit tests: 21 passed; TypeScript passed. Coverage includes private GPS exclusion, failed restore atomicity, cloud payload allowlist/consent, public-key config validation and AI contracts. Backup photo encoder is injected in unit tests; actual image re-encoding is exercised by browser roundtrip.
- Supabase project absent by user confirmation. SQL migration/pgTAP scenarios provided but not executed; no actual login email, multi-user RLS, remote photo upload or AI identification performed. Production enablement requires SUPABASE-SETUP.md checks.
- Browser checks: existing 11 passed; new mobile backup/download/invalid restore/new-browser restore/duplicate restore/no-cloud-state/axe/mobile width scenario passed after narrowing its alert locator (12 total scenarios). No iPhone hardware claim.
- Production base-path build and smoke passed: offline reload, local review, recordbook/monthly PDF, zero page errors.
- expect-cli v0.0.19 was invoked with localhost-only scope and no cookies. It failed with `Agent produced no output for 180s` (AcpStreamError); not counted as passing. Playwright/axe and production smoke are the successful browser evidence.
