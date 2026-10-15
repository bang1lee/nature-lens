<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## NatureLens 온디바이스 판별 조사: Claude↔Codex 인계

`docs/research-20261013-seek/`는 Claude (Claude Code, Anthropic) 세션에서 작성했고, Codex와 번갈아 이어 간다.
- 시작 전에 [docs/research-20261013-seek/HANDOFF.md](docs/research-20261013-seek/HANDOFF.md)를 읽는다. 코드·평가 작업의 기준 문서는 `bang1lee/claude-workspace`의 `reverse-engineering/naturelens-seek/HANDOFF.md`다.
- 이 저장소에는 운영 문서만 단방향 발행한다. 판별 코드는 승인 전까지 앱 소스에 넣지 않는다.
- 문서를 고치면 맨 위 `확인 시각`과 작성 에이전트를 갱신하고, 수행한 것과 하지 않은 것을 구분한다.
- 커밋 끝에 작성 에이전트를 밝힌다(Claude: `Co-Authored-By: Claude …`, Codex: `Agent: Codex`). PR 머지와 `main` 직접 푸시는 하지 않는다.
