# Automated Dev Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full requirements-to-production automated workflow using Orchestrator session + subagents + GitHub Actions CI/CD with 4 human approval gates.

**Architecture:** Main Claude Code session (orchestrator) manages state via GitHub Issue labels, dispatches impl-subagent (code) and verify-subagent (E2E on staging) via Agent tool. GitHub Actions handles test/build/deploy pipelines. Superpowers skills provide discipline to each local skill.

**Tech Stack:** Claude Code (Agent tool), GitHub Actions, GitHub Environments (staging/production), Docker Compose, pnpm/Turborepo, Playwright E2E, Anthropic API (curl in CI)

---

## Scope Note

This plan has 3 independent phases. Each phase produces working, verifiable output. Implement in order — later phases depend on earlier ones.

- **Phase 1 (Tasks 1–4):** GitHub infrastructure — labels, docker-compose-staging, deploy.yml split, issue-intake.yml
- **Phase 2 (Task 5):** ai-review.yml Layer 2 enhancement
- **Phase 3 (Tasks 6–7):** Local skill updates — orchestrator + Superpowers integration in s1-s5

---

## File Map

### Created
- `docker-compose.staging.yml` — staging services (ports 4000/4001)
- `.github/workflows/issue-intake.yml` — PRD draft on Issue creation
- `.claude/skills/orchestrator/SKILL.md` — main orchestration skill

### Modified
- `docker-compose.prod.yml` — update ports to 4010/4011
- `.github/workflows/deploy.yml` — add deploy-staging job, production uses new ports
- `.github/workflows/ai-review.yml` — add Layer 2 design-intent review
- `.claude/skills/s1-requirements/SKILL.md` — add superpowers:brainstorming call
- `.claude/skills/s2-design/SKILL.md` — add superpowers:writing-plans call
- `.claude/skills/s3-implement/SKILL.md` — add superpowers:test-driven-development + using-git-worktrees
- `.claude/skills/s4-test/SKILL.md` — add superpowers:verification-before-completion
- `.claude/skills/s5-deploy/SKILL.md` — add superpowers:finishing-a-development-branch

### Not Touched
- `.github/workflows/test.yml` — no changes needed
- `.github/workflows/danger-detection.yml` — no changes needed
- `apps/**`, `packages/**` — business code out of scope

---

## Phase 1: GitHub Infrastructure

### Task 1: Create GitHub Issue Labels

**Files:**
- No file changes — uses `gh` CLI only

- [ ] **Step 1: Create all workflow labels**

```bash
gh label create "feature" --color "0075ca" --description "New feature request" || true
gh label create "bug-fix" --color "d73a4a" --description "Bug fix" || true
gh label create "workflow:s1-prd" --color "e4e669" --description "Workflow: PRD stage" || true
gh label create "workflow:s2-design" --color "e4e669" --description "Workflow: Design stage" || true
gh label create "workflow:s3-impl" --color "fbca04" --description "Workflow: Implementation stage" || true
gh label create "workflow:s3-fix" --color "fbca04" --description "Workflow: Bug fix implementation" || true
gh label create "workflow:s4-verify" --color "0e8a16" --description "Workflow: Verification stage" || true
gh label create "workflow:s5-deploy" --color "0e8a16" --description "Workflow: Deploying" || true
gh label create "workflow:done" --color "6f42c1" --description "Workflow: Complete" || true
```

- [ ] **Step 2: Verify labels created**

```bash
gh label list --limit 20
```

Expected: all 9 labels appear in the list.

- [ ] **Step 3: Commit**

```bash
# No files to commit — labels are on GitHub
echo "Labels created on GitHub — no local commit needed"
```

---

### Task 2: Docker Compose Staging + Production Port Fix

**Files:**
- Create: `docker-compose.staging.yml`
- Modify: `docker-compose.prod.yml` (ports 3000/3001 → 4010/4011)

- [ ] **Step 1: Create docker-compose.staging.yml**

