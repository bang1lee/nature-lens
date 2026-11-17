# 청량산 지도 실제 적용 · 2026-11-14

## 실제 적용
- Supabase ivmbwbmxebbseowgqcjc / naturelens Healthy 확인 후 SQL Editor에서 지도 migration 적용 성공.
- 사전 검사: community_submissions와 community_feed 존재, 지도 테이블·컬럼·함수 없음, publication all_tables=false, 기존 published=[observations].
- seed: anseong-cheongnyangsan-area / 안성 청량산 일대 / 37.013,127.334 / radius_m=2000 / active=true. 실제 관찰 GPS가 아닌 대표 구역.
- 사후 검사: 두 테이블 RLS=true, policies=map_points_public,map_areas_public; triggers=community_map_area_sync,community_map_area_validate,community_map_sync; published=[observations,community_map_points]; 권한 [true,false,false,false,true,false]; 공개 점 0건.
- 기존 사용자 기록 승인·수정·전송 없음. 별도 지도 공개 동의가 있는 common 승인 기록만 투영됨.

## 배포
- npm run deploy:pages 성공. 빌드·타입 검사 완료. Offline shell 55 assets / 4db6f2cb9f8f.
- Cloudflare main 배포: https://6450c0c9.nature-lens-mvp.pages.dev
- 운영: https://nature-lens-mvp.pages.dev/mobile/
- 실제 운영 브라우저에서 지도 열기 → OSM 청량산 지도 렌더, 저작권 링크, 0개 기록, 변경사항 연결됨 확인.
- HEAD 8250cb6의 미커밋 변경 포함 배포. 기존 타 작업 변경을 보존했으며 원격 Git push/merge 없음.

## 검증 구분
- 로컬: build, graph:local, verify:local 4/4; 합성 지도 브라우저 3/3 및 axe; 격리 PGlite SQL 단언 12건/중복 seed 통과(작업 에이전트 보고 및 release README 참조).
- 실서비스: 익명 공개 구역 REST200, 공개 점 REST200/0건, private submissions401; 두 독립 Realtime SUBSCRIBED(README.md 및 verify-live-readonly.mjs 참조).
- 실제 합성 시험: INSERT 수신 2026-11-14T11:08:37.977Z/.984Z, 두 클라이언트 재조회 present. DELETE 수신 11:09:18.965Z/.967Z, 두 클라이언트 재조회 absent. 운영 화면에서 1개→합성 상세→0개 및 상세 자동 제거 확인. 시험 SQL은 관리자 직접 실행했으므로 일반 회원 제출 UI 권한의 종단간 시험은 별도 범위다.
- expect-cli: Claude 인증 부재로 실행 실패, 통과로 계산하지 않음.

## 다음 작업
합성 계정 NL_MapProbe_1114와 지정 제출은 공개 철회 완료(status=rejected, consent_map=false). 사용자의 시험 데이터만 삭제 승인 후 realtime-probe-03-cleanup.sql 실행 성공. 별도 SELECT 결과 test_accounts/test_profiles/test_submissions/test_points 모두 0. 증거 probe-cleanup.png. 기존 사용자 기록은 수정하지 않았다. 실제 데이터는 동의 후 승인 흐름을 유지한다.
