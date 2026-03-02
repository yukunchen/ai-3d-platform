# 项目进展与踩坑记录

> 按时间倒序记录，每次重要进展和踩坑都追加到对应章节。

---

## 2026-03-01 — Docker 容器化 + 生产部署全流程打通

### 完成的事

- 三个 feature branch（texture-maps / skeleton-rig / cicd-pipeline）全部合并到 master
- GitHub Actions CI/CD 流水线跑通：push → 构建 3 个 GHCR 镜像 → 人工 approve → SSH 部署到 app-server
- 生产服务器（100.22.97.122）四个容器稳定运行：redis / api / worker / web
- Playwright prod E2E 测试覆盖完整链路（页面加载 + text-to-3D 任务成功 + GLB 下载验证）
- 修复 Meshy `art_style` 400 错误，所有测试绿色

---

## 踩坑清单（每条包含根因 + 修复方法）

### 1. TypeScript 编译后无 dist 目录

**现象**：Docker 构建时报 `apps/api/dist not found`

**根因**：根 `tsconfig.json` 设置了 `"noEmit": true` + `"allowImportingTsExtensions": true`（给 Next.js/bundler 用的），apps 继承这两项，导致 `tsc` 不输出任何文件。

**修复**：在 `apps/api/tsconfig.json` 和 `apps/worker/tsconfig.json` 中显式覆盖：
```json
"noEmit": false,
"allowImportingTsExtensions": false
```

**教训**：monorepo 根 tsconfig 如果为 bundler 优化，apps 必须显式 override 才能用 `tsc` 编译输出。

---

### 2. packages/shared 在 Docker 容器内无法加载（Cannot find module）

**现象**：`Cannot find module '/app/packages/shared/src/enums'`

**根因**：`packages/shared/package.json` 的 `"main": "./src/index.ts"`，在本地有 tsx/ts-node 可以运行 `.ts`，但 Docker 内是纯 Node.js，无法执行 TypeScript 源文件。

**修复**：
1. 新增 `packages/shared/tsconfig.build.json`，单独编译到 `dist/`
2. Dockerfile 中先 `pnpm --filter shared build`，再 `COPY dist/` 到 runtime 镜像
3. runtime 阶段用 `node -e` 内联脚本将 `package.json` 的 `main` 改为 `./dist/index.js`

**教训**：shared 包要维护"两套入口"——本地开发用 `.ts` 源文件，Docker runtime 用编译后的 `dist/`。Dockerfile 里必须先 build shared，再 build 依赖它的 app。

---

### 3. docker-compose.yml 不能用于生产部署

**现象**：server 无法重新构建镜像，`docker compose up` 失败

**根因**：`docker-compose.yml` 使用 `build:` 指令，需要源代码。生产环境应该拉取预构建镜像。

**修复**：创建 `docker-compose.prod.yml`，所有服务改用 `image: ${API_IMAGE}` 等环境变量。

**教训**：开发用 `build:`，生产用 `image:`，两个文件分开维护。

---

### 4. web 容器一直停在 Created 状态不启动

**现象**：`docker compose up` 后 web 容器显示 `Created` 而非 `Up`

**根因**：deploy 脚本运行时 `${WEB_IMAGE}` 等变量有值，但脚本退出后变量消失。重启或二次执行 `docker compose up` 时变量未定义，容器无法创建。

**修复**：deploy 脚本将镜像 tag 持久化写入 `.env.images` 文件，后续所有 `docker compose` 命令加 `--env-file .env.images`。

**教训**：docker compose 依赖的环境变量必须持久化到文件，不能只在 shell 会话中存在。

---

### 5. Next.js standalone 容器报 `getaddrinfo EAI_AGAIN`

**现象**：web 容器启动后无法绑定端口，日志报 hostname 解析失败

**根因**：Next.js standalone 默认监听容器的 hostname（容器 ID），Docker 内部无法解析自身 hostname。

**修复**：Dockerfile runtime 阶段加：
```dockerfile
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
```

**教训**：Next.js standalone 必须显式设置 `HOSTNAME=0.0.0.0` 才能在 Docker 内正常绑定。

---

### 6. Redis 连接失败（ECONNREFUSED 127.0.0.1:6379）

**现象**：api 和 worker 启动后无法连接 Redis

**根因**：代码使用 `REDIS_HOST` + `REDIS_PORT` 两个环境变量，但 docker-compose.prod.yml 错误地配置了 `REDIS_URL=redis://redis:6379`。

**修复**：改为：
```yaml
environment:
  - REDIS_HOST=redis
  - REDIS_PORT=6379
```