```bash
cat > docker-compose.staging.yml << 'EOF'
version: '3.9'

# Staging compose: uses pre-built GHCR images (set API_IMAGE, WORKER_IMAGE, WEB_IMAGE before running)
# Ports: web=4000, api=4001
# Run with: docker compose -p ai-3d-staging -f docker-compose.staging.yml --env-file .env.images up -d

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    image: ${API_IMAGE}
    restart: unless-stopped
    ports:
      - '4001:3001'
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - NODE_ENV=staging
    env_file:
      - .env
    volumes:
      - storage_staging:/app/apps/api/storage
    depends_on:
      redis:
        condition: service_healthy

  worker:
    image: ${WORKER_IMAGE}
    restart: unless-stopped
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - NODE_ENV=staging
    env_file:
      - .env
    volumes:
      - storage_staging:/api/storage
    depends_on:
      redis:
        condition: service_healthy

  web:
    image: ${WEB_IMAGE}
    restart: unless-stopped
    ports:
      - '4000:3000'
    environment:
      - NODE_ENV=staging
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:4001}
    depends_on:
      - api

volumes:
  storage_staging:
EOF
```

- [ ] **Step 2: Validate staging compose syntax**

```bash
docker compose -f docker-compose.staging.yml config --quiet && echo "VALID" || echo "INVALID"
```

Expected: `VALID`

- [ ] **Step 3: Update production ports in docker-compose.prod.yml**

Change `ports` in `api` service from `3001:3001` to `4011:3001`, and `web` service from `3000:3000` to `4010:3000`.

Edit `docker-compose.prod.yml`:
```yaml
  api:
    # ...
    ports:
      - '4011:3001'    # was 3001:3001

  web:
    # ...
    ports:
      - '4010:3000'    # was 3000:3000
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:4011}  # was 3001
```

- [ ] **Step 4: Validate prod compose syntax**

```bash
docker compose -f docker-compose.prod.yml config --quiet && echo "VALID" || echo "INVALID"
```

Expected: `VALID`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.staging.yml docker-compose.prod.yml
git commit -m "feat: add staging compose (4000/4001) and update prod ports (4010/4011)"
```

---

### Task 3: issue-intake.yml (New Workflow)

**Files:**
- Create: `.github/workflows/issue-intake.yml`

- [ ] **Step 1: Create issue-intake.yml**

```bash
cat > .github/workflows/issue-intake.yml << 'EOF'
name: Issue Intake

on:
  issues:
    types: [opened, labeled]

jobs:
  intake:
    runs-on: ubuntu-latest
    if: |
      contains(github.event.issue.labels.*.name, 'feature') ||
      contains(github.event.issue.labels.*.name, 'bug-fix')
    permissions:
      issues: write

    steps:
      - name: Determine issue type
        id: type
        run: |
          LABELS='${{ toJson(github.event.issue.labels.*.name) }}'
          if echo "$LABELS" | grep -q '"feature"'; then
            echo "type=feature" >> $GITHUB_OUTPUT
            echo "workflow_label=workflow:s1-prd" >> $GITHUB_OUTPUT
          else
            echo "type=bug-fix" >> $GITHUB_OUTPUT
            echo "workflow_label=workflow:s3-fix" >> $GITHUB_OUTPUT
          fi

      - name: Generate AI draft
        id: draft
        run: |
          ISSUE_TITLE="${{ github.event.issue.title }}"
          ISSUE_BODY="${{ github.event.issue.body }}"
          ISSUE_TYPE="${{ steps.type.outputs.type }}"

          if [ "$ISSUE_TYPE" = "feature" ]; then
            PROMPT="You are a product analyst. Based on the following GitHub Issue, generate a concise PRD draft in Chinese. Include: 一句话描述, 用户流程 (3-5 steps), MVP范围 (bullet list), 验收标准 (bullet list), 明确不做 (at least 2 items). Keep it under 400 words.\n\nIssue Title: $ISSUE_TITLE\n\nIssue Body:\n$ISSUE_BODY"
          else
            PROMPT="You are a senior engineer doing bug triage. Based on the following GitHub Issue, generate a bug analysis draft in Chinese. Include: 问题描述, 可能根因 (2-3 candidates), 复现步骤, 修复建议, 回归测试要点. Keep it under 300 words.\n\nIssue Title: $ISSUE_TITLE\n\nIssue Body:\n$ISSUE_BODY"
          fi

          RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
            -H "x-api-key: ${{ secrets.ANTHROPIC_API_KEY }}" \
            -H "anthropic-version: 2023-06-01" \
            -H "content-type: application/json" \
            -d "$(jq -n --arg prompt "$PROMPT" '{
              model: "claude-opus-4-6",
              max_tokens: 1024,
              messages: [{"role": "user", "content": $prompt}]
            }')")

          DRAFT=$(echo "$RESPONSE" | jq -r '.content[0].text // "AI draft unavailable: " + .error.message')
          echo "draft<<EOF" >> $GITHUB_OUTPUT
          echo "$DRAFT" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Post draft comment
        uses: actions/github-script@v7
        env:
          DRAFT: ${{ steps.draft.outputs.draft }}
          ISSUE_TYPE: ${{ steps.type.outputs.type }}
        with:
          script: |
            const type = process.env.ISSUE_TYPE;
            const draft = process.env.DRAFT;
            const icon = type === 'feature' ? '📋' : '🐛';
            const label = type === 'feature' ? 'PRD 草稿' : 'Bug 分析草稿';
            const body = `## ${icon} AI ${label}\n\n${draft}\n\n---\n> 🤖 由 AI 自动生成。请在主 Orchestrator session 中确认后继续。\n> 运行 \`/orchestrator\` 并输入 \`resume\` 来恢复此 Issue 的工作流。`;
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });

      - name: Add workflow label
        uses: actions/github-script@v7
        env:
          WORKFLOW_LABEL: ${{ steps.type.outputs.workflow_label }}
        with:
          script: |
            await github.rest.issues.addLabels({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              labels: [process.env.WORKFLOW_LABEL]
            });
