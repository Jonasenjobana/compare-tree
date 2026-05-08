# 替换初始化接口 + span显示优化 + bug修复 实施计划

## 需求分析
1. 将 `/get_all_trees` 替换为 `/get_all_root_ids`，只获取根节点摘要信息
2. 初始化时调用 `/get_all_root_ids`，默认选中第一个根节点，再调用 `/get_tree_by_root_id` 获取完整数据
3. span 显示 `treeName(rootId)`，没有 treeName 显示 rootId
4. 去掉定位按钮
5. 修复点击 span 变空的 bug
6. 修复树形/时间轴切换没反应、正序倒序没反应、双击节点没反应的 bug

## Bug 分析
### Bug 1：点击 span 变空
`changeSelectedTree` 调用 `refreshNodes()`，如果该树的 `tree` 数据不完整（新接口不返回 tree），`convertTreeListToNodes` 产出空数组，画布变空。

### Bug 2：切换/双击没反应
`watch(selectedTreeId)` 里调用了 `refreshCurrentTree`，加上 `loadTreeData` 里也调用了 `refreshCurrentTree`，可能导致 `treeLoading` 状态管理混乱。另外 loading overlay（z-index: 100）覆盖在画布上，loading 期间阻止所有画布交互。

**根本修复**：loading overlay 不应该阻止画布交互，应改为半透明且 `pointer-events: none`。同时优化 loading 状态管理，避免重复调用。

## 涉及文件
- `src/types/index.ts` — `TreeRoot.tree` 改为可选
- `src/api/tree.ts` — 新增 `getAllRootIds` 接口
- `src/composables/useTreeData.ts` — 改初始化逻辑，修复 bug
- `src/App.vue` — span 显示优化，去掉定位按钮，去掉自动定位 watch
- `src/components/antv-x6-tree/index.vue` — loading overlay 加 `pointer-events: none`
- `src/mock/tree-mock.ts` — 适配新接口

## 实施步骤

### 步骤1：修改 `TreeRoot` 类型

```typescript
export interface TreeRoot {
  rootId: string
  rootUrl: string
  tree?: TreeNode
  treeName: string
  maxMathcDate: string
}
```

### 步骤2：新增 API 接口

```typescript
export function getAllRootIds(): Promise<TreeRoot[]> {
  return request.get<TreeRoot[], TreeRoot[]>('/get_all_root_ids')
}
```

### 步骤3：修改 `useTreeData.ts`

- 导入 `getAllRootIds` 替代 `getAllTrees`
- `loadTreeData` 逻辑：
  1. 调用 `getAllRootIds()` 获取根节点列表，设置 `allTrees`
  2. 默认选中第一个根节点（设置 selectedTreeId 和 pagedTreeIndex）
  3. 调用 `refreshCurrentTree(selectedTreeId)` 获取完整树数据
  4. 不再在 loadTreeData 里设 treeLoading，因为 refreshCurrentTree 自己会管
- `changeSelectedTree` 修复：
  - 设置 pagedTreeIndex 和 selectedTreeId
  - 如果该树已有 `tree` 数据，先 refreshNodes() 渲染
  - 调用 refreshCurrentTree 获取最新数据
- `convertTreeListToNodes`：检查 `targetTree.tree` 是否存在
- 去掉 watch(selectedTreeId) 里的 refreshCurrentTree 调用（避免重复调用）

### 步骤4：修改 `App.vue`

- span 显示：`{{ tree.treeName ? tree.treeName + '(' + tree.rootId + ')' : tree.rootId }}`
- 去掉定位按钮
- 修改 `watch(selectedTreeId)`：只做 scrollTreeListToActive 和 locateToRoot，不调用 refreshCurrentTree
- 修改 `watch(compareTreeIndex)`：切换比对树时也需要 refreshCurrentTree

### 步骤5：修改 loading overlay 加 `pointer-events: none`

让 loading overlay 不阻止画布交互。

### 步骤6：适配 mock 数据

新增 `getMockAllRootIds` 函数，返回只含根节点摘要的 TreeRoot[]。