**教训**：看代码怎么读配置，不要想当然地用 `_URL` 格式。

---

### 7. worker 写文件 API 找不到（storage 路径不一致）

**现象**：任务成功但下载链接 404

**根因**：worker 写到 `/api/storage/`，api 从 `/app/apps/api/storage/` 读取（两个不同容器的不同路径）。

**修复**：在 `docker-compose.prod.yml` 中添加具名 volume `storage`，分别挂载到两个容器的对应路径。

**教训**：多容器共享文件必须用 named volume，且挂载路径要与代码中的实际路径完全一致。

---

### 8. Next.js rewrite 指向 localhost（浏览器报 Failed to create job）

**现象**：生产环境点击提交后报错，curl API 直接请求正常

**根因**：Next.js standalone 的 `rewrites()` 在 `next build` 时被编译进去（不是运行时读取）。`API_URL` 只在 Dockerfile runtime 阶段设置，builder 阶段执行 `pnpm build` 时 `process.env.API_URL` 为空，fallback 到 `http://localhost:3001`，导致容器内向自身 3001 端口发请求。

**修复**：在 Dockerfile **builder 阶段**、`pnpm build` 之前设置：
```dockerfile
ENV API_URL=http://api:3001
RUN pnpm --filter @ai-3d-platform/web build
```

**教训**：Next.js `next.config.js` 中任何在构建时读取的 `process.env` 变量，都必须在 builder 阶段设置，runtime 阶段设置无效。

---

### 9. 审批旧的 pending deploy 会覆盖更新的部署

**现象**：新版本已部署上线，审批一个更早的 pending run 后，服务器回滚到旧镜像

**根因**：GitHub Actions 的 `environment: production` 审批只控制"能否运行"，审批后会无条件执行该 run 对应的 deploy 脚本，覆盖任何更新的部署。

**修复**：审批旧 run 后，手动用最新 SHA 更新服务器的 `.env.images` 并重新 `docker compose up`。

**教训**：有多个 pending deploy 时，只审批最新的那个。旧的 pending run 应该取消（`gh run cancel <run-id>`），而不是审批。

---

### 10. Meshy API art_style 参数 400 错误

**现象**：使用 Cartoon/Stylized/Flat 风格时，任务直接失败：`ArtStyle must be one of [realistic]`

**根因**：Meshy v2 text-to-3d（preview mode）和 image-to-3d 端点只接受 `art_style: 'realistic'`，不支持 `cartoon`/`low-poly`/`pbr`。

**修复**：`mapTextureStyle()` 仅对 `Photorealistic` 返回 `'realistic'`，其他样式返回 `undefined`（不发送 `art_style` 字段）。

**教训**：集成第三方 API 时，enum 值的映射必须以实际 API 文档/测试为准，不能假设命名对应。变更实现后，同步更新测试用例的期望值。

---

### 11. Playwright 测试 page.request.get() 不接受相对 URL

**现象**：`TypeError: apiRequestContext.get: Invalid URL`

**根因**：`page.request.get()` 需要绝对 URL，但 `href` 是 `/storage/asset-xxx.glb` 相对路径。

**修复**：
```typescript
const absoluteHref = href!.startsWith('http') ? href! : `${PROD_URL}${href}`;
const resp = await page.request.get(absoluteHref);
```

**教训**：Playwright 的 `page.request` API 不会自动补全 base URL，相对路径必须手动拼接。

---

## 架构决策记录

| 决策 | 原因 |
|------|------|
| Next.js rewrites 代理 `/v1/*` 和 `/storage/*` | 避免 `NEXT_PUBLIC_*` 构建时耦合，前端用相对路径，服务端代理到 `api:3001` |
| `.env.images` 追踪已部署镜像 tag | `docker-compose.prod.yml` 依赖环境变量，shell 会话结束后变量丢失，需要文件持久化；同时作为部署记录 |
| `packages/shared` 维护独立 `tsconfig.build.json` | 本地开发和 Docker 构建使用不同的 TS 配置，互不干扰 |
| worker 存储路径 `/api/storage/`，api 挂载到 `/app/apps/api/storage/` | 历史路径设计，通过 Docker named volume 桥接 |

---

## 当前生产状态（2026-03-01）

- **服务器**：100.22.97.122
- **最新镜像 SHA**：`85bc6b7`（test: update meshy-texture tests）
- **所有测试**：39 worker + 28 API + 2 E2E smoke = 全绿
- **Playwright prod E2E**：2 passed，端到端验证生产可用
