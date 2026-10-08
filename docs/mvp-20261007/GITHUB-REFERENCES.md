# Nature Lens MVP · GitHub 오픈소스 참고 검토

확인 시각: 2026-10-08 00:01 KST / 2026-10-07 15:01 UTC. 문서 폴더명은 기존 작업 회차 `mvp-20261007`을 유지한다.

GitHub 요청을 **유용한 공개 프런트엔드·백엔드 코드 조사**로 적용했다. 이 문서는 저장소 생성·push·GitHub 게시 작업을 뜻하지 않는다. 8개 저장소의 API 메타데이터, 기본 브랜치 커밋, 해당 커밋의 파일 트리·실제 코드·라이선스를 읽었다. 내려받은 참고 코드를 실행하거나 제품에 복사하지 않았고 새 패키지도 설치하지 않았다. **조사·적용 제안 완료**이며, 아래 제안의 제품 구현 완료나 원격 배포 성공을 의미하지 않는다.

## 1. 이번 MVP에 가장 유용한 선택

1. **Seek**에서 관찰 목록·검색 결과 없음·초기화 흐름을 참고한다. Nature Lens의 종이 기록집 분위기는 자체 디자인을 유지한다.
2. **Radix**의 대화상자 초점 이동과 취소 동작을 참고해 편집·삭제 경험을 다듬는다. 화면 전체 테마를 교체할 필요는 없다.
3. **idb** 공식 예제로 현재 브라우저 저장·백업 복원의 원칙을 확인한다. 이미 사용하는 저장 도구를 유지한다.
4. **Cloudflare workers-sdk**의 D1 쿼리 예제는 최신 설계의 암호화 임시 백업 전달 구현 기준으로 사용한다. R2 예제는 비교 자료로 확보했으며 이번 MVP 도입 대상은 아니다.

오픈소스(조건에 따라 읽고 수정·재사용할 수 있는 공개 코드)는 검증된 동작 방식을 확인하는 데 유용하다. 커밋 SHA(특정 시점 코드를 가리키는 고유 번호)로 아래 근거를 고정했다. SPDX(라이선스 이름의 표준 표기)는 재사용 조건을 식별하는 값이며, 사진·로고·서체·외부 모델의 권리까지 자동으로 보장하지 않는다.

## 2. 저장소 8개 확인 결과

각 행의 날짜는 **기본 브랜치 커밋의 UTC 날짜**다. 8개 모두 확인 당시 `archived=false`다. 최근 커밋은 활동의 증거이며 향후 유지보수나 안전성을 보장하는 지표는 아니다.

