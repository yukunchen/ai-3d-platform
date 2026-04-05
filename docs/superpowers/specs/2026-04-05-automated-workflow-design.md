# 自动化全生命周期开发工作流设计

**日期**: 2026-04-05  
**项目**: ai-3d-platform  
**状态**: 待实施

---

## 1. 概述

本设计描述一套从需求到部署的自动化工作流，涵盖：
- Claude Code 本地 session（Orchestrator + Subagents）
- GitHub Actions CI/CD 流水线
- 4 个人工审批门
- Superpowers skills 作为底层框架

### 两条工作路径

| 路径 | 触发 | 阶段 | 人工审批门 |
|------|------|------|-----------|
| Feature | Issue label: `feature` | S1→S2→S3→S4→S5 | 4 个 |
| Bug Fix | Issue label: `bug-fix` | S3→S4→S5 | 2 个 |

---

## 2. 整体架构

```
                    ┌─────────────────────────────────┐
                    │      GitHub Issue (触发源)        │
                    │  label: feature / bug-fix        │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │    Orchestrator Session (主窗)    │
                    │    orchestrator skill 常驻        │
                    │    事件循环 + 状态机推进            │
                    └──┬──────────────────────────┬───┘
                       │  Agent tool               │  Agent tool
           ┌───────────▼──────┐        ┌──────────▼───────────┐
           │  impl-subagent   │        │  verify-subagent      │
           │  s3-implement    │        │  s4-test              │
           │  独立 context     │        │  独立 context          │
           └──────────────────┘        └──────────────────────┘
                       │                           │
                    ┌──▼───────────────────────────▼───┐
                    │         GitHub                    │
                    │  ├─ Actions (test/build/deploy)   │
                    │  ├─ PR (Gate 3: code review)      │
                    │  ├─ environment: staging          │
                    │  └─ environment: production       │
                    └──────────────────────────────────┘
```

---

## 3. 状态机设计

### 状态存储：GitHub Issue Labels

所有 workflow 状态以 `workflow:` 前缀 label 存储在 GitHub Issue 上。
Orchestrator 启动时扫描所有带 `workflow:` label 的 open issues，无缝恢复状态。
**不依赖本地文件**，换机器重启 Orchestrator 即可恢复。

### Feature 状态机

```
OPEN
  → workflow:s1-prd      [Gate 1: PRD 审批]
  → workflow:s2-design   [Gate 2: 设计审批]
  → workflow:s3-impl
  → PR created + CI green
                         [Gate 3: PR merge（人工 code review）]
  → workflow:s4-verify
  → staging 部署 + E2E 验证
                         [Gate 4: 部署审批]
  → workflow:s5-deploy
  → workflow:done → Issue closed
```

### Bug Fix 状态机

```
OPEN
  → workflow:s3-fix
  → PR created + CI green
                         [Gate 3: PR merge]
  → workflow:s4-verify
  → staging 部署 + E2E 验证
                         [Gate 4: 部署审批]
  → workflow:s5-deploy
  → workflow:done → Issue closed
```

---

## 4. Orchestrator Session（主窗编排层）

### 职责范围
- 扫描 GitHub Issues，恢复进行中的 workflow
- 根据 issue label 判断当前阶段，决定下一步行动
- 在审批门暂停，等待用户确认
- 用 `Agent` tool 派发 impl-subagent / verify-subagent
- 轮询 GitHub Actions 状态（`gh run list`）
- 更新 Issue labels 推进状态

### 四个审批门交互

| 门 | 触发条件 | 主 session 行为 | 用户操作 |
|----|---------|----------------|---------|
| Gate 1 | s1-PRD 完成 | 展示 PRD 摘要，暂停 | 回复 "approve" 或提修改意见 |
| Gate 2 | s2-design 完成 | 展示设计摘要，暂停 | 回复 "approve" 或提修改意见 |
| Gate 3 | CI 全绿 | 提示 PR 待 review，给出 PR 链接 | 在 GitHub 上 merge PR |
| Gate 4 | staging 验证通过 | 展示测试报告，请求部署确认 | 回复 "deploy" + GitHub approve |

### 主 session 保持轻量的规则
- **不读代码文件**，只读状态（GitHub API + labels）
- 所有代码实现、测试执行在 subagent 里完成
- Context 主要是：issue 状态 + 用户对话 + subagent 返回摘要

### 新增 skill 文件
```
.claude/skills/orchestrator/SKILL.md
allowed-tools: Bash, Agent, Skill, Read
(禁止: Write, Edit — 不直接修改代码)
```

