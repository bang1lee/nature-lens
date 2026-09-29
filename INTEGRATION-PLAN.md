# 연동 증분 계획 (2026-09-29)

로컬 우선·정적 내보내기·base path·개인정보 보호 원칙을 유지한 채 세 가지를 추가한다. 이 문서는 구현 전에 작성한 계획이며 실제 결과는 README/QA에 기록한다.

## 작업 1. 모바일 설정의 백업·복원
- `src/lib/backup.ts`: 백업 직렬화·복원 서비스(Studio와 모바일 공용). 기존 `parseBackup`, `preparePhoto` 재인코딩, 원자적 `restoreLibrary`, 한도를 그대로 사용한다.
- 모바일 설정에 다운로드/복원 버튼, 진행·결과(`role=status`)·오류 표시, 복원 후 목록 재로딩.
- 정밀 GPS는 `readLibrary`에 없으므로 백업에 들어가지 않는다(테스트로 고정). 잘못된 백업은 기존 기록을 바꾸지 않는다.
- 사진은 계속 이 브라우저에만 있다.

## 작업 2. Supabase 회원·커뮤니티 커넥터(선택 기능)
- 환경 변수는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 사용. 없으면 “미연결” 설명 상태이며 로그인된 것처럼 보이지 않는다. service role/secret 키 형태는 거부한다.
- `@supabase/supabase-js@2.117.2` 정확한 버전 고정 + lockfile.
- 이메일 매직링크는 사용자가 이메일을 입력하고 제출할 때만 발송. 별도 공개 별칭(이메일 아님).
- 로컬 관찰 1건을 명시적 업로드 동의 + 인물 없음 재확인 후 검수 대기열에 제출. 허용 목록 payload, 정밀 위치·격자 좌표 제외, 지역 라벨도 초기 연결에서는 전송하지 않음.
- 내 제출 목록·철회(삭제), 승인된 공개 피드. 기존 가상 예시 커뮤니티와 분리.
- 로그아웃/계정 전환 시 계정별 데이터 삭제, 오래된 응답 무시(세대 카운터).
- `supabase/migrations/20260929000000_community_pilot.sql`(제약·RLS·최소 권한·뷰) 및 `supabase/tests/community_rls.test.sql`(pgTAP). 원격 적용·실행은 하지 않는다.

## 작업 3. AI 종 판별 연결 설계
- `AI-IDENTIFICATION-DESIGN.md`(구현 가능한 서버/Edge 설계)와 `src/lib/ai/contract.ts`(요청·결과 검증 계약 + 단위 테스트). 실제 API 호출 코드는 추가하지 않는다. UI는 “미연결” 표기 유지.

## 외부 선행 조건(배포 차단 요소일 뿐, 코드 완료와 별개)
1. Supabase 프로젝트 생성, Auth 이메일 매직링크 및 Redirect URL(`<배포 origin>/nature-lens/mobile/`) 허용 목록 설정.
2. 마이그레이션 적용과 실 DB 2계정 RLS 검증(pgTAP 실행 포함), 운영자 승인 절차 정의.
3. 배포 빌드에 공개 URL/publishable key 주입.
4. AI: Edge Function 배포, 종 판별 제공자 계약·키(서버 전용), 쿼터/비용 한도, 정확도 시험.

## 검증 계획
`npm test`, `npm run typecheck`, `npm run test:e2e`, `NEXT_PUBLIC_BASE_PATH=/nature-lens npm run build`. SDK mock 테스트는 실제 백엔드 검증이 아니다.