EOF
```

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/issue-intake.yml'))" && echo "VALID" || echo "INVALID"
```

Expected: `VALID`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/issue-intake.yml
git commit -m "feat: add issue-intake workflow — AI draft on issue open"
```

---

### Task 4: deploy.yml — Add Staging Job

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Replace deploy.yml with staging + production split**

Write the complete new `deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches:
      - master
    tags:
      - 'v*.*.*'
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository_owner }}/ai-3d-platform

jobs:
  build-and-push:
    name: Build & Push Images
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & push api
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-api:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build & push worker
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/worker/Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-worker:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build & push web
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-web:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Staging
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy staging via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.APP_SERVER_HOST }}
          username: ${{ secrets.APP_SERVER_USER }}
          key: ${{ secrets.APP_SERVER_SSH_KEY }}
          script: |
            cd ${{ secrets.APP_DEPLOY_PATH }}
            git pull origin master

            cat > .env.images << IMGEOF
            API_IMAGE=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-api:${{ github.sha }}
            WORKER_IMAGE=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-worker:${{ github.sha }}
            WEB_IMAGE=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-web:${{ github.sha }}
            IMGEOF

            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker compose -p ai-3d-staging -f docker-compose.staging.yml --env-file .env.images pull
            docker compose -p ai-3d-staging -f docker-compose.staging.yml --env-file .env.images up -d --remove-orphans --force-recreate

            sleep 15
            curl -f http://localhost:4001/health || (docker compose -p ai-3d-staging -f docker-compose.staging.yml logs api && exit 1)
            curl -f http://localhost:4000 > /dev/null || (docker compose -p ai-3d-staging -f docker-compose.staging.yml logs web && exit 1)

            echo "Staging deploy OK: ${{ github.sha }}"

  deploy-production:
    name: Deploy to Production
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy production via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.APP_SERVER_HOST }}
          username: ${{ secrets.APP_SERVER_USER }}
          key: ${{ secrets.APP_SERVER_SSH_KEY }}
          script: |
            cd ${{ secrets.APP_DEPLOY_PATH }}
            git pull origin master

            cat > .env.images << IMGEOF
            API_IMAGE=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-api:${{ github.sha }}
            WORKER_IMAGE=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-worker:${{ github.sha }}
            WEB_IMAGE=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-web:${{ github.sha }}
            IMGEOF

            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker compose -f docker-compose.prod.yml --env-file .env.images pull
            docker compose -f docker-compose.prod.yml --env-file .env.images up -d --remove-orphans --force-recreate

            sleep 15
            curl -f http://localhost:4011/health || (docker compose -f docker-compose.prod.yml --env-file .env.images logs api && exit 1)
            curl -f http://localhost:4010 > /dev/null || (docker compose -f docker-compose.prod.yml --env-file .env.images logs web && exit 1)

            echo "Production deploy OK: ${{ github.sha }}"