| 저장소 | 실제 라이선스 근거 | 고정 커밋 · 커밋 날짜 | 판단 |
|---|---|---|---|
| [jakearchibald/idb](https://github.com/jakearchibald/idb) | [ISC](https://github.com/jakearchibald/idb/blob/654c746bef13f9fe7f5871e03ac58015cebace5a/LICENSE) | [654c746bef13](https://github.com/jakearchibald/idb/commit/654c746bef13f9fe7f5871e03ac58015cebace5a) · 2026-10-06 | 즉시 참고 · 기존 저장 의존성 유지 |
| [inaturalist/SeekReactNative](https://github.com/inaturalist/SeekReactNative) | [MIT](https://github.com/inaturalist/SeekReactNative/blob/69a79a26469d5a1c973fd83c9f7f684c5090a652/MIT-LICENSE) | [69a79a26469d](https://github.com/inaturalist/SeekReactNative/commit/69a79a26469d5a1c973fd83c9f7f684c5090a652) · 2026-09-10 | 즉시 참고 · 관찰 카드·검색 빈 상태 |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | [MIT](https://github.com/radix-ui/primitives/blob/c71610373b6aa17de24f5c7484ced5108160f12b/LICENSE) | [c71610373b6a](https://github.com/radix-ui/primitives/commit/c71610373b6aa17de24f5c7484ced5108160f12b) · 2026-10-06 | 즉시 참고 · 편집·삭제 대화상자 접근성 |
| [cloudflare/workers-sdk](https://github.com/cloudflare/workers-sdk) | [MIT OR Apache-2.0](https://github.com/cloudflare/workers-sdk/blob/82acf3cdf14de30cc45a134c5f7762f41fba22b1/package.json) | [82acf3cdf14d](https://github.com/cloudflare/workers-sdk/commit/82acf3cdf14de30cc45a134c5f7762f41fba22b1) · 2026-10-07 | 백엔드 구현 기준 · D1 임시 전달; R2는 후속 참고 |
| [cloudflare/templates](https://github.com/cloudflare/templates) | [MIT](https://github.com/cloudflare/templates/blob/dfdf14099a81a08cfe1ffc78f8463605670ae513/LICENSE) | [dfdf14099a81](https://github.com/cloudflare/templates/commit/dfdf14099a81a08cfe1ffc78f8463605670ae513) · 2026-10-07 | 보조 · 정적 사이트와 서버 연결 구조 |
| [dimsemenov/PhotoSwipe](https://github.com/dimsemenov/PhotoSwipe) | [MIT](https://github.com/dimsemenov/PhotoSwipe/blob/cd41cb587a460634e4cae53134f3d01d06e284a6/LICENSE) | [cd41cb587a46](https://github.com/dimsemenov/PhotoSwipe/commit/cd41cb587a460634e4cae53134f3d01d06e284a6) · 2025-12-04 | 후속 후보 · 사진 확대·키보드 이동 |
| [transloadit/uppy](https://github.com/transloadit/uppy) | [MIT](https://github.com/transloadit/uppy/blob/e2f17012c464ed1f6d5c1cf975963f87d7912220/LICENSE) | [e2f17012c464](https://github.com/transloadit/uppy/commit/e2f17012c464ed1f6d5c1cf975963f87d7912220) · 2026-10-07 | 후속 후보 · 다중 사진 업로드 큐 |
| [immich-app/immich](https://github.com/immich-app/immich) | [AGPL-3.0-only](https://github.com/immich-app/immich/blob/26b8e3d40081dc5c70d8a0b3d689b963b8d0779e/LICENSE) | [26b8e3d40081](https://github.com/immich-app/immich/commit/26b8e3d40081dc5c70d8a0b3d689b963b8d0779e) · 2026-10-07 | 아이디어 참고만 · 코드 복사 제외 |

Seek은 저장소 push 시각이 2026-10-03이지만 기본 브랜치 커밋은 2026-09-10이었다. 두 값을 혼동하지 않았다. PhotoSwipe 기본 브랜치는 마지막 확인 커밋이 2025-12-04로 다른 후보보다 오래됐다. workers-sdk는 GitHub 자동 감지가 Apache-2.0 하나를 반환했지만 실제 루트 `package.json`은 **MIT OR Apache-2.0**이며 두 라이선스 원문도 확인했다. Immich 원문은 버전 3의 AGPL이고 조사한 코드에 후속 버전 허용 표기를 확인하지 못해 보수적으로 **AGPL-3.0-only**로 기록했다.

## 3. 우선 참고할 실제 코드와 적용 범위

### Seek · 관찰 카드와 검색 복구 동작

- 근거: [ObsCard.tsx](https://github.com/inaturalist/SeekReactNative/blob/69a79a26469d5a1c973fd83c9f7f684c5090a652/components/Observations/ObsCard.tsx#L80-L85) / [SearchEmpty.tsx](https://github.com/inaturalist/SeekReactNative/blob/69a79a26469d5a1c973fd83c9f7f684c5090a652/components/Observations/SearchEmpty.tsx#L14-L23).
- 확인한 동작: 사진·종 정보 카드에서 상세로 이동하고 삭제 동작을 분리한다. 검색 결과가 없으면 검색어를 초기화하는 버튼을 제공한다.
- Nature Lens 적용: `src/components/Studio.tsx`의 검색 빈 상태에 필터·검색어 초기화 버튼을 넣고, 사진/제목/초안·검수 상태/날짜의 우선순위를 정돈한다. 새 기록이 없는 상태는 사진 등록과 가상 예제 불러오기 중 다음 행동을 명확히 보여준다.
- 범위·위험: React Native 전용 탐색·스크롤·애니메이션 구현은 웹에 그대로 맞지 않는다. 슬라이드 삭제만 제공하지 말고 키보드로 접근할 수 있는 버튼을 유지한다. 소스의 사진·아이콘·브랜드 자산은 가져오지 않는다. 종 후보를 확정 사실로 표시하지 않는다.
- 수용 조건: 검색 0건에서 초기화 후 기록을 다시 볼 수 있고, 초안과 검수 완료를 색상 이외의 글자로도 구분한다.

### Radix · 대화상자 초점과 삭제 확인

- 근거: [dialog.tsx](https://github.com/radix-ui/primitives/blob/c71610373b6aa17de24f5c7484ced5108160f12b/packages/react/dialog/src/dialog.tsx#L310-L330) / [alert-dialog.tsx](https://github.com/radix-ui/primitives/blob/c71610373b6aa17de24f5c7484ced5108160f12b/packages/react/alert-dialog/src/alert-dialog.tsx#L98-L129).
- 확인한 동작: 열린 대화상자 안에 초점을 유지하고 닫을 때 호출 버튼으로 돌려준다. 경고 대화상자는 처음에 취소 버튼으로 초점을 이동시키고 바깥 영역 클릭이 의도치 않은 닫힘으로 이어지지 않도록 처리한다.
- Nature Lens 적용: `src/components/Editor.tsx` 편집창과 `src/components/Studio.tsx` 삭제 확인에 같은 동작 기준을 적용한다. 기존 포커스 복원 코드가 있어 중복 구현부터 확인한다. 패키지 설치 또는 네이티브 `<dialog>` 유지 중 구현자가 현재 구조에 맞게 선택한다.
- 범위·위험: 검토한 `main` 코드는 배포된 npm 버전과 다를 수 있다. 패키지를 도입하면 실제 고정 버전 문서를 다시 확인한다. 예제 소스를 부분 복사하면 내부 의존 컴포넌트가 함께 필요해지므로 통째로 붙여 넣지 않는다.
- 수용 조건: Tab/Shift+Tab, Escape, 취소·저장·닫기 후 초점 복귀를 브라우저에서 확인한다. 삭제 확정 전 기록은 보존된다.

### idb · 저장 완료 시점과 복원 경계

- 근거: [트랜잭션 수명](https://github.com/jakearchibald/idb/blob/654c746bef13f9fe7f5871e03ac58015cebace5a/README.md#L171-L198) / [tx.done](https://github.com/jakearchibald/idb/blob/654c746bef13f9fe7f5871e03ac58015cebace5a/README.md#L239-L252) / [openDB 연결 사건](https://github.com/jakearchibald/idb/blob/654c746bef13f9fe7f5871e03ac58015cebace5a/README.md#L77-L113).
- 확인한 원칙: 트랜잭션(여러 저장을 한 묶음으로 처리하는 작업) 안에서 네트워크 요청 등 다른 비동기 작업을 기다리면 저장 작업이 먼저 닫힐 수 있다. `tx.done`이 완료돼야 저장 성공으로 볼 수 있다. `blocked`, `blocking`, `terminated`로 여러 창과 연결 종료 상황을 처리할 수 있다.
- Nature Lens 적용: `src/lib/backup.ts`의 사진 파싱·재처리 완료 후 `src/lib/storage.ts`의 복원 트랜잭션을 여는 현재 순서는 이 원칙에 부합한다. 이 경계를 보존하고 향후 업로드 요청은 저장 트랜잭션 밖에서 수행한다. 필요 시 저장소 열기 지연을 사용자가 이해할 수 있는 재시도 안내로 연결한다.
- 범위·위험: 이 검토는 브라우저 저장의 영구 보존이나 모든 복원 실패 동작을 검증했다는 뜻은 아니다. 기존 `tests/backup.test.ts`와 관련 저장 테스트를 수정 시점에 실행한다. 정상 복원 전에 기존 DB를 지우지 않는다.
- 수용 조건: 백업 파일 파싱·이미지 준비 실패 시 기존 기록이 유지되고, 중복 ID는 덮어쓰지 않으며, 저장 성공 안내는 `tx.done` 이후 나타난다. 새 사이트 주소로 이동할 때 백업/복원으로 이전한다.

### Cloudflare workers-sdk · D1 암호화 임시 백업 전달의 쿼리 기준

- 근거: [D1 매개변수 바인딩](https://github.com/cloudflare/workers-sdk/blob/82acf3cdf14de30cc45a134c5f7762f41fba22b1/fixtures/vitest-plugin-examples/d1/src/utils.ts#L50-L67) / [R2 파일 입출력](https://github.com/cloudflare/workers-sdk/blob/82acf3cdf14de30cc45a134c5f7762f41fba22b1/fixtures/vitest-plugin-examples/kv-r2-caches/src/helpers.ts#L13-L39) / [R2 로컬 검사](https://github.com/cloudflare/workers-sdk/blob/82acf3cdf14de30cc45a134c5f7762f41fba22b1/fixtures/vitest-plugin-examples/kv-r2-caches/test/r2.test.ts#L9-L32).
- 확인한 패턴: D1(Cloudflare의 표 형태 서버 저장소)은 SQL 쿼리에 값을 별도로 묶어 전달한다. R2(사진·백업 같은 파일 저장소)는 요청 본문을 스트림으로 저장하고 HTTP 메타데이터와 함께 읽는다. 테스트는 업로드 후 내용과 캐시 동작을 확인한다.
- Nature Lens 적용: 최신 `ASTRA-BRIEF.md`의 단계 B는 사용자가 선택한 백업을 브라우저에서 암호화해 D1에 임시 보관·전달·삭제하는 실제 기능이다. `worker/index.ts` 또는 실제 생성되는 Worker 진입점과 `worker/transfers.ts` 같은 신규 모듈에서 D1의 매개변수 바인딩을 참고한다. 암호문·만료 시각·토큰 해시를 저장하고 평문·암호 키는 서버에 보내지 않는 경계는 별도 제품 설계로 구현한다. R2는 도입하지 않는다. 기존 `src/lib/backup.ts`의 파일 내보내기·복원 경로를 유지하며 `src/lib/cloud/api.ts`의 Supabase 기능과 임시 전달을 혼동하지 않는다. 새 파일 경로는 제안이며 아직 존재 여부를 구현 완료로 표시하지 않는다.
- 범위·위험: 참고 R2 예제에는 사용자 인증·소유권 검사가 없고 읽은 파일을 캐시에 저장한다. 개인 백업·사진 API에 이 예제를 그대로 쓰지 않는다. 비공개 요청에 공개 캐시를 쓰지 않도록 별도 설계가 필요하다. D1 예제의 `admin` 저자는 데모 값이며 실제 인증 사용자와 연결해야 한다. 예제의 내용이 없을 때 204 응답도 제품 API 계약에 맞춰 다시 결정한다.
- 수용 조건: 현재 임시 전달 구현에서는 잘못된 토큰·만료·없는 ID의 일관된 거절, 크기 제한, 암호문 변조와 잘못된 키의 복원 전 거절, 조기 삭제, 다른 브라우저 복원을 검증한다. D1 예제는 암호화·만료·토큰 검사를 제공하지 않으므로 그 검증을 대체하지 못한다. 이번 참고 조사만으로 해당 기능이 구현됐다고 표시하지 않는다.

## 4. 보조 후보를 지금 도입하지 않는 이유와 후속 사용처

| 후보·실제 코드 | 유용한 지점 | Nature Lens 대상·한계 |
|---|---|---|
| [Cloudflare D1 기본 Worker](https://github.com/cloudflare/templates/blob/dfdf14099a81a08cfe1ffc78f8463605670ae513/d1-template/src/index.ts) / [세션 API 예제](https://github.com/cloudflare/templates/blob/dfdf14099a81a08cfe1ffc78f8463605670ae513/d1-starter-sessions-api-template/src/index.ts) | 서버에 저장한 뒤 읽는 일관성, Worker 바인딩 구조 | `worker/` 후속 DB 모듈. 세션 샘플은 데모용 테이블 생성과 초기화 엔드포인트를 포함하므로 공개 제품에 그대로 제공하지 않는다. [R2 Explorer](https://github.com/cloudflare/templates/blob/dfdf14099a81a08cfe1ffc78f8463605670ae513/r2-explorer-template/src/index.ts)는 외부 도구를 호출하는 래퍼라 직접 구현 근거로는 약하다. |
| [PhotoSwipe keyboard.js](https://github.com/dimsemenov/PhotoSwipe/blob/cd41cb587a460634e4cae53134f3d01d06e284a6/src/js/keyboard.js) / [lightbox.js](https://github.com/dimsemenov/PhotoSwipe/blob/cd41cb587a460634e4cae53134f3d01d06e284a6/src/js/lightbox/lightbox.js) | 사진 크게 보기, 방향키 이동, Escape, 초점 복귀 | `src/components/Studio.tsx`와 향후 `PhotoViewer.tsx`. 사진 원본 크기와 클라이언트 초기화가 필요하며 확대 뷰가 MVP 필수인지 먼저 판단한다. 오래된 마지막 커밋만으로 방치라고 단정하지 않는다. |
| [Uppy DragDrop.tsx](https://github.com/transloadit/uppy/blob/e2f17012c464ed1f6d5c1cf975963f87d7912220/packages/@uppy/drag-drop/src/DragDrop.tsx) / [Next.js 업로드 예제](https://github.com/transloadit/uppy/blob/e2f17012c464ed1f6d5c1cf975963f87d7912220/examples/nextjs/src/components/UppyDashboard.tsx) | 끌어놓기와 파일 선택 병행, 파일 개수·형식·크기 제한, 업로드 진행 상태 | `src/components/Editor.tsx`, `src/components/mobile/QuickCapture.tsx`. 현재 한 장 등록에 전체 Dashboard/서버 전송을 도입할 이유는 약하다. 예제의 Transloadit·Tus 서버는 별도 서비스이므로 유료 연동을 활성화하지 않는다. |
| [Immich PhotoViewer.svelte](https://github.com/immich-app/immich/blob/26b8e3d40081dc5c70d8a0b3d689b963b8d0779e/web/src/lib/components/asset-viewer/PhotoViewer.svelte) / [DetailPanel.svelte](https://github.com/immich-app/immich/blob/26b8e3d40081dc5c70d8a0b3d689b963b8d0779e/web/src/lib/components/asset-viewer/DetailPanel.svelte) | 큰 사진 보기와 상세 정보의 배치·시각 우선순위 참고 | 보드 상세 화면. AGPL 코드·스타일·자산 복사를 이번 범위에서 제외한다. Svelte 기반 대형 사진 서버 구조를 Nature Lens에 이식하지 않고 관찰한 사용 경험을 자체 구현한다. |

## 5. 인계와 출처 기록

읽은 기존 근거: `docs/WEB-LAUNCH.md`, `docs/mvp-20261007/ASTRA-BRIEF.md`, `package.json`, `src/lib/storage.ts`, `src/lib/backup.ts`, `src/components/Studio.tsx`, `src/lib/cloud/api.ts`. 기존 출시 문서의 검증 결과는 과거 기록이며 이번 조사에서 재실행한 검사로 인용하지 않는다. 수정된 ASTRA의 GitHub 참고 조사 범위와 D1 암호화 임시 전달 요구를 반영했다. 사용자의 최신 정정인 “공개 코드 참고”가 GitHub 관련 작업 범위다.

원본 코드를 실제 복사·수정한다면 원저작권·라이선스 고지를 함께 보존하고, 사용한 커밋·파일·변경 목적을 변경 기록에 추가한다. 현재는 코드 복사가 없어 제품용 제삼자 고지를 새로 생성하지 않았다. `reference-manifest.json`에는 확인 시각, 커밋·push 시각의 구분, 라이선스 근거, 읽은 파일과 SHA-256(파일 내용 변경을 확인하는 지문), 적용 우선순위를 저장했다. API 응답에서 기본 브랜치 전체 트리는 8개 모두 `truncated=false`였고 문서 링크는 읽은 고정 커밋을 가리킨다.
