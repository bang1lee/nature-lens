# Nature Lens — 식물·곤충 인식과 설치형 앱

> 최신 방향(2026-09-30): 데스크톱·노트북 브라우저 중심 웹앱. 휴대폰 전용 최적화와 네이티브 앱은 후순위. [관찰 보드·카메라 구현 및 접속 안내](WEB-FIRST.md)를 먼저 확인하세요. 설치형 앱 작업은 후순위로 보존합니다.

2026-09-29. 기존 웹과 로컬 관찰·백업을 유지하며 Mac·Android 공통 앱 골격을 추가했습니다.

## 지금 사용할 수 있는 것

- `/mobile/`: 촬영·앨범 → 초안 저장 → 기록 상세 → **식물·곤충 이름 찾기**. 서버 설정이 없으면 준비 중으로 표시하고 수동 기록을 유지합니다.
- 인식 화면: 생물군 선택, 인물 없음 확인, 사진 전송 동의, 실제 대기·취소·실패, 최대 3후보 선택. 사진은 클라이언트와 서버에서 다시 인코딩합니다. GPS·메모는 요청에 없습니다.
- 후보 선택은 실제 IndexedDB에 저장됩니다. 항상 AI 보조·미검수 초안·보호 여부 미확정이며, 다른 창에서 수정된 기록을 덮어쓰지 않습니다.
- Mac: 넓은 작업 화면, 왼쪽 메뉴, `N` 촬영 단축키(입력 중 제외), 초점 표시. Android 크기: 터치 영역·안전 여백·작은 화면 레이아웃. OS 움직임 줄이기 적용.
- Tauri 2 Rust 진입점, 앱 설정·아이콘·Mac/Android 명령. 기존 Next 정적 웹은 계속 빌드합니다.

## 실제 활성화가 필요한 것

**실제 인식 서비스는 아직 꺼져 있습니다.** 식물은 Pl@ntNet, 곤충은 Kindwise insect.id 어댑터를 구현했습니다. 실제 공급자 API 키·계약·서버 운영 설정·실사진 평가를 하지 않았습니다. 테스트 후보는 모의 응답이며 인식 정확도를 증명하지 않습니다. 점수 0.2 미만을 표시하지 않는 기준은 임시 표시 기준입니다.

사용자가 찍은 국내 식물/곤충 사진과 비생물 대조군으로 평가한 뒤 활성화합니다. 이름 후보는 확정 동정, 식용·약용 판정이 아닙니다. 사진 속 인물의 자동 검출도 구현하지 않았습니다.

## 실행 명령

프로젝트 루트에서:

```sh
npm install
npm run dev -- --port 3107
npm run identify:server
npm run native:doctor
npm run native:mac:dev
npm run native:mac:build
npm run native:android:init
npm run native:android:dev
npm run native:android:build
```

Mac 개발 확인용 번들은 `npm run tauri -- build --debug --bundles app`으로 생성합니다. 생성 위치는 `src-tauri/target/debug/bundle/macos/Nature Lens.app`입니다. 현재 Mac arm64 개발 빌드이며 Intel universal·서명·공증·스토어 배포는 하지 않았습니다. 타깃 폴더는 Git에서 제외하므로 소스와 잠금 파일로 재생성합니다.

