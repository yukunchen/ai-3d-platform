# Current Feature Status

**Branch:** master
**Last updated:** 2026-04-06
**Active Issue:** None (all issues closed)

---

## Completed

### Issue #8 — E2E Real User Data Tests
- PR #9 merged (2026-04-06)
- Real-data E2E tests implemented (`apps/web/tests/real-data-e2e.spec.ts`)
- Production E2E config added (`apps/web/playwright.prod.config.ts`)
- Smoke test configuration fixed to exclude incompatible E2E tests
- Code quality fixes (unused fixture data, timeout config)

### Automated Workflow Infrastructure
- GitHub Issue labels (feature, bug-fix, workflow:s1-prd etc.)
- `.github/workflows/issue-intake.yml` — AI draft on issue open
- `.github/workflows/deploy.yml` — staging (auto) + production (approval gate)
- `.github/workflows/ai-review.yml` — Layer 2 design-intent review
- `.claude/skills/orchestrator/SKILL.md` — main workflow coordination
- s1-s5 skills integrated with Superpowers framework

### Infrastructure Update (this session)
- Meshy API key updated to new key
- Container ports migrated: web 3000→4000, API 3001→4001
- `NEXT_PUBLIC_API_URL` updated to `http://localhost:4001`
- All containers restarted and healthy

---

## Not Done

- Staging environment (`ai-3d-platform-staging`) has no `.env` — never deployed via CI
- Production deployment of Issue #8 code not triggered (PR merged to master but deploy workflow not run)
- Flaky E2E test: UI shows "Processing..." but test expects "queue|Generating"
- `docker-compose.yml` `version` attribute is obsolete (warning on compose up)

---

## Known Issues / Risks

1. **Staging never deployed**: `/home/ubuntu/WS/ai-3d-platform-staging` exists but has no `.env` and containers were never started. First CI deploy needs `.env` in staging directory.
2. **E2E generation test flaky**: `real-data-e2e.spec.ts` AI generation test times out after 5 min — depends on Meshy API responsiveness and correct API key. New key just configured, untested.
3. **Port migration not in master yet**: `docker-compose.yml` port changes (4000/4001) are local only — not committed/pushed. Running containers use new ports but git still has uncommitted changes.
4. **Node.js 20 deprecation**: `actions/github-script@v7` warns about deprecation, deadline 2026-06-02.
5. **Worker volume path inconsistency**: worker mounts `/api/storage` vs api's `/app/apps/api/storage` — pre-existing, not blocking.

---

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Main compose (ports 4000/4001) |
| `.env.local` | Environment variables (Meshy key, JWT, Tencent) |
| `apps/web/tests/real-data-e2e.spec.ts` | Real user data E2E tests |
| `apps/web/playwright.prod.config.ts` | Production E2E test config |
| `.claude/skills/orchestrator/SKILL.md` | Workflow orchestration skill |
| `.github/workflows/deploy.yml` | Staging + Production deploy |

---

## Test Status

| Type | Status | Notes |
|------|--------|-------|
| Unit/Integration | Pass (historical) | `pnpm test` — 57 test cases |
| E2E smoke | Pass | Playwright, non-generation tests pass on 4000 |
| E2E generation | Untested | New Meshy API key just configured, not yet verified |
| CI deploy workflow | Not triggered | Staging/production split never executed end-to-end |

---

## Next Steps

1. **Verify new Meshy API key** — run E2E generation test against `localhost:4000` to confirm AI pipeline works with the new key
2. **Commit port changes** — commit `docker-compose.yml` and `.env.local` updates, push to master
3. **First staging deployment** — copy `.env` to staging directory, trigger CI deploy, verify staging environment end-to-end
