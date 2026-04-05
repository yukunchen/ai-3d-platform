---
name: s1-requirements
description: >
  从 Obsidian Inbox 或指定文件读取粗糙需求，生成结构化 PRD。
  支持 Obsidian 深度集成：自动解析 [[wikilinks]] 和 ![[embeds]]，
  递归读取关联笔记，聚合完整需求上下文。
  当用户提到"分析需求"、"写PRD"、"新项目"时自动触发。
context: fork
agent: product-analyst
allowed-tools: Read, Write, Glob, Grep, WebSearch, Agent
---

## Superpowers 框架

在开始需求分析前，调用需求分析思维框架：
```
Skill superpowers:brainstorming
```
Superpowers:brainstorming 提供结构化需求挖掘纪律。
本 skill 负责项目特定部分：Obsidian 集成、wikilink 解析、PRD 输出格式。

# Stage 1: 需求分析

## 输入
读取需求源文件: $ARGUMENTS

如果未提供参数，扫描 --add-dir 挂载的 Obsidian vault 的 00-Inbox/ 目录，
找到所有 `claude-ready: true` 且 `type: prd` 的笔记。

## 执行步骤

### 1. Obsidian 上下文聚合（核心）

读取主需求文件后，执行以下 Obsidian 深度解析：

#### 1a. 检测 Obsidian Vault
- 从输入文件路径向上查找，检查是否存在 `.obsidian/` 目录
- 如果找到：记录 vault 根路径，启用 Obsidian 集成模式
- 如果未找到：跳过 Obsidian 集成，按普通 markdown 处理

#### 1b. 解析链接
扫描主笔记中的所有 Obsidian 链接：
- `[[笔记名]]` — wikilink，链接到同 vault 中的另一个笔记
- `[[笔记名#标题]]` — 链接到特定章节
- `[[笔记名|显示文本]]` — 带别名的链接
- `![[笔记名]]` — embed，嵌入另一个笔记的完整内容
- `![[笔记名#标题]]` — 嵌入特定章节

解析规则：
- 用 Glob 在 vault 根目录中搜索 `**/{笔记名}.md` 定位文件
- 如果找到多个同名文件，优先选择与主笔记同目录或最近路径的

#### 1c. 递归读取关联笔记（max depth = 2）
- Depth 0: 主需求笔记（已读取）
- Depth 1: 主笔记中 `[[wikilink]]` 和 `![[embed]]` 引用的笔记
- Depth 2: Depth 1 笔记中引用的笔记（仅读取，不再递归）
- 防爆炸：最多读取 20 个关联文件；跳过图片/PDF 等非 .md 文件

#### 1d. 按类型分类关联笔记
读取每个关联笔记的 frontmatter，按 `type` 字段分类：
- `type: meeting` → 会议记录：提取决策点、行动项
- `type: feedback` → 用户反馈：提取痛点、功能需求
- `type: research` → 竞品/技术调研：提取结论、技术选型建议
- `type: prd` → 已有 PRD：提取可复用的需求定义
- `type: bug` → Bug 报告：提取需要修复的问题
- 无 type 或其他 type → 通用笔记：提取与需求相关的上下文

#### 1e. 聚合为"需求上下文包"
将所有关联内容组织为结构化上下文：

```
## 需求上下文包

### 主需求
（主笔记内容）

### 会议决策
- 来源: [[会议记录-2024-01-15]]
- 关键决策: ...

### 用户反馈
- 来源: [[客户A反馈]], [[用户调研结果]]
- 核心痛点: ...

### 调研结论
- 来源: [[竞品分析-Figma]]
- 技术建议: ...

### 其他上下文
- 来源: [[项目背景]]
- 摘要: ...
```

### 2. 读取需求源
- 基于上下文包（而非仅主笔记）提取：
  - 核心需求（合并主笔记 + 会议决策 + 用户反馈）
  - 技术偏好（合并主笔记 + 调研结论）
  - 约束条件（合并所有来源中的限制）

### 3. 市场/技术调研（如果需求涉及未知领域）
- 用 WebSearch 搜索同类产品
- 评估技术可行性
- 与 Obsidian 调研笔记中的结论交叉验证

### 4. 生成 PRD
使用 [PRD 模板](templates/prd-template.md) 生成正式文档，包含：
- 一句话描述
- 目标用户与痛点
- 用户流程（步骤化）
- MVP 功能范围（可勾选列表）
- 明确不做（Scope Freeze）
- 技术约束
- 成功指标（可量化）
- 验收标准
- **需求来源追溯**（列出所有参考的 Obsidian 笔记及其贡献）

### 5. 输出
- 写入项目目录: `docs/01_prd.md`
- 回写 Obsidian（如果 vault 可达）:
  - PRD → `01-Projects/{project}/PRD.md`
  - 在 PRD 头部添加 frontmatter: `type: prd`, `status: done`, `project: {name}`
  - 在 PRD 末尾添加 `## 来源笔记` 章节，用 `[[wikilink]]` 链接回原始需求笔记
- 更新需求源笔记的 frontmatter: `status: done`

## 质量标准
- PRD 中每个功能都有明确的验收标准
- Scope Freeze 至少列 3 项"不做"
- 成功指标全部可量化
- 如果使用了 Obsidian 集成：PRD 中包含需求来源追溯章节
