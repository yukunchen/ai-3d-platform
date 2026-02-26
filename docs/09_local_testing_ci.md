# Local Testing and CI

## Local Prerequisites
- Node.js >= 18
- pnpm 8.x

## Install
```bash
pnpm install
```

## Test Commands
- API + Worker:
```bash
pnpm test
```

- Web smoke (Playwright):
```bash
pnpm test:web:smoke
```

- Full local suite:
```bash
pnpm test:all
```

## TDD Step Commands
```bash
pnpm test:tdd:step1
pnpm test:tdd:step2
pnpm test:tdd:step3
pnpm test:tdd:step4
pnpm test:tdd:step5
pnpm test:tdd:step6
```

## CI
- Workflow file: `.github/workflows/test.yml`
- Jobs:
  - `api-worker-tests`: runs `pnpm test`
  - `web-smoke`: installs Playwright Chromium and runs `pnpm test:web:smoke`

## Notes
- In restricted sandboxes, `supertest` may fail with `listen EPERM`. Run tests in a normal local shell or with permission to bind local ephemeral ports.
- Playwright artifacts are ignored by git (`playwright-report`, `test-results`, `.playwright`).
