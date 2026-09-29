# 회원·공동 관찰 연결 운영 가이드

현재 상태: 연결 코드 준비. Supabase 프로젝트·실제 이메일 발송·실DB 보안 검증은 아직 없음. AI 판별은 설계만 있으며 자동 호출하지 않는다.

1. 전용 Supabase 프로젝트를 준비한다. 다른 서비스의 운영 DB에 이 파일럿 스키마를 바로 적용하지 않는다.
2. `supabase/migrations/20260929000000_community_pilot.sql`을 검토하고 로컬 Supabase에서 먼저 적용한다. `supabase test db`로 `supabase/tests/community_rls.test.sql`을 실행한다. 현재 이 Mac에 Supabase CLI/Postgres가 없어 이 SQL 검사는 미실행이다.
3. 서로 다른 테스트 계정 두 개로 비공개 제출 조회/삭제 격리, 승인 우회 거절, 로그아웃·계정 전환, 공개 후 철회를 검사한다. mock/타입 검사로 이 검증을 대신하지 않는다.
4. Auth에 이메일 로그인을 활성화하고 Site URL과 redirect allowlist에 실제 `/nature-lens/mobile/` URL을 등록한다. PKCE 로그인 링크는 요청한 기기의 같은 브라우저에서 연다. 이메일 발송 제한과 CAPTCHA/가입 제한을 검토해 악용을 막는다.
5. 빌드 환경에 아래 두 공개 값을 넣고 재빌드한다. GitHub Pages 정적 배포이므로 런타임에 설정 파일만 바꿔도 연결되지 않는다.

```text
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`@supabase/supabase-js`는 2.117.2로 고정. 로컬 README 및 v2 공식 문서를 기준으로 사용했다. 정확히 2.117.2만의 독립 설명서는 확인하지 않았다. **service_role, sb_secret, AI 키를 NEXT_PUBLIC에 절대 넣지 않는다.** 브라우저 검사는 잘못된 키의 번들 노출을 복구해 주지 않는다. 실수로 빌드했다면 키 폐기·재발급과 번들 제거가 필요하다.

## 운영자 검수
- 브라우저 사용자는 자기 pending 제출 생성/조회/삭제만 가능. 직접 승인·수정 불가. 공개 feed는 승인 필드만 보여주는 의도적인 definer view이며 owner_id/운영자 메모는 제외한다. 뷰 컬럼/조건 변경은 별도 보안 검토 대상이다.
- 운영자는 서버 관리 도구/SQL에서 사진권리·인물 없음·민감종·텍스트 개인정보·생물명·금지 효능 주장을 직접 확인한다. 승인할 때 status=approved와 approved_at을 함께 설정한다. 키를 브라우저로 전달하지 않는다.
- 정밀 좌표와 격자는 전송하지 않는다. 지역명도 첫 연결에서는 제외한다. 메모/사진에 들어간 개인정보는 자동 탐지한다고 보장하지 않는다.
- 사진은 작은 파일럿에서 DB 행에 포함한다. 사용자당 대기 10개/총 100개 상한이 있으나 계정 생성·삭제에 대한 전체 비용 방어는 아니다. 광범위 공개 전 서버 요청 속도/전역 예산/신고·계정 삭제·보관 기간/사진 바이트 검사 및 Storage 전환을 추가 검증한다.
- 서버 제출 철회는 서버 사본만 삭제한다. 로컬 원본은 남는다. 내 기기에서 사진을 삭제해도 서버 제출이 자동 삭제되지는 않는다. 이미 다운로드한 제3자 사본까지 회수할 수는 없다.
- 좋아요·월간 자동 편찬은 여전히 예시/미연결이다. 이번 연결은 회원·제출·검수·승인 피드 범위다.

공식 문서: https://supabase.com/docs/guides/database/postgres/row-level-security · https://supabase.com/docs/guides/auth/auth-email-passwordless · https://supabase.com/docs/guides/getting-started/api-keys