```

Save this as `.github/workflows/deploy.yml` (replace the existing file).

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo "VALID" || echo "INVALID"
```

Expected: `VALID`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: split deploy into staging (4000/4001) + production (4010/4011) with approval gate"
```

---

## Phase 2: AI Review Enhancement

### Task 5: ai-review.yml — Layer 2 Design-Intent Review

**Files:**
- Modify: `.github/workflows/ai-review.yml`

- [ ] **Step 1: Replace ai-review.yml with two-layer version**

Write the complete new `ai-review.yml`:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ai-code-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get PR diff
        run: |
          git fetch origin ${{ github.base_ref }}
          git diff origin/${{ github.base_ref }}...HEAD > /tmp/pr.diff

      - name: Detect if feature PR (has workflow label)
        id: detect
        uses: actions/github-script@v7
        with:
          result-encoding: string
          script: |
            const pr = await github.rest.pulls.get({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number
            });
            const body = pr.data.body || '';
            const issueMatch = body.match(/#(\d+)/);
            if (!issueMatch) return 'false';
            const issue = await github.rest.issues.get({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: parseInt(issueMatch[1])
            });
            const labels = issue.data.labels.map(l => l.name);
            const isFeature = labels.some(l => l === 'feature');
            if (isFeature) {
              core.exportVariable('ISSUE_NUMBER', issueMatch[1]);
            }
            return isFeature ? 'true' : 'false';

      - name: Get linked issue body (feature PRs only)
        id: issue_body
        if: steps.detect.outputs.result == 'true'
        uses: actions/github-script@v7
        with:
          result-encoding: string
          script: |
            const issue = await github.rest.issues.get({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: parseInt(process.env.ISSUE_NUMBER)
            });
            const comments = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: parseInt(process.env.ISSUE_NUMBER)
            });
            const prdComment = comments.data.find(c => c.body.includes('AI PRD 草稿') || c.body.includes('PRD 草稿'));
            return prdComment ? prdComment.body.substring(0, 2000) : issue.data.body.substring(0, 2000);

      - name: Layer 1 — General code review
        id: layer1
        run: |
          DIFF=$(cat /tmp/pr.diff | head -c 12000)
          RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
            -H "x-api-key: ${{ secrets.ANTHROPIC_API_KEY }}" \
            -H "anthropic-version: 2023-06-01" \
            -H "content-type: application/json" \
            -d "$(jq -n --arg diff "$DIFF" '{
              model: "claude-opus-4-6",
              max_tokens: 1024,
              messages: [{
                role: "user",
                content: ("Review this PR diff. Focus on:\n1. Code quality and correctness\n2. API contract violations (see docs/03_api_contract.md)\n3. Security issues (auth, input validation, secrets exposure)\n4. Provider isolation violations (apps/worker/src/providers/)\n5. Breaking changes to shared types (packages/shared/)\nBe concise and actionable.\n\nDiff:\n" + $diff)
              }]
            }')")
          TEXT=$(echo "$RESPONSE" | jq -r '.content[0].text // "Layer 1 review unavailable"')
          echo "text<<EOF" >> $GITHUB_OUTPUT
          echo "$TEXT" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Layer 2 — Design intent review (feature PRs only)
        id: layer2
        if: steps.detect.outputs.result == 'true'
        run: |
          DIFF=$(cat /tmp/pr.diff | head -c 10000)
          PRD="${{ steps.issue_body.outputs.result }}"
          RESPONSE=$(curl -s https://api.anthropic.com/v1/messages \
            -H "x-api-key: ${{ secrets.ANTHROPIC_API_KEY }}" \
            -H "anthropic-version: 2023-06-01" \
            -H "content-type: application/json" \
            -d "$(jq -n --arg diff "$DIFF" --arg prd "$PRD" '{
              model: "claude-opus-4-6",
              max_tokens: 1024,
              messages: [{
                role: "user",
                content: ("You are reviewing whether a PR implementation matches its design intent.\n\nPRD/Issue Requirements:\n" + $prd + "\n\nPR Diff:\n" + $diff + "\n\nCheck:\n1. Does the implementation cover all requirements in the PRD?\n2. Are there features implemented that were explicitly out-of-scope?\n3. Do acceptance criteria appear to be met?\n4. Any significant gaps between design and implementation?\n\nBe concise. List gaps as bullet points.")
              }]
            }')")
          TEXT=$(echo "$RESPONSE" | jq -r '.content[0].text // "Layer 2 review unavailable"')
          echo "text<<EOF" >> $GITHUB_OUTPUT
          echo "$TEXT" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Post review comments
        uses: actions/github-script@v7
        env:
          LAYER1: ${{ steps.layer1.outputs.text }}
          LAYER2: ${{ steps.layer2.outputs.text }}
          IS_FEATURE: ${{ steps.detect.outputs.result }}
        with:
          script: |
            const layer1 = process.env.LAYER1;
            const layer2 = process.env.LAYER2;
            const isFeature = process.env.IS_FEATURE === 'true';
            let body = `## 🤖 AI Code Review\n\n### Layer 1 — Code Quality\n\n${layer1}`;
            if (isFeature && layer2) {
              body += `\n\n### Layer 2 — Design Intent\n\n${layer2}`;
            }
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
```

- [ ] **Step 2: Validate YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ai-review.yml'))" && echo "VALID" || echo "INVALID"
```

