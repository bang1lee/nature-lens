# 이메일 가입·로그인 · 2026-11-15

가입과 로그인에 공통 이메일 인증 UI를 연결했다. 서버 메일 템플릿이 준비되기 전에는 기존 매직링크를 그대로 사용한다. `NEXT_PUBLIC_AUTH_OTP_ENABLED=true`는 가입 확인과 Magic Link/OTP 메일 양쪽에서 인증번호 전송이 실제로 준비되었다고 확인한 뒤에만 빌드에 설정한다. 미설정 또는 다른 값이면 번호 입력은 표시되지 않는다.

주 담당자가 실제 Supabase 설정 화면에서 현재 기본 링크 메일을 확인했고, 템플릿 편집에는 custom SMTP 설정이 필요하다는 안내를 확인했다. SMTP나 템플릿은 이 작업에서 바꾸지 않았고, 실제 코드 메일 발송·신규 가입은 검증하지 않았다. 전환 및 롤백 중 기존 앱이 동작하려면 두 템플릿에 `{{ .Token }}`과 기존 `{{ .ConfirmationURL }}`을 함께 유지하는 방안을 확인해야 한다. 코드 로그인은 Supabase의 `signInWithOtp({email, options:{shouldCreateUser:true}})`와 `verifyOtp({email, token, type:'email'})`를 사용하며, 인증 세션이 없는 응답을 성공으로 처리하지 않는다. [공식 OTP 안내](https://supabase.com/docs/guides/auth/auth-email-passwordless)

즉시 확인과 다음날 확인에서 서버가 401을 반환하면 같은 기기 기록을 유지한 채 재로그인을 안내한다. 재인증만으로 식별·예측 사진을 재전송하지 않는다. 공개 별칭은 이메일 계정 생성의 필수 조건이 아니다.

## 로컬 검사

테스트용 이메일·세션·사진과 모의 Supabase를 사용했다. 실제 회원 자격증명이나 사진은 사용하지 않았다.

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Users/light_one/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell' npx playwright test -c otp-auth.playwright.config.ts
npx vitest run tests/cloud-auth.test.ts
npm run typecheck
```

- OTP 모의 브라우저 4/4: 기존 회원 또는 신규 이메일의 번호 인증, 잘못된 번호, 재전송 대기, 시간초과와 중복 요청 방지, 즉시 식별·예측 각각의 401 후 재인증. 예측 내용과 사진은 남고 자동 재전송은 없었다. OTP 화면 axe WCAG 2 A/AA 위반 0.
- 기존 매직링크·PKCE·로그인 복귀 관련 브라우저 8/8, 로그인 쿨다운·지연 및 로그인 상태 4/4, 참여 점수 회원·비회원 2/2, 라벨 반영 후 예측 회귀 3/3, 회원 핵심 여정 1/1. 브라우저들은 로컬 전용 설정과 기존 Chromium 1234를 사용했다.
- UI 단순화 검사 3개 중 첫 실행에서 한 건이 페이지 초기 로딩 시간초과로 실패했고 나머지 두 건은 통과했다. 실패한 한 건을 단독 재실행해 통과했다. 인증 API 단위 4/4, 타입검사 통과.
- `expect-cli`는 Claude 인증이 없어 검사 시작 전 실패했다. 실제 사용자 쿠키는 사용하지 않았다.
