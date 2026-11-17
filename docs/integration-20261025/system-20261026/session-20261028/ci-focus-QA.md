# CI transfer focus review · 2026-10-28

Base: 927382d. Independent QA; only TransferPanel.tsx changed. No design, model, authentication, environment-file, remote or deployment edits.

## Evidence and limits
- CI run 40536314947: 40/41 E2E passed; transfer.spec.ts:69 failed after deleting the current transfer because `전달 준비` was not focused. CI log supplied by parent at /tmp/nature-lens-ci-40536314947.log.
- Before change: exact failed test passed once locally (ci-focus-before.log), then 5/5 at 2 workers (ci-focus-before-repeat.log). CI timing failure was NOT reproduced locally. Exact CI event ordering remains unproven.
- Inspection: requestAnimationFrame is not a React DOM-commit guarantee. The prior close path could inspect soon-to-be-removed caller/link nodes before state updates replace them; focus restoration also needed to wait for busy=false.
- Change: queue restoration in a ref; resolve the existing candidate order in useLayoutEffect only after dialog state is closed and busy=false. No assertion weakened, no retry added to CI, no data behavior changed.
- After: exact failed test plus older-transfer deletion and deletion-list storage-failure scenarios, each 3 repeats at 2 workers: 9/9 passed (ci-focus-after.log, 20.8s).
- expect-cli attempted without user cookies; blocked by Claude authentication (AcpProviderUnauthenticatedError), not passed (ci-focus-expect.log). No repeated authentication attempt.

## Isolation
Tests used an independent .next-ci-focus output, local mocked API endpoints, and explicit empty public Supabase/identify settings. No environment files read, email sent, or user photos used. Next-generated config additions from this test output were removed selectively. Source fix still requires a fresh remote CI result to establish Linux-runner stability.