Expected: `VALID`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ai-review.yml
git commit -m "feat: add Layer 2 design-intent review to ai-review workflow"
```

---

## Phase 3: Local Skills

### Task 6: Orchestrator Skill

**Files:**
- Create: `.claude/skills/orchestrator/SKILL.md`

- [ ] **Step 1: Create orchestrator skill directory and SKILL.md**

```bash
mkdir -p .claude/skills/orchestrator
```

Write `.claude/skills/orchestrator/SKILL.md`:

```markdown
---
name: orchestrator
description: >
  主编排 session。管理所有 feature/bug-fix 的开发工作流状态机。
  扫描 GitHub Issues，恢复进行中的工作流，在审批门暂停等待用户确认，
  用 Agent tool 派发 impl-subagent 和 verify-subagent。
  当用户说"启动工作流"、"resume"、"orchestrator"时触发。
context: fork
allowed-tools: Bash, Agent, Skill, Read
---

# Orchestrator — 工作流编排主 Session

## 核心规则

- **不读代码文件**，不调用 Write/Edit tool
- **不直接实现代码**，所有实现通过 Agent tool 派发
- **Context 保持轻量**：只读 GitHub 状态 + 用户对话 + subagent 摘要
- 每次推进状态后，用 `gh issue edit` 更新 label

## 启动流程

### 1. 扫描进行中的 Issues

```bash
gh issue list --label "workflow:s1-prd" --state open --json number,title,labels
gh issue list --label "workflow:s2-design" --state open --json number,title,labels
gh issue list --label "workflow:s3-impl" --state open --json number,title,labels
gh issue list --label "workflow:s3-fix" --state open --json number,title,labels
gh issue list --label "workflow:s4-verify" --state open --json number,title,labels
gh issue list --label "workflow:s5-deploy" --state open --json number,title,labels
```

向用户展示所有进行中的 issues 及其当前阶段。
询问用户："要继续哪个 Issue？或者输入新的 Issue 编号。"

### 2. 判断 Issue 类型和阶段

```bash
gh issue view {issue_id} --json title,body,labels,comments
```

根据 label 判断当前阶段，执行对应的阶段处理器（见下方）。

---

## 阶段处理器

### S1: PRD 阶段（Feature only）

**触发条件**：label = `workflow:s1-prd`

**执行**：
```bash
# 读取 AI 草稿（issue 的第一条 bot comment）
gh issue view {issue_id} --comments --json comments
```

调用本地 s1-requirements skill（含 Superpowers:brainstorming）精化 PRD：
```
Skill s1-requirements {issue_id}
```

**[GATE 1]** 向用户展示 PRD 摘要：
```
=== PRD 确认 (Issue #{issue_id}) ===
{prd_summary}

请确认后输入 "approve" 继续到架构设计阶段。
或者提出修改意见，我会调整后再次呈现。
```

**用户 approve 后**：
```bash
gh issue edit {issue_id} --remove-label "workflow:s1-prd" --add-label "workflow:s2-design"
```

---

### S2: 设计阶段（Feature only）

**触发条件**：label = `workflow:s2-design`

**执行**：调用 s2-design skill：
```
Skill s2-design
```

