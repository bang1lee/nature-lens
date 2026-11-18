# 뉴리프 홈페이지용 자연 관찰 앱

홈페이지 편집자가 넣을 경로는 `/embed/`다. 첫 화면 맨 위에서 사단법인 뉴리프 홈페이지로 이동할 수 있다. 그 아래의 두 버튼은 같은 비중으로 사진 관찰과 공개 관찰 피드를 연다. [휴대전화 화면](mobile.png)

### 홈페이지에 연결하기

아래 코드는 앱을 Cloudflare Pages에 배포한 뒤 뉴리프 홈페이지의 HTML 영역에 넣을 수 있다. 실제 게시 시 앱 주소를 해당 배포의 HTTPS 주소로 맞춘다. 피드 조회에는 기존 앱과 동일한 공개 Supabase 빌드 설정이 필요하다. 사이트의 상위 페이지에서도 카메라·위치 권한을 위임할 수 있어야 한다.

```html
<iframe title="뉴리프 자연 관찰" src="https://nature-lens-mvp.pages.dev/embed/"
  allow="camera; geolocation" loading="lazy"
  style="display:block;width:100%;height:clamp(600px,85dvh,900px);border:0"></iframe>
```

빌드 기본값은 부모 페이지 출처 `https://newleaf.or.kr`이다. 테스트 호스트는 `NEWLEAF_EMBED_ORIGIN`으로 정확한 출처 하나를 지정한다. Pages가 배포 산출물의 `_headers`를 적용해야 한다. 다른 호스팅 환경은 동일한 응답 헤더를 설정한 뒤 실제 iframe으로 확인한다. 브라우저가 제3자 저장소를 분리하면 홈페이지 안의 기록과 별도 탭의 기록은 서로 다를 수 있다.

### 레플리카 팀과 작업 이어가기

| 담당 | 소유 범위 | 다음 담당에게 넘기는 것 |
|---|---|---|
| 오케스트레이터 | 작업 장부, 기능 조정, GitHub 이정표 | 소유 파일, 검증한 커밋, 남은 결정 |
| 레플리카 조사 | 기존 기능표·리뷰·출처 | 단계별 인계 문서와 근거 파일 |
| 프런트엔드 | 임베드 첫 화면과 탐색 | 실제 화면과 두 진입 경로 |
| 종 정보 | 출처 있는 이야기·계절·주의 표시 | 확인한 학명, 출처, 누락 범위 |
| 현장 기록 | 건강 상태·사진 밝기·계절 미션 | 저장과 재열기 검증 |
| 커뮤니티 | 전문가 확인·동의 기반 공개 | 권한과 데이터 흐름 검증 |
| 독립 QA | 브라우저와 단계별 근거 대조 | 재현 명령, 실패와 통과 내역 |

공유 작업공간의 `.harness/picturethis.json`과 인계 문서를 읽는다. `npm run replica:status`는 현재 상태를 한 번 출력한다. `npm run replica:status -- --watch`는 변경분을 출력하고 Ctrl+C로 종료한다. 별도 체크아웃에서는 `--workspace /path/to/nature-lens`를 넘긴다. 공유 장부는 오케스트레이터 한 명이 갱신한다. 작업자는 맡은 파일과 검사 결과만 보고하고 원본 리뷰·평가 사진은 GitHub에 포함하지 않는다.

### 로컬 검수

```sh
npm ci
npm run graph:local
npm run verify:local
node --test tests/replica-status.test.mjs
NEWLEAF_EMBED_ORIGIN=http://127.0.0.1:4398 npm run build
npx wrangler pages dev out --ip 127.0.0.1 --port 8798
# 별도 터미널에서 실행
npm run test:embed
```

브라우저 검사는 허용된 페이지에서 두 버튼을 열고 돌아오며, 다른 출처와 일반 앱 경로의 iframe 차단을 확인한다. 외부 카메라 기기, 실사용자 로그인, 운영 홈페이지 게시 확인은 현장 검증 항목이다.
