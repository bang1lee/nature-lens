# NatureLens test deployment and operations

Last checked: 2026-10-09
Repository: `NatureLens/2026_MVP/service`
Branch and source: `main` at `66066410846004adb7fd16c10ec17ee5f09442be` (`fix: keep mobile capture actions in view`)

## Current environment status

There is no verified public QA URL or deployed `nature-lens-test` Worker yet. A read-only Wrangler deployment lookup returned Cloudflare error 10007 (Worker does not exist). The static-assets-only Wrangler dry run succeeded, but the actual public deployment was blocked by the platform's automatic approval review. Do not treat the dry run as a deployment or infer that the live app is available.

The current deployable build is a static export in `out/`. `wrangler.qa.jsonc` serves those assets only; it has no Worker entry script, API route interception, bindings, environment variables, or secrets. The intended hostname, once a deployment is separately authorized and completed, is managed by Cloudflare under `workers.dev`; it has not been assigned or verified.

## What this build can do

The app supports local observation drafts, photos, collections, review state, a journal/board, camera or album capture, JSON backup and restore, and offline shell use after an online load. The mobile capture layout was adjusted so camera and album actions fit in the first view at 390×844 and 320×667.

In this static QA configuration, there is no sign-in, cross-device sync, shared gallery, remote expert-review queue, AI identification service, or observation transfer service. Do not present these as working public features. Use synthetic examples only for QA. Do not enter real personal or sensitive-species observations into an unverified test deployment.

## Data locations and privacy

- Observation records, collections, and photos are stored in the browser's IndexedDB database `nature-lens-v1`, scoped to the app origin and browser profile/device.
- Exact coordinates are kept separately in the `privateLocations` store. The JSON backup excludes those exact coordinates; restores create drafts and skip duplicates.
- Browser storage can be cleared, evicted, or lost with the device/profile. An installed PWA does not guarantee permanent storage or a backup. Export backups and keep them in a user-controlled safe location.
- Static QA has no configured server-side database, R2 bucket, API secret, or remote observation storage. Do not add any without a separate reviewed privacy and cost plan.
- Respect the no-collection approach: record with photos or sound, and avoid disturbing wildlife. Do not reveal precise locations of sensitive species, nests, or den sites. Public map/location views must stay coarse and be checked before any server-backed sharing is enabled.
- Treat automated identification as a candidate suggestion with visible uncertainty, never as a confirmed identification. Preserve a human confirmation step before publication.

## Build and verification evidence

Evidence recorded on 2026-10-09 for commit `66066410846004adb7fd16c10ec17ee5f09442be`:

- `npm run build:cloudflare` completed, including TypeScript checks, and generated `out/`.
- `npx wrangler deploy --dry-run --config wrangler.qa.jsonc --outdir /tmp/naturelens-worker-dry-run` completed. Wrangler read 68 assets; the dry run reported 0.31 KiB total upload (0.22 KiB gzip) and no bindings. This did not publish anything.
- Playwright: 35/35 passed; Vitest: 56/56 passed across 11 files.
- `SMOKE_BASE_PATH='' SMOKE_PORT=3107 npm run test:production` passed for first-visit precache/offline reload, local review/save, PDF rendering, offline camera and persistence, manifest, and zero page errors.
- `git diff --check` passed before commit. These are test/build results, not a live-browser check of a Cloudflare deployment.
- The mobile camera tests use synthetic camera input. They do not establish behavior on a physical iOS device. The 2026-10-08 design audit also noted the landing/navigation mismatch with the supplied plant-exploration reference and the need to check keyboard-safe save reachability on physical mobile devices.

## Main MVP blockers

1. No deployed QA environment is available yet, so there is no live URL, deployed-version smoke test, or end-to-end check against Cloudflare.
2. The static build does not provide remote identification, shared observations, expert review, or cross-device sync. The product's photo → candidate → human confirmation → public gallery flow is therefore not end-to-end available in this QA build.
3. Real-world privacy and operational controls still need a product-level verification pass: consent, moderation/reviewer authority, coarse public location behavior, sensitive-species handling, and mobile keyboard-safe save behavior on physical devices.

## Cost guardrails

This config intentionally publishes static assets without invoking Worker code or binding to a database or object store. Cloudflare documents static asset requests and storage as free under its Workers Static Assets model; Worker requests are separately billed when Worker code runs. Review the live pricing and account plan before enabling any dynamic route or service:

- [Workers Static Assets billing and limits](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)

The account's current plan was not independently verified during this review. No paid upgrade, R2, database, or paid service was configured. Keep `run_worker_first` absent and do not add bindings or dynamic routes to the QA config without a separately reviewed cost and privacy decision.

## Deployment and rollback runbook

Deployment is currently blocked and must not be represented as completed. Once the approval block is cleared through the platform's approval process and the owner authorizes a deployment, use the separate QA config only:

1. Build and review the static output: `npm run build:cloudflare`.
2. Inspect the config and dry run: `npx wrangler deploy --dry-run --config wrangler.qa.jsonc --outdir /tmp/naturelens-worker-dry-run`.
3. Deploy only with the reviewed QA target: `npx wrangler deploy --config wrangler.qa.jsonc`.
4. Record the resulting URL and version ID. Open the URL in a browser and run the deployed smoke checks before sharing it.
5. To roll back a later bad version, use the verified version ID with `npx wrangler rollback <VERSION_ID> --name nature-lens-test`, then re-check the URL. See [Cloudflare rollback guidance](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

For the first deployment there will be no earlier version to roll back to. If the QA service needs to be withdrawn, use Cloudflare's dashboard to disable or remove that separate QA service after confirming its exact identity. Do not modify the production service as part of QA rollback.

## Next smallest verification step

Resolve the platform deployment approval, then deploy this already-built static QA artifact once and verify the returned Cloudflare URL in a real browser. Until then, continue only with local review and synthetic data; no live deployment status or URL is available.

## Local Wrangler QA browser check (2026-10-09)

The static output was served with Wrangler on 127.0.0.1:3107. The existing Playwright suite reused that listener and passed 29/29 tests. The server was stopped after the run. This validates the local static QA build, not a hosted Cloudflare deployment.