**[GATE 2]** 向用户展示设计摘要：
```
=== 架构设计确认 (Issue #{issue_id}) ===
{design_summary}

请确认后输入 "approve" 继续到实现阶段。
```

**用户 approve 后**：
```bash
gh issue edit {issue_id} --remove-label "workflow:s2-design" --add-label "workflow:s3-impl"
```

---

### S3: 实现阶段

**触发条件**：label = `workflow:s3-impl` 或 `workflow:s3-fix`

**执行**：确定 branch 名：
- Feature: `feature/issue-{id}-{title-slug}`
- Bug fix: `fix/issue-{id}-{title-slug}`

用 Agent tool 派发 impl-subagent：

```
派发 impl-subagent，传入以下上下文：

Issue ID: {issue_id}
Issue Title: {title}
Type: feature | bug-fix
Branch: {branch_name}
Design docs: docs/02_architecture.md (feature) | issue body (bug-fix)

impl-subagent 任务：
1. 调用 superpowers:using-git-worktrees 创建 worktree
2. 调用 superpowers:test-driven-development 进行 TDD 实现
   - 内部调用本地 s3-implement skill
3. pnpm test 全绿
4. git push {branch_name}
5. gh pr create --body "Closes #{issue_id}" --title "{title}"
6. 调用 superpowers:requesting-code-review 规范 PR 描述
7. 返回：PR URL、commit SHA、测试通过数、变更文件列表
```

收到 impl-subagent 结果后，向用户展示：
```
=== 实现完成 (Issue #{issue_id}) ===
PR: {pr_url}
Commit: {sha}
测试: {pass_count} passed
变更文件: {file_list}

CI 正在运行，请等待结果...
```

轮询 CI 状态：
```bash
gh pr checks {pr_number} --watch
```

**[GATE 3]** CI 全绿后通知用户：
```
=== PR 等待 Review (Issue #{issue_id}) ===
PR #{pr_number}: {pr_url}

AI Review 和安全扫描已完成。
请在 GitHub 上 review 并 merge PR。
merge 后我会自动继续。
```

等待 PR merge（轮询）：
```bash
# 每 60 秒检查一次
gh pr view {pr_number} --json mergedAt,state
```

---

### S4: 验证阶段

**触发条件**：PR 已 merge 到 master

**等待 staging 部署完成**：
```bash
gh run list --workflow=deploy.yml --limit=1 --json status,conclusion,jobs
# 等待 deploy-staging job 完成
```

用 Agent tool 派发 verify-subagent：

```
派发 verify-subagent，传入以下上下文：

Issue ID: {issue_id}
Merge SHA: {sha}
Staging URL: http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4000
Staging API URL: http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4001

verify-subagent 任务：
1. 调用 superpowers:verification-before-completion
2. 对 staging 跑 E2E：BASE_URL=http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4000 pnpm test:web:smoke
3. 检查 GitHub Actions build 状态
4. 调用本地 s4-test skill 生成报告
5. 返回：pass/fail/skip 数量、ready_for_deploy (bool)、失败详情
```

**[GATE 4]** 收到 verify-subagent 结果后：
```
=== Staging 验证报告 (Issue #{issue_id}) ===
通过: {pass} | 失败: {fail} | 跳过: {skip}
状态: {'✅ 可以部署' if ready_for_deploy else '❌ 有失败项'}

{failure_details if any}

输入 "deploy" 触发生产部署（需要在 GitHub 上点击 approve）。
```

**用户输入 "deploy"**：
```bash
gh issue edit {issue_id} --remove-label "workflow:s4-verify" --add-label "workflow:s5-deploy"
```

提示用户去 GitHub Actions 页面点击 approve：
```
请前往以下链接批准生产部署：
https://github.com/yukunchen/ai-3d-platform/actions
找到最新的 Deploy workflow，在 "Deploy to Production" job 点击 "Review deployments"。
```

---

### S5: 部署完成

**触发条件**：production deploy job 完成

等待 production deploy：
```bash
gh run list --workflow=deploy.yml --limit=1 --json status,conclusion
```

完成后：
```bash
gh issue edit {issue_id} --remove-label "workflow:s5-deploy" --add-label "workflow:done"
gh issue close {issue_id} --comment "✅ 已部署到生产环境。Commit: {sha}"
```

向用户展示：
```
=== 部署完成 (Issue #{issue_id}) ===
生产环境: http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4010
Issue #{issue_id} 已关闭。
```

