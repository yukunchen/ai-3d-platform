---
name: s4-test
description: >
  运行全量测试，分析失败，自动修复，生成测试报告。
  在 staging 环境跑 E2E 验证。
  当用户提到"运行测试"、"验证"、"E2E"时触发。
allowed-tools: Bash, Read, Write, Glob, Grep
---

## Superpowers 框架

在开始验证前，调用验收纪律框架：
```
Skill superpowers:verification-before-completion
```
本 skill 负责项目特定部分：pnpm 测试命令、Playwright E2E、staging URL、测试报告格式。

# Stage 4: 测试验证

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
