# feature/cicd-pipeline 实施清单

## 目标
容器化三个应用 + 本地 docker-compose + 自动部署到 app-server。

## 任务清单

### 阶段 1：Dockerfile
- [x] `apps/api/Dockerfile` — 多阶段构建（builder + runtime），暴露 3001
- [x] `apps/worker/Dockerfile` — 多阶段构建（无端口），处理 pnpm monorepo 依赖
- [x] `apps/web/Dockerfile` — Next.js standalone 模式，暴露 3000
- [x] `.dockerignore`（根目录）— 排除 node_modules、.git、.env、*.test.ts

### 阶段 2：docker-compose
- [x] `docker-compose.yml`（根目录）包含：
  - `redis:7-alpine`（port 6379）
  - `api`（depends_on: redis，port 3001:3001）
  - `worker`（depends_on: redis）
  - `web`（depends_on: api，port 3000:3000）
  - 所有服务通过 env_file 或 environment 注入配置

### 阶段 3：next.config.js 修改
- [x] `apps/web/next.config.js` — 添加 `output: 'standalone'`

### 阶段 4：部署脚本
- [x] `scripts/docker-local.sh` — 本地验证脚本

### 阶段 5：GitHub Actions 部署流水线
- [x] `.github/workflows/deploy.yml`
  - 触发：push to master（含 tag v*.*.*）或 workflow_dispatch
  - Job 1: `build-and-push` — buildx 构建 3 个镜像，推送到 ghcr.io
  - Job 2: `deploy` — needs build-and-push，environment: production
    - appleboy/ssh-action 连接 app-server
    - docker compose pull + up -d + health check

### 阶段 6：Secret 安全配置
- [x] 确认 `.gitignore` 包含 `.env*`
- [x] 确认 `.dockerignore` 包含 `.env*`
- [x] deploy.yml 注释只写 Secret 名称，不含值
- [x] 所有 Secret 仅通过 GitHub Secrets UI 配置，不提交到 git

## 验证
```bash
# 本地验证
bash scripts/docker-local.sh   # 输出 "Local build OK"

# deploy.yml yamllint 验证通过
yamllint .github/workflows/deploy.yml
```

## 完成标准
- 三个 Dockerfile 构建成功
- `docker compose up -d` 一键启动，`localhost:3001/health` 通过
- deploy.yml 语法正确
- 所有 Secret 仅通过 GitHub Secrets UI 配置，无敏感信息提交到 git
- PR 提交到 master，danger-detection 正确标记为危险
