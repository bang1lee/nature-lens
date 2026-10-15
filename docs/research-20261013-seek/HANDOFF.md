# 인계: 온디바이스 판별 조사 (앱 저장소 쪽)

확인 시각: 2026-10-15 KST. 작성: Claude (Claude Code, Anthropic), 세션 https://claude.ai/code/session_016tEFHCFnPnN22Uk8qh7xwt

이 폴더는 코드 작업의 **발행본**이다. 현재 상태, 할 일, 작업 잡기, 세션별 근거 기록은 아래 저장소에 있다. 그곳이 기준이다.

- 기준 문서: [bang1lee/claude-workspace `reverse-engineering/naturelens-seek/HANDOFF.md`](https://github.com/bang1lee/claude-workspace/blob/re/naturelens-seek-teardown/reverse-engineering/naturelens-seek/HANDOFF.md)
- 작업 규칙: 같은 디렉터리의 `AGENTS.md`
- 세션 기록(근거): 같은 디렉터리의 `handoff/log/`

## 이 저장소에서 할 수 있는 일
| 할 일 | 조건 |
|---|---|
| 조사 문서 갱신(새 실측, 정정) | 근거 커밋을 claude-workspace에 먼저 남기고, 여기에는 요약과 링크만 둔다 |
| 판단 코어를 앱에 넣는 구현 | **사용자 승인 후.** [ONDEVICE-DECISION-CORE.md](ONDEVICE-DECISION-CORE.md) §4의 확인 항목부터 |
| 식별 결과 계약(`src/lib/ai/contract.ts`) 변경 | 승인 후. 기존 Pl@ntNet 흐름과 같이 검증할 것 |

## 문서 이력
| 날짜 | 작성 | 내용 | 커밋 |
|---|---|---|---|
| 10-13 | Claude | 조사 문서 4개, README 링크 | `b2e5726`, `7552b20` |
| 10-15 | Claude | 해안·섬 고도 보정 결과 반영 | `e2f4ded` |
| 10-15 | Claude | 출처 표시, 인계 문서, AGENTS.md 인계 절 | (이 커밋) |