---

## 5. 两个 Subagent

### impl-subagent（实现层）

**触发**：Gate 2 通过后，主 session 用 `Agent` tool 派发

**输入**：
- `issue_id`, `issue_title`, `type` (feature/bug-fix)
- 设计文档路径
- target branch 名：`feature/issue-{id}-{slug}` 或 `fix/issue-{id}-{slug}`

**执行流程**：
1. `superpowers:using-git-worktrees` → 创建 worktree + branch
2. `superpowers:test-driven-development` → TDD 实现
   - 内部调用本地 `s3-implement` skill（项目特定逻辑）
3. `pnpm test` 全绿
4. `git commit + push branch`
5. `gh pr create`（关联 issue #id）
6. `superpowers:requesting-code-review` → 规范 PR 描述

**输出给主 session**：PR URL、commit SHA、测试通过数、变更文件摘要

**失败策略**：最多重试 2 次，仍失败则返回错误摘要给主 session，由用户决定

### verify-subagent（验证层）

**触发**：PR merge 到 master + staging 部署完成后，主 session 派发

**输入**：merge commit SHA、issue_id、staging URL

**执行流程**：
1. `superpowers:verification-before-completion` → 验收纪律
2. 对 staging 环境跑 E2E（`pnpm test:web:prod-e2e` 指向 staging URL）
3. 检查 GitHub Actions build 状态
4. 本地 `s4-test` skill → 生成测试报告

**输出给主 session**：pass/fail/skip 数量、是否 ready for deploy、失败详情

**失败策略**：不重试，直接报告，由用户决定是否修复后重新触发

### Subagent Isolation 规则

| | impl-subagent | verify-subagent |
|---|---|---|
| Git 上下文 | feature worktree | master branch（只读）|
| 文件权限 | worktree 内读写 | 只读（不改代码）|
| 失败处理 | 最多重试 2 次 | 不重试，直接上报 |

---

## 6. GitHub Actions 集成

### Workflows 清单

```
.github/workflows/
├── test.yml           ← 保留：PR + push master 触发
├── deploy.yml         ← 增强：staging + production 两个 job
├── ai-review.yml      ← 增强：两层 review（通用 + 设计符合度）
├── danger-detection.yml ← 保留：危险文件三层审查
└── issue-intake.yml   ← 新增：Issue 创建时生成 PRD 草稿
```

### deploy.yml 拆分为两个 job

```yaml
jobs:
  build-and-push:
    # 构建镜像，push 到 GHCR（现有）

  deploy-staging:
    needs: build-and-push
    environment: staging        # 无审批门，自动触发
    # SSH 到 staging server，rolling restart
    # health check

  deploy-production:
    needs: deploy-staging
    environment: production     # 有审批门，触发人工审批
    # SSH 到 production server，rolling restart
    # health check
```

### issue-intake.yml（新增）

```
触发: on: issues: types: [opened, labeled]
条件: label 包含 feature 或 bug-fix

执行:
  1. Claude API 分析 issue body，生成 PRD/Bug 分析草稿
  2. 将草稿作为 bot comment 发到 Issue
  3. 打上 workflow:s1-prd (feature) 或 workflow:s3-fix (bug-fix) label
  4. @mention 用户，提示在主 session 里确认

限制: 只调 Claude API（curl），不运行 Claude Code headless
```

### ai-review.yml 增强

- **Layer 1（所有 PR）**：代码质量、API 契约、breaking changes
- **Layer 2（feature PR）**：对照 Issue 的 PRD 草稿，验证实现符合设计意图
- 两层结果都作为 PR comment，不阻塞 merge（阻塞由 danger-detection 负责）

### 各阶段与 GitHub Actions 关系

| 阶段 | 本地 Claude | GitHub Actions |
|------|------------|----------------|
| S1 PRD | s1-requirements | issue-intake.yml（草稿）|
| S2 Design | s2-design | — |
| S3 Implement | impl-subagent | test.yml + ai-review.yml + danger-detection.yml |
| [Gate 3] | — | PR merge（人工）|
| S4 Verify | verify-subagent | test.yml + deploy-staging |
| [Gate 4] | — | environment: production（人工）|
| S5 Deploy | — | deploy-production |

---

## 7. Superpowers 集成层

### 调用关系