---

## 错误处理

- **impl-subagent 失败**：展示错误摘要，询问用户："重试还是手动处理？"
- **verify-subagent 发现失败**：展示失败详情，不继续部署，等待用户决定
- **CI 失败**：展示失败的 check 链接，等待用户修复后重试
- **用户提修改意见（非 approve）**：将意见传给对应的 skill 重新执行
```

- [ ] **Step 2: Verify skill file is valid markdown**

```bash
python3 -c "
with open('.claude/skills/orchestrator/SKILL.md') as f:
    content = f.read()
assert content.startswith('---'), 'Missing frontmatter'
assert 'name: orchestrator' in content, 'Missing name'
assert 'allowed-tools' in content, 'Missing allowed-tools'
print('VALID')
"
```

Expected: `VALID`

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/orchestrator/SKILL.md
git commit -m "feat: add orchestrator skill — main workflow coordination session"
```

---

### Task 7: Update s1–s5 Skills with Superpowers Integration

**Files:**
- Modify: `.claude/skills/s1-requirements/SKILL.md`
- Modify: `.claude/skills/s2-design/SKILL.md`
- Modify: `.claude/skills/s3-implement/SKILL.md`
- Modify: `.claude/skills/s4-test/SKILL.md`
- Modify: `.claude/skills/s5-deploy/SKILL.md`

- [ ] **Step 1: Update s1-requirements/SKILL.md**

Add Superpowers call at the top of the execution steps section. Insert after the frontmatter header block, before `### 1. Obsidian 上下文聚合`:

```markdown
## Superpowers 框架

在开始需求分析前，调用需求分析思维框架：
```
Skill superpowers:brainstorming
```
Superpowers:brainstorming 提供结构化需求挖掘纪律。
本 skill 负责项目特定部分：Obsidian 集成、wikilink 解析、PRD 输出格式。
```

- [ ] **Step 2: Update s2-design/SKILL.md**

Add after frontmatter, before `## 输入`:

```markdown
## Superpowers 框架

在开始架构设计前，调用规划框架：
```
Skill superpowers:writing-plans
```
Superpowers:writing-plans 提供架构分解和计划纪律。
本 skill 负责项目特定部分：API 契约格式、3D pipeline 设计、dev_plan 结构。
```

- [ ] **Step 3: Update s3-implement/SKILL.md**

Add after frontmatter, before `## 输入`:

```markdown
## Superpowers 框架

在开始编码前，调用 worktree 管理和 TDD 纪律：
```
Skill superpowers:using-git-worktrees
Skill superpowers:test-driven-development
```
- `superpowers:using-git-worktrees`：管理 feature worktree 的创建和隔离
- `superpowers:test-driven-development`：强制先写失败测试再实现的纪律
本 skill 负责项目特定部分：pnpm 测试命令、步骤验证逻辑、commit 策略。
```

- [ ] **Step 4: Create s4-test/SKILL.md (currently missing)**

```bash
mkdir -p .claude/skills/s4-test
cat > .claude/skills/s4-test/SKILL.md << 'EOF'
---
name: s4-test
description: >
  运行全量测试，分析失败，自动修复，生成测试报告。
  在 staging 环境跑 E2E 验证。
  当用户提到"运行测试"、"验证"、"E2E"时触发。
allowed-tools: Bash, Read, Write, Glob, Grep
---

# Stage 4: 测试验证

## Superpowers 框架

在开始验证前，调用验收纪律框架：
```
Skill superpowers:verification-before-completion
```
本 skill 负责项目特定部分：pnpm 测试命令、Playwright E2E、staging URL、测试报告格式。

## 输入

- Staging URL: `http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4000`
- Staging API URL: `http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4001`

## 执行步骤

### 1. 单元 + 集成测试

```bash
pnpm test
```

如果有失败：
- 读取错误信息
- 定位根因
- 修复（最多 3 轮）
- 若仍失败：记录并报告，不继续

### 2. E2E 测试（Staging）

```bash
BASE_URL=http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4000 \
  pnpm test:web:smoke
