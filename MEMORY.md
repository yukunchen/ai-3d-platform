# Current Task
- 任务名称：Web UI 端到端测试验证与生产部署
- 当前分支：master (commit: a9be89d)
- 目标：确保所有 Web UI 功能正常工作，用户可以正常使用

# Done
- 修复 API auth 路由未挂载问题 (index.ts 添加 Redis auth store)
- 修复 TypeScript 编译错误 (export type { AuthDeps })
- 添加前端表单验证 (密码长度、必填字段)
- 改进错误信息显示 (详细验证错误)
- 构建并部署新镜像 (a9be89d)
- 运行全面 E2E 测试 (30/30 通过)
- 创建 full-e2e.spec.ts 综合测试文件

# In Progress
- 等待用户验收测试
- 生产环境已部署: http://100.22.97.122:3000

# Blockers / Risks
- 无当前卡点
- Meshy API 余额需定期检查
- 生产环境 .env 包含敏感信息，不要提交到代码库

# Key Decisions
- 使用 ioredis 作为 auth store：API 已有 ioredis 依赖，无需新增依赖
- 客户端验证 + 服务端验证：双重保障用户体验和数据一致性
- 每个测试使用唯一邮箱：避免 serial 模式下邮箱冲突

# Files Touched
- apps/api/src/index.ts - 添加 Redis auth store 配置
- apps/api/src/routes/auth.ts - 修复 export type
- apps/web/src/app/page.tsx - 添加表单验证和错误提示
- apps/web/tests/prod-e2e.spec.ts - 更新为真实注册登录流程
- apps/web/tests/full-e2e.spec.ts - 新增全面测试套件
- .env - 添加 JWT_SECRET
- .env.images - 更新镜像版本

# Next Step
- 用户验收测试：访问 http://100.22.97.122:3000
- 验证命令：
  ```bash
  # 运行全部测试
  cd apps/web && pnpm exec playwright test -c playwright.smoke.config.ts --reporter=list

  # 运行生产测试
  PROD_URL=http://100.22.97.122:3000 pnpm exec playwright test tests/prod-e2e.spec.ts --reporter=list

  # 运行全面测试
  PROD_URL=http://100.22.97.122:3000 pnpm exec playwright test tests/full-e2e.spec.ts --reporter=list
  ```

# Production Status
- 服务器: 100.22.97.122
- 镜像版本: a9be89d
- 容器状态: web/api/worker/redis 全部运行中
- 测试结果: 30/30 通过
