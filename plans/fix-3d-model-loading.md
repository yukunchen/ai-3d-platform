# 修复前端 3D 模型加载失败问题

## 问题分析

当前流程：
1. Worker 生成 GLB 后，将 URL 保存到 Redis（格式：`/storage/asset-xxx.glb`）
2. 前端调用 API 获取 downloadUrl
3. 前端直接把这个 URL 传给 ModelViewer
4. ModelViewer 使用 useGLTF 加载模型失败

**根本原因**：相对路径 `/storage/asset-xxx.glb` 无法在浏览器中直接访问。

## 解决方案

修改 `apps/web/src/app/page.tsx`，在将 URL 传给 ModelViewer 之前，将其转换为可通过前端代理访问的路径：

```typescript
// 将 /storage/xxx 转换为 /storage/xxx (通过 Next.js API 路由)
let modelUrl = assetData.downloadUrl;
if (modelUrl.startsWith('/storage/')) {
  modelUrl = modelUrl; // 直接使用，相对路径应该可以工作
} else if (modelUrl.startsWith('http')) {
  // 如果是绝对路径，需要通过代理
  const assetId = modelUrl.split('/').pop();
  modelUrl = `/storage/${assetId}`;
}
```

或者更简单的方案：修改 page.tsx 将所有 URL 都通过前端的 `/storage/` 路由代理。

## 修改文件

1. `apps/web/src/app/page.tsx` - 修改获取 assetUrl 后的处理逻辑

## 验证步骤

1. 刷新浏览器页面
2. 输入新的 prompt 生成 3D 模型
3. 检查是否能正确显示 3D 模型预览
4. 检查控制台是否有错误
