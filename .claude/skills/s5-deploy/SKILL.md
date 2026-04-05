---
name: s5-deploy
description: >
  将已测试通过的代码部署到生产环境。
  包含 git push、CI 验证、部署执行。
disable-model-invocation: true
allowed-tools: Bash, Read, Write
---

## Superpowers 框架

在执行部署前，调用收尾纪律框架：
```
Skill superpowers:finishing-a-development-branch
```
本 skill 负责项目特定部分：Docker/SSH 部署脚本、GitHub Actions 触发、健康检查端口。

# Stage 5: 部署上线

## 前置检查
- 确认本地测试全绿: !`git status --porcelain`

## 执行步骤

1. **推送代码**
   ```bash
   git push origin $(git branch --show-current)
   ```

2. **等待 CI**
   轮询 GitHub Actions 状态，等待 CI 通过（最多 10 分钟）
   ```bash
   gh run list --limit 1 --json status,conclusion
   ```

3. **创建 Release**（如果是 main/master 分支）
   ```bash
   gh release create v$(date +%Y%m%d-%H%M) --generate-notes
   ```

4. **生产验证**
   - 运行生产 E2E 测试（如有）
   - 检查健康端点

5. **输出部署报告**
   - commit SHA
   - CI 状态
   - 部署时间
