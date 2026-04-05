---
name: s2-design
description: >
  基于 PRD 设计系统架构、API 契约、数据模型、TDD 开发计划。
  当用户提到"设计架构"、"技术方案"、"API设计"时触发。
context: fork
agent: architect
allowed-tools: Read, Write, Glob, Grep, WebSearch, Agent
---

## Superpowers 框架

在开始架构设计前，调用规划框架：
```
Skill superpowers:writing-plans
```
Superpowers:writing-plans 提供架构分解和计划纪律。
本 skill 负责项目特定部分：API 契约格式、3D pipeline 设计、dev_plan 结构。

# Stage 2: 架构设计

## 输入
读取 PRD: `docs/01_prd.md`
如果有 Obsidian 知识库中的技术决策记录，一并参考。

## 执行步骤

ultrathink

1. **技术选型**
   - 根据 PRD 中的技术约束选择框架
   - 参考 [技术栈指南](references/tech-stack-guide.md)（如果存在）
   - 输出选型理由

2. **架构设计**
   - 画出组件关系图（ASCII）
   - 定义目录结构
   - 定义数据流

3. **API 契约**（如果涉及后端）
   - 定义所有 REST/GraphQL 端点
   - 包含请求/响应格式
   - 包含错误码定义

4. **开发计划**
   - 拆解为 TDD 步骤（每步有测试命令）
   - 标注依赖关系
   - 估算每步复杂度（简单/中等/复杂）

5. **输出**
   - `docs/02_architecture.md`
   - `docs/03_api_contract.md`（如适用）
   - `docs/04_dev_plan.md`

## 质量标准
- 每个 TDD 步骤都有独立的验证命令
- API 契约 100% 覆盖 PRD 中的功能
- 架构图清晰展示组件间关系
