# feature/texture-maps 实施清单

## 目标
为 3D 生成平台添加纹理贴图参数控制和独立贴图 API。

## 任务清单

### 阶段 1：类型定义
- [x] `packages/shared/src/enums.ts` — 新增 `TextureStyle` 枚举（Photorealistic/Cartoon/Stylized/Flat）
- [x] `packages/shared/src/types.ts` — 新增 `TextureOptions` 接口（resolution: 512|1024|2048, style: TextureStyle）
- [x] `packages/shared/src/types.ts` — `CreateJobRequest` 增加 `textureOptions?: TextureOptions`
- [x] `packages/shared/src/types.ts` — `JobResult` 增加 `textureMapIds?: Record<string, string>`

### 阶段 2：API 层
- [x] `apps/api/src/routes/jobs.ts` — 更新 Zod schema 验证 textureOptions
- [x] `apps/api/src/routes/assets.ts` — 新增 `GET /v1/assets/:assetId/textures` 路由
  - 查 Redis: `textures:{assetId}`
  - 返回 `{ albedo?, normal?, roughness?, metallic? }` 各自的 downloadUrl

### 阶段 3：Worker Provider
- [x] `apps/worker/src/providers/meshy.ts` — 传入 textureOptions
  - resolution → `texture_resolution`
  - style → `art_style`（realistic/cartoon/low-poly/pbr）
  - 任务完成后解析 `result.textures`，分别存储贴图
- [x] `apps/worker/src/providers/hunyuan.ts` — 若不支持则记录 warn，忽略
- [x] `apps/worker/src/index.ts` — 处理 textureMapIds，写入 Redis `textures:{assetId}`

### 阶段 4：测试
- [x] `apps/api/test/assets-textures.test.ts` — GET /v1/assets/:id/textures 路由测试（mock Redis）
- [x] `apps/worker/test/providers/meshy-texture.test.ts` — textureOptions 映射到 payload 测试
- [x] 运行 `pnpm test:all` 全绿

### 阶段 5：Web UI
- [x] `apps/web/src/components/TexturePanel.tsx` — 新组件，展示 4 张贴图缩略图
- [x] `apps/web/src/app/page.tsx` — 增加 TextureOptions 表单（resolution 下拉 + style 选择）
- [x] `apps/web/src/app/page.tsx` — 成功后渲染 TexturePanel

## 验证
```bash
pnpm test:worker   # meshy-texture.test.ts 全绿 ✅ 28 tests passed
pnpm test:api      # assets-textures.test.ts 全绿 ✅ 20 tests passed
pnpm test:all      # 全套通过 ✅ including 2 smoke tests
```

## 完成标准
- [x] API 接受 textureOptions 并通过验证
- [x] GET /v1/assets/:id/textures 返回各贴图 URL
- [x] Meshy provider 正确传递纹理参数
- [x] 所有单元/集成测试通过（`pnpm test:all`）
- [ ] PR 提交到 master，AI review 通过

## Review

所有 5 个阶段已完成。改动清单：

### 新增文件
- `apps/api/test/assets-textures.test.ts` — 3 tests for textures endpoint
- `apps/worker/test/providers/meshy-texture.test.ts` — 9 tests for textureOptions mapping
- `apps/web/src/components/TexturePanel.tsx` — 4-slot texture thumbnail grid

### 修改文件
- `packages/shared/src/enums.ts` — `TextureStyle` enum
- `packages/shared/src/types.ts` — `TextureOptions`, updated `CreateJobRequest`, `JobData`, `JobResult`
- `apps/api/src/routes/jobs.ts` — Zod schema validation for textureOptions
- `apps/api/src/routes/assets.ts` — GET /:assetId/textures route + textureStore dep
- `apps/worker/src/providers/provider.ts` — `ProviderResult.textureMapIds?`
- `apps/worker/src/providers/meshy.ts` — style mapper, updated payload builders, texture extraction
- `apps/worker/src/providers/hunyuan.ts` — warn log for unsupported textureOptions
- `apps/worker/src/index.ts` — Redis write for textures:{assetId}
- `apps/web/src/app/page.tsx` — TextureOptions form + TexturePanel render
