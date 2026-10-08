# 인식 기능 + Mac·Android 설치형 앱

2026-09-29. 사용자 선택: 설치형 앱 골격 + 기존 웹 유지.

## 구성과 순서
1. identification: 식물·곤충 요청/응답 계약, 실제 공급자 어댑터, 동의와 후보 선택 UI. 기존 로컬 기록·수정 충돌 방지 재사용.
2. identify-gateway: 별도 Node 서버. Supabase 사용자 인증, 이미지 재인코딩, 영속 SQLite 원자적 한도(사용자5/UTC일, 전체50/UTC일), 요청 중복 차단. 운영 설정 없으면 비활성. 공급자 키를 정적 앱에 넣지 않음.
3. app-shell: Tauri 2가 Next 정적 out을 사용. Mac 넓은 화면·키보드, Android 안전 여백·터치·반응형 화면. 웹 경로 유지.

## 경계
- 식물 Pl@ntNet, 곤충 Kindwise insect.id 공식 HTTP 계약. 공급자 호출은 운영자가 키·동의 정책·비용 한도 설정 후 활성화. 이번에는 유료 호출·사진 외부 전송·계정 생성·배포 없음.
- 결과는 이름 후보, 점수는 확정 확률 아님. 사용자가 선택해도 draft/aiAssisted/unknown 유지, 기존 검수 무효화. GPS·메모는 요청에서 제외.
- 모바일 기존 UI를 /mobile에서 재사용. Apple/Android 별도 전면 재작성 대신 공유 코드와 OS 빌드 골격 제공. 네이티브 카메라·백업·로그인·뒤로가기는 실제 기기 검증 전까지 미검증으로 기록.
- 기존 Figma·디자인시스템은 보존. 전체 종이 스킨 재구현은 이번 범위 밖.

## 검증
Vitest: 계약/동의/이미지/공급자 파싱/인증/한도/중복/충돌. Playwright: 미설정 수동 기록, 후보 선택 모의 서버, 취소/오류, 데스크톱·모바일 레이아웃. typecheck/build, Tauri 환경 진단과 가능한 플랫폼 컴파일. 실측 없는 성능 향상·종 정확도·APK 설치 성공을 주장하지 않음.

## 실행
`npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`.
서버·네이티브 명령과 운영 설정은 구현 후 APP-SKELETON.md에 실제 검증 상태와 함께 기록.
