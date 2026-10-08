# 웹 베타 출시 준비 — 2026-09-30

## 최신 출시 범위

2026-09-30: 데스크톱·노트북 브라우저 웹앱을 우선한다. 아래 Android·홈 화면 설치 표는 후속 참고용이며 첫 데스크톱 웹 베타 출시 조건이 아니다. Mac Chrome/Safari의 업로드·웹캠·저장·백업 및 실제 API 검증에 집중한다. Windows 브라우저 지원은 실기기 확인 전 보장하지 않는다.

## 확인된 현재 상태

기존 GitHub Pages: https://bang1lee.github.io/nature-lens/ (workflow 배포, HTTPS 강제 활성화). 확인 당시 `/board/`는 HTTP 404: 이번 로컬 작업은 아직 게시되지 않았다. Cloudflare CLI 로그인은 만료 상태다. 별도 호스팅을 만들 필요 없이 기존 Pages를 사용할 수 있다.

이번 로컬 검증: 단위 34개, 브라우저 21개, 타입 검사, `/nature-lens` 경로 정적 빌드 통과. 운영 의존성 `npm audit --omit=dev`의 알려진 취약점 0개. 실제 배포 파일로 첫 방문 오프라인 보드, 가상 카메라 촬영·저장·재접속, manifest, 기존 PDF 출판 검사 통과. 실기기 검증 또는 보안 전체 감사라는 의미는 아니다.

## 배포 순서

1. 이 변경을 검토 후 GitHub 저장소 main에 반영한다. 기존 workflow가 단위·기존 화면·새 카메라/인식 화면·운영 빌드 검사를 실행한 후 Pages에 배포한다.
2. 배포 작업 성공 후 `https://bang1lee.github.io/nature-lens/board/`를 Mac Chrome/Safari, Android Chrome에서 연다. 기존 주소는 사용자의 로컬 저장소를 유지하기 위해 유지한다.
3. 아래 실기기 표를 직접 확인하고 소수 사용자에게 베타로 제공한다. 데이터 삭제·손실이 발견되면 확대를 중지한다.
4. 문제가 생기면 Pages의 직전 정상 배포를 다시 게시한다. 브라우저 IndexedDB를 지우거나 스키마를 되돌리지 않는다. API 문제는 `IDENTIFY_ENABLED=false`로 먼저 차단한다.

## 실기기 확인표 (아직 미확인)

| 항목 | Mac Chrome | Mac Safari | Android Chrome |
|---|---|---|---|
| HTTPS·카메라 권한 허용/거부/재허용 | 미확인 | 미확인 | 미확인 |
| 사진 촬영·카메라 꺼짐·다른 앱 전환 | 미확인 | 미확인 | 미확인 |
| 전후면 전환·회전·사진 선택 | 미확인 | 미확인 | 미확인 |
| 저장→종료→재접속→검색 | 미확인 | 미확인 | 미확인 |
| 최초 온라인 이후 오프라인 촬영·저장 | 미확인 | 미확인 | 미확인 |
| 백업 내보내기·다른 브라우저 복원 | 미확인 | 미확인 | 미확인 |
| 홈 화면 설치 후 같은 흐름 | 미확인 | 미확인 | 미확인 |

Android 연결 장치와 adb가 현재 확인되지 않았다. USB 원격 디버깅을 쓰면 공개 배포 이전에도 PC의 로컬 서버를 휴대폰 localhost로 포트 전달할 수 있다. 브라우저 데이터는 주소와 브라우저마다 별개이며 자동 동기화되지 않는다. localhost 기록은 Pages로 자동 이동하지 않으므로 기존 백업/복원을 이용한다.

## 실제 인식 API 연결

Pages는 정적 파일 호스팅이므로 Node 인식 서버는 별도 HTTPS 서버가 필요하다. `server/start.mjs`를 Node 22.18 이상에서 실행하고 SQLite 경로를 영속 디스크에 둔다. 인스턴스는 하나로 시작한다. 여러 인스턴스가 별도 SQLite를 쓰면 전체 일일 한도가 공유되지 않는다.

비밀 값은 저장소나 채팅에 넣지 않고 서버 환경에 설정한다:

- `IDENTIFY_ENABLED=true`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- `PLANTNET_API_KEY` 및/또는 `KINDWISE_INSECT_API_KEY`
- `IDENTIFY_ALLOWED_ORIGINS=https://bang1lee.github.io` (경로 포함 금지)
- `IDENTIFY_POLICY_URL`: 실제 운영자·사진 전송·보관/삭제·제공자 설명이 있는 HTTPS 페이지
- `IDENTIFY_LEDGER_PATH`: 영속 디스크의 절대 경로

웹 빌드에 `NEXT_PUBLIC_IDENTIFY_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정한다. provider 비밀 키에 NEXT_PUBLIC 접두사를 붙이지 않는다. API 설정 후 웹을 다시 빌드해야 한다. GitHub Actions 빌드 환경에도 공개 설정을 연결해야 하며 현재는 AI 비활성 로컬 보드 베타다.

`npm run identify:preflight`는 누락/형식만 출력하고 비밀 값·사진을 보내지 않는다. 성공해도 인증정보의 유효성이나 API 정확도를 검증한 것은 아니다. 현재 환경에서는 설정이 없어 예상대로 실패한다.

실제 호출은 운영자가 전송 권한을 가진 식물·곤충 사진으로 한다. 식물/곤충/무관한 사진 각각의 결과, 시간 초과, 잘못된 키, 로그인 만료, 할당량 소진을 확인한다. 점수는 확률/정확도 보증이 아니며 이름 후보는 수동 검수한다. 최소 30장씩의 라벨 있는 사진으로 top-1/top-3 적중률·오답/보류율·응답시간·건당 비용을 기록한 뒤 공개 범위를 결정한다. 30장은 초기 점검 제안 수치이며 정확도 인증 기준이 아니다.

## 베타 이후

공동 편집·공개 링크·자동 동기화는 아직 구현되지 않았다. 후속 작업에는 보드 소유자/초대 권한, 비공개 기본값, 사진 저장·삭제, 충돌 처리, 계정 탈퇴, 공개 링크 회수 및 신고 처리가 포함된다. 첫 베타에서는 개인 보드와 백업을 검증한다.

근거: [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https), [Android 로컬 서버 포트 전달](https://developer.chrome.com/docs/devtools/remote-debugging/local-server).
