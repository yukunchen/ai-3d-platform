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

等待 PR merge（轮询每 60 秒）：
```bash
gh pr view {pr_number} --json mergedAt,state
```

---

### S4: 验证阶段

**触发条件**：PR 已 merge 到 master

**等待 staging 部署完成**：
```bash
gh run list --workflow=deploy.yml --limit=1 --json status,conclusion,jobs
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
状态: ✅ 可以部署 | ❌ 有失败项

{failure_details if any}

输入 "deploy" 触发生产部署（需要在 GitHub 上点击 approve）。
```

**用户输入 "deploy"**：
```bash
gh issue edit {issue_id} --remove-label "workflow:s4-verify" --add-label "workflow:s5-deploy"
```

提示用户去 GitHub Actions 页面批准生产部署：
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
