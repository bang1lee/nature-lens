# 로그인 연결 검증 · 2026-10-28

## 실행 근거
- 단위: 20 files / 83 tests 통과. `unit.log`, 독립 담당 최종 재실행 동일 결과.
- 인증 집중 브라우저: `tests/cloud-auth.playwright.config.ts` 4/4 통과(독립 담당 실행). 테이블 누락 시 로그인 유지/느린 조회/중복 메일 요청/늦은 메일 결과 검사. 실제 Supabase·메일·사진 전송 없음.
- 앱/가상 카메라: `app.log` 최초 18/19 통과. 마지막 카메라 검사 page.goto load 30초 초과; `camera-retry1.log`에서 변경 없이 1/1 통과. 추가 PKCE 5건 최초 통과: SDK code 교환 단일호출, pending 없는 일반로그인, 기존기록 사진/ID 보존, verifier 없는 다른브라우저, 만료+기존세션, 오류 fragment를 포함한다. 전체 19건을 한 번에 통과했다고 표시하지 않는다.
- 독립 소스 QA: 최종 useIdentificationReturn/CloudPanel/api 범위 P0/P1 발견 없음. 실제 이메일·DB 권한 검증은 이 검토에 포함되지 않음.
- expect: 실행했으나 `AcpProviderUnauthenticatedError`로 차단(`expect.log`), 통과 아님. 동일 인증 오류 반복 안 함. UI/axe는 Playwright 검사 근거로 구분한다.

## 실제 서비스 확인
`service-check.json`: UI에서 Site URL/Redirect URL 확인, Auth settings GET200/email enabled. 커뮤니티 3개 API metadata 조회는404/PGRST205. 익명역할과 schema cache의 한계가 있으므로 DB가 비었다거나 인증된 사용자 권한도 없다고 단정하지 않는다. DB/RLS·이메일 왕복·식별 공급자 실응답은 미검증이다. 원격 데이터 변경과 사진 전송은 하지 않았다.

## 사용자 다음 행동
공개 로그인 화면이 배포되면 설정에서 Supabase 가입에 사용한 이메일로 링크를 요청하고, 요청한 같은 브라우저에서 링크를 연다. 기본 SMTP는 조직 구성원 이메일로만 발송되므로 일반 사용자 파일럿 전에 별도 SMTP가 필요하다. https://supabase.com/docs/guides/auth/auth-smtp

로그인은 사진 동기화가 아니다. 현재 기기 내 저장/재관찰은 브라우저 저장소를 사용하며, 실제 외부 식별과 커뮤니티 권한 검증은 후속 단계다.

## 통합 및 빌드
- 전체 E2E 41/41 통과(`e2e.log`, 2.3분). 이 실행은 외부 설정을 비워 오프라인/기기저장 회귀를 검사했다.
- Cloudflare 정적 빌드와 `tsc --noEmit` 통과(`build.log`, `types.log`). 빌드는 실제 공개 Supabase 설정을 포함하고 외부 식별 URL은 비워 두었다.
- 생성 JS에서 대상 프로젝트 URL/공개키/로그인 복귀 안내 포함을 확인, secret키 형식은 발견되지 않았다. `.env.local`은 Git ignore 유지.
- 신규 `test:cloud-auth` 명령과 CI 단계로 집중검사를 지속 적용했다.
