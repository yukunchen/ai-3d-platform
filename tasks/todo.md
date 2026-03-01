# feature/skeleton-rig 实施清单

## 目标
支持 FBX 输出格式选择 + 骨骼绑定预设参数。

## 任务清单

### 阶段 1：类型定义
- [x] `packages/shared/src/enums.ts` — 新增 `SkeletonPreset` 枚举（None/Humanoid/Quadruped）
- [x] `packages/shared/src/types.ts` — 新增 `SkeletonOptions` 接口（preset: SkeletonPreset）
- [x] `packages/shared/src/types.ts` — `CreateJobRequest` 增加 `format?: AssetFormat`（default: GLB）
- [x] `packages/shared/src/types.ts` — `CreateJobRequest` 增加 `skeletonOptions?: SkeletonOptions`
- [x] `packages/shared/src/types.ts` — `JobResult` 增加 `format: AssetFormat` (already existed)
- [x] `packages/shared/src/types.ts` — `AssetResponse` 增加 `format: AssetFormat` (already existed)

### 阶段 2：API 层
- [x] `apps/api/src/routes/jobs.ts` — 更新 Zod schema
  - `format: z.nativeEnum(AssetFormat).optional()`
  - `skeletonOptions: z.object({ preset: z.nativeEnum(SkeletonPreset) }).optional()`
  - 业务规则：skeletonOptions 仅在 format=FBX 时有效（否则返回 400）
- [x] `apps/api/src/routes/assets.ts` — 从文件扩展名自动检测 format（不再硬编码 GLB）

### 阶段 3：Worker Provider
- [x] `apps/worker/src/providers/hunyuan.ts` — 支持 format 参数
  - format=FBX → 请求参数设置 `ResultFormat: 'FBX'`（通过 jobData.format 自动推导）
  - skeletonOptions.preset 映射骨骼预设参数（jobData.skeletonOptions）
  - 输出文件扩展名根据 format 动态设置（.glb / .fbx）
- [x] `apps/worker/src/providers/meshy.ts` — 支持 format 参数
  - format=FBX → 解析 `result.model_urls.fbx`
  - format=GLB → 解析 `result.model_urls.glb`（现有逻辑）
- [x] `apps/worker/src/providers/provider.ts` — ProviderResult 增加 `format?: AssetFormat`

### 阶段 4：测试
- [x] `apps/worker/test/providers/hunyuan-fbx.test.ts` — FBX payload 构造测试（6 cases）
- [x] `apps/worker/test/providers/meshy-fbx.test.ts` — Meshy FBX URL 解析测试（5 cases）
- [x] `apps/api/test/jobs-format.test.ts` — format + skeletonOptions 验证测试（含 400 错误路径，8 cases）
- [x] 运行 `pnpm test:all` 全绿（57 tests: 25 API + 30 worker + 2 smoke）

### 阶段 5：Web UI
- [x] `apps/web/src/app/page.tsx` — 增加 Format 选择（GLB/FBX 下拉）
- [x] `apps/web/src/app/page.tsx` — SkeletonPreset 下拉（仅 format=FBX 时显示）
- [x] ModelViewer 处理：FBX 格式显示下载按钮 + 提示

## 验证
```bash
pnpm test:worker   # hunyuan-fbx + meshy-fbx 全绿
pnpm test:api      # jobs-format 全绿
pnpm test:all      # 全套通过
```

## 完成标准
- [x] 用户可选择 GLB/FBX 输出格式
- [x] format=FBX 时可附带 skeletonOptions
- [x] 两个 provider 均正确返回对应格式文件
- [x] 所有单元/集成测试通过（`pnpm test:all`）— 57 tests 全绿
- [ ] PR 提交到 master，AI review 通过

## 实施结果（2026-03-01）

所有 5 个阶段实施完毕，`pnpm test:all` 全绿（25 API + 30 worker + 2 smoke = 57 tests）。

关键决策：
- `format` 和 `skeletonOptions` 从 `jobData` 直接读取（非 options 参数），确保来源唯一性
- assets.ts 通过 URL 扩展名自动检测 format，兼容历史数据
- Hunyuan SkeletonPreset 映射为 `payload.SkeletonPreset = preset`（None 时不设置）
- Meshy 不需改 payload，仅在下载时从 `model_urls.fbx` 或 `model_urls.glb` 选择