```

### 3. 生成测试报告

输出格式：
```
## 测试报告
- 单元/集成: {pass} passed, {fail} failed, {skip} skipped
- E2E (staging): {pass} passed, {fail} failed
- Ready for deploy: YES / NO
- 失败详情: {details if any}
```

## 质量标准

- 所有单元测试通过才能输出 Ready for deploy: YES
- E2E 至少有 1 个测试通过（smoke test）
- 报告中列出所有失败项的文件和行号
EOF
```

- [ ] **Step 5: Update s5-deploy/SKILL.md**

Replace the existing content with:

```markdown
---
name: s5-deploy
description: >
  将已测试通过的代码部署到生产环境。
  包含 git push、CI 验证、部署执行。
disable-model-invocation: true
allowed-tools: Bash, Read, Write
---

# Stage 5: 部署上线

## Superpowers 框架

在执行部署前，调用收尾纪律框架：
```
Skill superpowers:finishing-a-development-branch
```
本 skill 负责项目特定部分：Docker/SSH 部署脚本、GitHub Actions 触发、健康检查。

## 前置检查

- 确认本地测试全绿: `pnpm test`
- 确认在 master 分支: `git branch --show-current`

## 执行步骤

1. **推送代码**（如果还未 push）
   ```bash
   git push origin master
   ```

2. **等待 CI + Staging 部署**
   ```bash
   gh run list --workflow=deploy.yml --limit=1 --json status,conclusion,databaseId
   gh run watch {run_id}
   ```
   等待 `deploy-staging` job 完成。

3. **等待 Production 审批**
   生产部署需要在 GitHub Actions 页面手动 approve。
   提示用户前往审批。

4. **等待 Production 部署**
   ```bash
   gh run watch {run_id}
   ```

5. **健康检查**
   ```bash
   curl -f http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4011/health
   curl -f http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4010
   ```

6. **输出部署报告**
   - Commit SHA
   - 部署时间
   - Production URL: http://ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4010
```

- [ ] **Step 6: Verify all skill files have superpowers references**

```bash
echo "=== s1 ===" && grep -l "superpowers" .claude/skills/s1-requirements/SKILL.md
echo "=== s2 ===" && grep -l "superpowers" .claude/skills/s2-design/SKILL.md
echo "=== s3 ===" && grep -l "superpowers" .claude/skills/s3-implement/SKILL.md
echo "=== s4 ===" && grep -l "superpowers" .claude/skills/s4-test/SKILL.md
echo "=== s5 ===" && grep -l "superpowers" .claude/skills/s5-deploy/SKILL.md
```

Expected: all 5 lines print the file path (no empty output).

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/s1-requirements/SKILL.md \
        .claude/skills/s2-design/SKILL.md \
        .claude/skills/s3-implement/SKILL.md \
        .claude/skills/s4-test/ \
        .claude/skills/s5-deploy/SKILL.md
git commit -m "feat: integrate superpowers skills into s1-s5 as framework layer"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Feature workflow: S1→S2→S3→S4→S5 | Task 6 (orchestrator) |
| Bug fix workflow: S3→S4→S5 | Task 6 (orchestrator) |
| 4 human gates (feature) | Task 6 (orchestrator: Gate 1-4) |
| 2 human gates (bug-fix) | Task 6 (orchestrator: Gate 3-4) |
| GitHub Issue labels as state | Task 1 + Task 6 |
| issue-intake.yml | Task 3 |
| deploy.yml staging + production split | Task 4 |
| staging ports 4000/4001 | Task 2 + Task 4 |
| production ports 4010/4011 | Task 2 + Task 4 |
| ai-review Layer 2 | Task 5 |
| orchestrator skill | Task 6 |
| Superpowers in s1-s5 | Task 7 |
| impl-subagent dispatch | Task 6 (orchestrator S3 section) |
| verify-subagent dispatch | Task 6 (orchestrator S4 section) |
| staging E2E URL | Task 7 (s4-test) + Task 6 |

All spec requirements covered. ✅

### Placeholder Scan

No TBD, TODO, or vague steps. All YAML files are complete. All skill files are complete. ✅

### Type Consistency

- Staging URL used consistently: `ec2-184-32-94-23.us-west-2.compute.amazonaws.com:4000` (web) / `:4001` (api)
- Production URL: `:4010` (web) / `:4011` (api)
- Docker project name for staging: `ai-3d-staging` (used in Task 4 and Task 2)
- GitHub label names consistent across Task 1, Task 3, and Task 6 ✅