Android는 SDK·NDK·JDK 및 Rust 타깃 준비 후 `native:android:init`으로 Gradle 프로젝트를 생성합니다. 현재 환경에서는 SDK/NDK가 없어 초기화가 실패했고 **APK/AAB는 없습니다**. 공통 Rust 모바일 진입점과 Android 최소 SDK 26 설정만 준비된 상태입니다. 기기 뒤로가기, 카메라/사진 선택, 파일 다운로드·공유, 권한 거부·복귀, 로그인 리디렉션은 Android 실기기에서 검증해야 합니다. [공식 준비 절차](https://v2.tauri.app/start/prerequisites/#android).

설치형 앱과 브라우저의 IndexedDB 저장 공간은 별개입니다. 자동 기기 동기화가 없으므로 기존 기록은 백업·복원으로 옮깁니다. 앱 삭제·프로필 삭제 전에 백업하세요. 네이티브 다운로드/복원은 기기 검증 전까지 웹 작업실을 사용할 수 있습니다.

## 인식 서버 연결

정적 웹/앱에는 공급자 비밀키를 넣지 않습니다. Next 서버 API를 추가하지 않고 Node 22.18+ 독립 게이트웨이를 둡니다. 기존 Supabase 로그인을 서버에서 재검증합니다. 익명 계정은 허용하지 않습니다.

공개 빌드 설정(비밀 아님):

| 환경변수 | 값 |
|---|---|
| NEXT_PUBLIC_IDENTIFY_URL | 게이트웨이 HTTPS 루트 주소, 끝에 /identify 제외 |
| NEXT_PUBLIC_SUPABASE_URL | 기존 Supabase 프로젝트 주소 |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | 공개용 키 |

서버 프로세스에만 설정:

| 환경변수 | 용도 |
|---|---|
| IDENTIFY_ENABLED | 명시적으로 true일 때 활성화 |
| IDENTIFY_POLICY_URL | 공급자별 보관·재사용·전송국가·삭제 조건을 설명한 실제 HTTPS 안내 페이지 |
| SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY | 사용자 토큰 서버 검증 |
| PLANTNET_API_KEY | 식물 공급자 키 |
| KINDWISE_INSECT_API_KEY | 곤충 공급자 키 |
| IDENTIFY_ALLOWED_ORIGINS | 실제 웹 origin, `tauri://localhost`, Android의 실제 확인한 origin을 쉼표로 지정 |
| IDENTIFY_LEDGER_PATH | 영속 SQLite 파일 경로; 기본 `~/.local/share/nature-lens/identify.sqlite` |
| IDENTIFY_HOST / IDENTIFY_PORT | 기본 127.0.0.1 / 8787 |

부모 저장소 지침에 따라 실제 키나 `.env`를 저장소에 만들지 않습니다. 운영 비밀 저장소 또는 저장소 밖 환경에서 주입합니다. HTTPS 역방향 프록시 뒤에서 단일 영속 게이트웨이로 시작합니다. 앱 번들의 CSP는 HTTPS 연결을 허용하며, 서버 CORS는 정확한 origin 목록을 사용합니다. CORS 자체는 인증이 아닙니다.

요청 최대 약 5.65MB JSON / 사진 4MB / 디코딩 16MP, 서버 재인코딩 후 공급자 20초 제한. 사용자 5회/UTC일·전체 50회/UTC일을 SQLite 트랜잭션으로 예약합니다. 중복 요청 ID는 재호출하지 않고 409, 한도 초과는 429입니다. 실패·취소도 예약을 소비하며 원본 사진/공급자 결과는 서버 DB에 저장하지 않습니다. 사용자 ID·요청 ID·일자는 한도 장부에 보관합니다. 별도 서버마다 서로 다른 DB를 두면 전역 한도가 아니므로 다중 인스턴스 배포 전 공유 원자적 저장소로 전환합니다.

공급자는 사진을 별도 보관할 수 있습니다. 앱에서 대기를 취소해도 이미 전송한 요청은 취소되지 않을 수 있습니다. 공급자 키·요청 URL·사진·토큰을 프록시/APM 로그에 남기지 않도록 운영 설정을 확인해야 합니다. 보관·삭제 정책 문구와 실제 계약을 맞춘 뒤 활성화하세요.

## 근거와 검증

[검증 결과](docs/APP-SKELETON-VALIDATION.md), [구현 계획](docs/APP-SKELETON-PLAN.md).
공식 계약: [Pl@ntNet](https://my.plantnet.org/doc/api/identify), [Kindwise insect.id 예제](https://github.com/flowerchecker/insect-id-examples), [Tauri Next 정적 앱](https://v2.tauri.app/start/frontend/nextjs/).

Figma의 종이 디자인 시스템과 토큰은 보존했습니다. 전체 앱의 새 스킨 적용 완료나 Figma 모션 프로토타입 제작으로 설명하지 않습니다.
