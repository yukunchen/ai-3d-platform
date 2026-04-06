# Current Feature Status

**Branch:** master
**Last updated:** 2026-04-06
**Active Issue:** None (all issues closed)

---

## Completed

### Issue #8 — E2E Real User Data Tests
- PR #9 merged (2026-04-06)
- Real-data E2E tests implemented
- Production E2E config added
- Smoke test fix: async status transition handling

### Infrastructure Update
- Container ports migrated: web 4000, API 4001
- Shared storage volume between API and worker containers
- Next.js server-side rewrite proxy configured for `/storage/*`

---

## Not Done

- Staging environment not yet deployed via CI
- `docker-compose.yml` `version` attribute is obsolete (warning on compose up)

---

## Known Issues / Risks

1. **Node.js 20 deprecation**: `actions/github-script@v7` warns about deprecation, deadline 2026-06-02
2. **Worker volume path inconsistency**: worker mounts `/api/storage` vs api's `/app/apps/api/storage` — pre-existing, resolved via shared named volume

---

## Test Status

| Type | Status | Notes |
|------|--------|-------|
| Unit/Integration | Pass | `pnpm test` — 57 test cases |
| E2E generation | Pass | Text to 3D with Meshy, 1.9 min |
| E2E smoke | Pass | Job submission pipeline, 1.7 sec |
| CI (api-worker-tests) | Pass | GitHub Actions |
| CI (web-smoke) | Pass | GitHub Actions |

---

## Next Steps

1. **Merge PR #10** — port migration and shared storage volume
2. **First staging deployment** — configure staging environment, trigger CI deploy
3. **Production deployment** — verify end-to-end after staging passes