```
本地 skill             Superpowers skill                  职责分工
──────────────────────────────────────────────────────────────────────
orchestrator       ← superpowers:systematic-debugging    遇到阻塞时
                   ← superpowers:dispatching-parallel-agents 并行派发

s1-requirements    ← superpowers:brainstorming            需求分析思维
                     (本地: Obsidian 集成、wikilink 解析)

s2-design          ← superpowers:writing-plans            架构规划框架
                     (本地: API 契约、3D pipeline 设计)

s3-implement       ← superpowers:test-driven-development  TDD 纪律
                   ← superpowers:using-git-worktrees      worktree 管理
                     (本地: 项目测试命令、pnpm 结构)

s4-test            ← superpowers:verification-before-completion 验收纪律
                     (本地: Playwright E2E、staging URL)

s5-deploy          ← superpowers:finishing-a-development-branch 收尾
                     (本地: Docker/SSH 部署脚本)

(PR 创建后)        ← superpowers:requesting-code-review   PR 描述规范
(PR 收到后)        ← superpowers:receiving-code-review    处理 review 意见
```

### pipeline skill 角色

现有 `pipeline` skill 降级为**本地快捷入口**，针对单个 issue 的快速通道，适合不想开 Orchestrator 常驻 session 的场景。与 orchestrator skill 共存，不冲突。

---

## 8. 完整流程走查

### Feature 路径

```
1. GitHub Issue 创建（label: feature）
        ↓
2. issue-intake.yml → PRD 草稿 comment → workflow:s1-prd
        ↓
3. Orchestrator → s1-requirements → 完善 PRD
   [GATE 1] 用户 approve PRD
        ↓
4. workflow:s2-design → s2-design → 架构文档 + API 契约
   [GATE 2] 用户 approve 设计
        ↓
5. workflow:s3-impl → Agent → impl-subagent
   └─ worktree → TDD → push → PR created
        ↓
6. GitHub Actions（PR 事件）
   └─ test.yml + ai-review.yml + danger-detection.yml
   [GATE 3] 用户在 GitHub merge PR
        ↓
7. workflow:s4-verify → deploy-staging（自动）
   → Agent → verify-subagent（E2E on staging）
   [GATE 4] 用户 approve 部署
        ↓
8. workflow:s5-deploy → deploy-production（GitHub approve）
   → Issue closed → workflow:done
```

### Bug Fix 路径

```
1. GitHub Issue 创建（label: bug-fix）
        ↓
2. issue-intake.yml → Bug 分析草稿 → workflow:s3-fix
        ↓
3. Orchestrator → Agent → impl-subagent
   └─ 定位根因 → 修复 → 回归测试 → PR created
   [GATE 3] 用户在 GitHub merge PR
        ↓
4. workflow:s4-verify → staging 部署 → verify-subagent
   [GATE 4] 用户 approve 部署
        ↓
5. deploy-production → Issue closed
```

---

## 9. 实施范围

### 新增文件
- `.claude/skills/orchestrator/SKILL.md`
- `.github/workflows/issue-intake.yml`
- `docs/superpowers/specs/`（本文档）

### 修改文件
- `.github/workflows/deploy.yml`（拆分 staging + production jobs）
- `.github/workflows/ai-review.yml`（增加 Layer 2 设计符合度 review）
- `.claude/skills/s1-requirements/SKILL.md`（调用 superpowers:brainstorming）
- `.claude/skills/s2-design/SKILL.md`（调用 superpowers:writing-plans）
- `.claude/skills/s3-implement/SKILL.md`（调用 superpowers:test-driven-development + using-git-worktrees）
- `.claude/skills/s4-test/SKILL.md`（调用 superpowers:verification-before-completion）
- `.claude/skills/s5-deploy/SKILL.md`（调用 superpowers:finishing-a-development-branch）

### 不修改文件
- `.github/workflows/test.yml`（现有逻辑已满足需求）
- `.github/workflows/danger-detection.yml`（现有三层审查已完善）
- `apps/**`、`packages/**`（业务代码不在本 workflow 设计范围内）
- `docker-compose.yml`（staging server 配置单独处理）

### GitHub 配置（需手动操作）
- 创建 `staging` environment，无 required reviewers
- 确认 `production` environment 的 required reviewers 列表
- 创建 workflow 所需 labels：`feature`、`bug-fix`、`workflow:s1-prd` 等
- 配置 staging server 的 SSH secrets（`STAGING_SERVER_HOST` 等）

---

## 10. 待确认事项

- staging server 是否已存在，还是需要新建？
- staging URL 是什么（用于 verify-subagent 跑 E2E）？
- GitHub repo 的 `ANTHROPIC_API_KEY` secret 是否已配置（issue-intake.yml 需要）？
