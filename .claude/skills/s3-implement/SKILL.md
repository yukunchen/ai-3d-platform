---
name: s3-implement
description: >
  按 TDD 分步实现代码。读取 dev_plan 逐步执行，
  每步先写测试再实现，验证通过后继续下一步。
  当用户提到"开始编码"、"实现功能"、"TDD"时触发。
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

## Superpowers 框架

在开始编码前，调用 worktree 管理和 TDD 纪律：
```
Skill superpowers:using-git-worktrees
Skill superpowers:test-driven-development
```
- `superpowers:using-git-worktrees`：管理 feature worktree 的创建和隔离
- `superpowers:test-driven-development`：强制先写失败测试再实现的纪律
本 skill 负责项目特定部分：pnpm 测试命令、步骤验证逻辑、commit 策略。

# Stage 3: TDD 编码实现

## 输入
读取开发计划: `docs/04_dev_plan.md`
参考架构: `docs/02_architecture.md`
参考 API 契约: `docs/03_api_contract.md`（如果存在）

## 执行策略

对 dev_plan 中的每一个 Step：

### 循环: for each step in dev_plan

1. **写失败测试**
   - 根据 step 描述写测试用例
   - 运行测试，确认红色（失败）

2. **最小实现**
   - 写最少代码让测试通过
   - 运行测试，确认绿色

3. **重构**（如果需要）
   - 消除重复代码
   - 运行测试，确认仍然绿色

4. **验证**
   - 运行该 step 对应的测试命令
   - 如果失败：分析错误 → 修复 → 重跑（最多 3 轮）

5. **提交**
   - `git add` 相关文件
   - `git commit` 带清晰的 commit message

### 循环结束后

6. **全量回归**
   - 运行全量测试命令
   - 确保所有测试绿色

## 约束
- 不修改 docs/ 下的规范文档
- 每个 commit 只包含一个 step 的改动
- 测试失败超过 3 轮修复：停止并报告问题
