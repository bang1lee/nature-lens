# 공동 관찰 지도 · 로컬 구현

지도 점은 승인·업로드 동의·개인정보 확인·지도 동의를 모두 마친 일반 생물 기록만 대상으로 한다. 좌표는 이용자가 선택한 운영자 허용 구역의 대표점이며 GPS가 아니다. 구역의 대표점에 여러 기록이 있으면 목록을 연다. 원 제출, 사진, 소유자, 메모는 Realtime에 실리지 않는다. 공개 상세는 기존 승인 피드를 다시 조회한다. 최신 승인순 최대 500건이며 같은 시각에는 ID순이다. 채널 연결 상태는 실제 실시간 전달 성공의 증거가 아니다. 변경 이벤트 후 재조회하며 포커스·온라인 복귀와 화면이 보이는 동안 30초마다 다시 확인한다. 조회 실패 시 오래된 점과 열린 상세를 숨긴다.

## 서비스 준비 전 검토

- `supabase/migrations/20261103000000_community_map.sql`은 작성만 했으며 외부 프로젝트에 적용하지 않았다. 기존 스키마·권한·Realtime publication을 확인하고 격리 Supabase에서 `supabase test db`로 `supabase/tests/community_map.test.sql`과 기존 테스트를 실행한다. 구역 비활성화와 제출/승인 동시성도 두 트랜잭션으로 검증한다.
- `map_areas`는 비어 있다. 위치·범위·명칭을 사람이 확인하고 개인정보와 민감종 정책을 검토한 뒤 운영자가 별도로 등록해야 한다. 임시 화면 중심은 안성 일대이며 정확한 청량산 위치 확정이 아니다. `radius_m`은 운영 기준 정보이며 점을 실제 관찰지 주변으로 무작위 배치하지 않는다.
- 실제 SQL 적용, 구역 등록, 사용자 사진 제출, Realtime 전달·권한 검증, 배포는 수행하지 않았다. 승인된 기록이라도 지도 동의가 없는 과거 기록은 지도에 나타나지 않는다. 철회는 기존 제출 삭제를 이용한다.
- 지도 배경은 OpenStreetMap 타일, 글꼴은 MapLibre 데모 서버에 접속한다. 공개 운영 전 타일·글꼴 서비스의 이용 정책과 적절한 운영용 제공자를 검토한다.

## 확인 방법

`npm run build`, `npm run verify:local`, `npm run graph:local`과 합성 응답을 사용하는 `npx playwright test -c community-map.playwright.config.ts`를 실행한다. Playwright 테스트는 실서버 또는 실제 기록을 사용하지 않는다. DB 테스트는 PostgreSQL/Supabase 실행 환경이 필요하며 로컬에 해당 환경이 없으면 통과로 보고하지 않는다. expect-cli가 Claude 인증을 요구하면 실패로 기록하고 브라우저·axe 대체 결과와 구분한다.


## 2026-11-03 로컬 검사 결과

- `npm run build` 성공, `npm run graph:local` 성공, `npm run verify:local` 4개 작업 성공. `npm test` 22개 파일 89건 성공.
- Chrome과 합성 REST 응답을 사용한 `npx playwright test -c community-map.playwright.config.ts` 3건 성공. 같은 지점 묶음 클릭, 서로 다른 구역 묶음 확대, 상세·철회, 늦은 응답과 조회 실패를 확인했다. axe WCAG 2 A/AA 위반 0건. 합성 화면은 [map-synthetic-records.png](map-synthetic-records.png), 빈 화면은 [map-empty.png](map-empty.png)다. 지도의 타일은 외부 네트워크 속도에 따라 캡처에 나타나지 않을 수 있다.
- expect-cli는 Claude 인증 부재로 실행하지 못했다. PostgreSQL/Docker 부재로 SQL 테스트·동시성·실제 RLS·Realtime 전달은 미검증이다. 외부 데이터베이스 변경·구역 등록·배포는 하지 않았다.

## 2026-11-03 위치 확인 및 제안

사용자는 안성종합운동장 뒤편의 보개면 양복리부터 금광면 오흥리까지의 청량산을 지정했다. 안성시 SNS 시민기자단의 [청량산 답사 글](https://www.welfarehello.com/community/hometownNews/%EC%95%88%EC%84%B1%EC%9D%98-%EB%AA%85%EC%82%B0-%EC%B2%AD%EB%9F%89%EC%82%B0-%EA%B2%BD%EC%B9%98%EA%B0%80-%EC%9D%BC%ED%92%88%EC%9D%B8-%EA%B0%80%EC%9D%84-%EC%82%B0%ED%96%89-%EC%B6%94%EC%B2%9C%EC%A7%80--4d6a8894-b295-4b44-a6a7-44df096add70)은 운동장 출발과 오흥리를 명시한다. [경기관광 안성 지도](https://ggtourmap.or.kr/fileUpload/%EC%95%88%EC%84%B1%EC%8B%9C_%EA%B4%80%EA%B4%91%EC%95%88%EB%82%B4%EC%A7%80%EB%8F%84%28%EA%B5%AD%EB%AC%B8%29_2024_1.pdf)에도 청량산이 나타난다.

공개 OpenStreetMap Nominatim 검색에서 [양복리](https://www.openstreetmap.org/relation/20272195) 대표값은 북위 37.0143004, 동경 127.3245026, [오흥리](https://www.openstreetmap.org/relation/20272218)는 북위 37.0108800, 동경 127.3440700으로 확인했다. 두 값의 중간을 반올림한 북위 37.013, 동경 127.334를 지도 초기 화면 중심으로 사용한다. 이 값은 넓은 지역을 보여주기 위한 계산값으로, 산 정상이나 실제 관찰 위치가 아니다. 줌은 13이다.

[proposed-area.sql](proposed-area.sql)은 동일 계산값과 반경 2km를 사용하는 **검토용 초안**이다. 반경은 정책 제안일 뿐 실제 경계나 위치 정확도 주장이 아니다. 사용자·운영자의 공개 범위 확인, 격리 DB에서 RLS/동시성 검증과 별도 적용 승인이 선행되어야 한다. 원격 적용과 구역 등록은 하지 않았다. 위의 과거 '지역 확정 전' 문구는 이전 검사 시점의 기록이다.

위치 수정 후 로컬 `npm run build`, 지도 단위 검사 3건, 합성 데이터 브라우저 검사 3건과 axe를 통과했다. expect-cli는 Claude 인증 부재로 재차 실행되지 않았다. 실제 DB 및 Realtime 상태는 확인하지 않았다. 지도 영역 캡처: [cheongnyangsan-map.png](cheongnyangsan-map.png). 향후 영상 논의: [지형 영상 구상](TERRAIN-VIDEO-PLAN.md).
