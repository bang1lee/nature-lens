# 공개 베타 사진·관찰 API 로컬 검증 · 2026-11-15

사용자가 새 기록의 공개 베타 방식을 선택하여 신규 `beta_public_observations`, `beta_public_feed`와 별도 `nature-lens-beta-public` 버킷을 설계했다. 기존 `observations` 및 `obs-photos`는 마이그레이션에서 변경하지 않는다. 이전 기기 기록은 자동 전송하지 않으며 공개·인물/개인정보 확인을 해당 저장 요청에 명시해야 한다. 데이터베이스·배포·실사용 검증의 실제 상태는 통합 담당자의 별도 기록을 따른다.

`src/lib/cloud/beta-public.ts`는 `publishBetaObservation(client,userId,record,{publicConsent:true,noPeople:true})`, `listBetaFeed(client)`, `listMyBetaObservations(client,userId)`, `restoreBetaObservation(client,userId,item)`을 제공한다. 저장 전에 사진을 JPEG로 다시 그려 EXIF를 제거하고 `region`, `publicGrid`, 사진 원본을 메타데이터에서 뺀다. 공개 피드는 제목·이름 후보·관찰일·메모·불투명 사진 경로 및 게시일만 포함하며 계정 ID·이메일·복원용 메타데이터는 제외한다. 소유자 복원은 같은 대상/이전 관찰 연결을 유지하며, 컬렉션 자체는 동기화하지 않으므로 `sessionId`는 null로 만든다.

동일 사용자의 동일 로컬 ID와 동일 메타데이터·사진 내용에 대한 재시도는 공개본을 재사용한다. 이미 예약하거나 공개한 기록의 다른 버전은 충돌로 중단하고 덮어쓰지 않는다. 업로드 후 게시 상태 갱신 실패 시 같은 객체의 해시를 확인해 안전하게 재시도한다. 요청 시간 초과는 서버 처리가 취소됐다는 보장이 없으며 안내 후 동일 기록으로 재시도할 수 있다. 소유자 행은 계정당 500건으로 제한하고 각 행은 객체 하나만 예약한다.

## 검증

- `npm test`: 23개 파일 100건 통과. 이 중 `tests/beta-public.test.ts`의 8건은 동의, 비공개 좌표 제외, 계정 변경 차단, 동일 버전 재시도, 다른 버전 충돌, 부분 실패 복구, 복원 및 응답 지연을 SDK 모의로 검사한다.
- `npm run typecheck`: 통과.
- `npm install --prefix /tmp/nature-map-pg @electric-sql/pglite --no-save --ignore-scripts` 후 `node tests/beta-public-pglite.mjs`: 격리된 PostgreSQL 호환 PGlite 모형에서 신규 마이그레이션 및 `supabase/tests/beta_public.test.sql` 13개 단언 통과. 원본 공개 버킷·정책과 관찰 테이블에 둔 sentinel이 유지되는 것도 확인했다. 실제 Supabase Storage 서버나 두 실제 계정의 접근 시험이 아니다.
- `expect-cli`는 Claude 인증 부재(`AcpProviderUnauthenticatedError`)로 실행 실패했다. 실제 앱 UI, 실서비스 공개 업로드·계정 간 다운로드 차단·재인코딩 결과의 EXIF 제거는 별도 실측이 필요하다.

## 실제 적용과 운영 시 한계

- 공개 버킷의 파일은 게시 행이 완성되기 전이라도 URL을 아는 사람이 볼 수 있다. 게시 후에도 URL은 공개되며 현재 일반 회원용 공개본 삭제·철회 API는 없다. 로컬 삭제 또는 기존 공동 관찰 철회는 베타 공개본을 지우지 않는다. 다운로드된 복제본이나 캐시 회수는 보장할 수 없다.
- 브라우저의 정상 앱 경로는 재인코딩해 사진 메타데이터를 제거하지만 Storage 서버가 직접 호출된 JPEG의 EXIF를 검증하거나 제거하지는 않는다. 제목·이름·메모에 직접 입력한 주소나 연락처도 자동 제거하지 않는다.
- 게시 완료 전 전송 실패로 예약행과 객체가 남을 수 있다. 동일 내용 재시도는 복구하도록 구성했지만 자동 영구 정리 기능은 제공하지 않는다. 500건 제한은 계정 단위 보호이며 전체 서비스의 요금·트래픽 상한이 아니다.
- 보호가 필요한 생물이나 미확정 생물의 지도 표시 정책은 별도의 기존 지도 경로를 따른다. 이 공개 피드의 이름은 AI 후보일 수 있으며 검증된 종 판정이 아니다.
