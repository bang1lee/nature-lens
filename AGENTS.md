<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 관찰 흐름 운영

촬영→식별→저장→재관찰 변경은 [운영 계약](docs/integration-20261025/system-20261026/PLAN.md)을 따른다. 최신 Git·코드·설정과 이전 증거를 대조하고 모의/실서비스/배포를 구분한다. 기존 디자인·모델은 사용자 승인 없이 변경하지 않는다. 초기 검사 후 수정 재시도 최대2회, 환경 차단은 독립 작업과 분리한다.

로컬에서는 `/Users/light_one/.codex/skills/agent-system-engineering/SKILL.md`를 읽고 필요한 전문 스킬만 연결한다. 해당 경로가 없는 원격 환경은 위 프로젝트 운영 계약을 사용하며 로컬 스킬을 읽었다고 가정하지 않는다.
