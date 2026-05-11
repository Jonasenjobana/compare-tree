# 数据流重构 Tasks

## 前置准备
- [x] 确认项目已安装 Pinia（检查 package.json） — 已安装 v3.0.4

## Tasks

- [x] Task 1: 创建 Pinia treeStore 并迁移 useTreeData 全部逻辑
  - [x] 创建 `src/stores/treeStore.ts`
  - [x] 将 useTreeData 的所有 state、getters、actions 完整迁移
  - [x] 新增 `focusNodeId`、`selectedNode`（完整 Node 对象）到 store
  - [x] 导出 `useTreeStore`

- [x] Task 2: 创建 Pinia compareStore 并迁移 useCompareDialog 全部逻辑
  - [x] 创建 `src/stores/compareStore.ts`
  - [x] 将 useCompareDialog 的所有 state、getters、actions 完整迁移
  - [x] 内部使用 `useTreeStore()` 获取依赖（allTrees、viewMode、loadTreeByRootId、selectedTreeId）
  - [x] watch `treeStore.selectedTreeId` 以在对话框打开时同步比对数据

- [x] Task 3: 更新 CompareDialog 组件从 store 读取数据
  - [x] Props 精简为仅 `modelValue: boolean`（从 26 个 → 1 个）
  - [x] Emits 精简为 `submit-review`、`search-history`、`update:modelValue`（从 15 个 → 3 个）
  - [x] 内部改用 `useCompareStore()` / `useTreeStore()` 读写状态
  - [x] 键盘事件改为组件内直接调 `compareStore.handleCompareKeydown`
  - [x] 审核按钮交互保持组件内 reviewStates

- [x] Task 4: 更新 SearchHistoryDialog — 保持原样（搜索历史数据为按需获取的瞬时数据，通过 props 传递最简洁）

- [x] Task 5: 更新 PreviewPanel 组件从 store 读取数据
  - [x] 改为从 `treeStore` 读取 `selectedNode` 和 `nodes`（使用 `storeToRefs`）
  - [x] 移除 `selectedNode` 和 `allNodes` props

- [x] Task 6: 精简 App.vue
  - [x] 移除 `useTreeData()` 和 `useCompareDialog()` 调用，改用 store
  - [x] CompareDialog 从 26 props + 15 emits → 1 v-model + 2 emits
  - [x] PreviewPanel 从 2 props → 0 props（直接从 store 读取）
  - [x] `selectedNode` / `focusNodeId` 移至 treeStore
  - [x] `handleNodeSelect` 改用 `treeStore.setSelectedNode()`

- [x] Task 7: 清理旧文件 — 用户选择保留旧 composable 文件

- [x] Task 8: 类型检查 + 功能验证
  - [x] `npx vue-tsc --noEmit` 通过，零错误
