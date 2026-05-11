# 数据流重构 Spec

## Why
当前 [App.vue](file:///g:/project26/picture-tree/src/App.vue) 承担了过多的中间数据中转职责。两个 composable（`useTreeData` 和 `useCompareDialog`）的全部状态在 App.vue 中解构出来后，通过 **26 个 props + 15 个 emits** 传递给 CompareDialog，**6 个 props + 3 个 emits** 传给 SearchHistoryDialog，**2 个 props + 1 个 emit** 传给 PreviewPanel。这导致模板极其臃肿，props 传递层级深，维护和调试困难。

采用 Pinia 状态管理后，子组件直接通过 store 读取和修改数据，App.vue 仅保留少量编排逻辑。

## What Changes
- **BREAKING**: 移除 `useTreeData` composable，迁移到 Pinia `treeStore`
- **BREAKING**: 移除 `useCompareDialog` composable，迁移到 Pinia `compareStore`
- CompareDialog 组件大幅简化：26 个 props → 约 3 个 props，15 个 emits → 约 5 个 emits
- SearchHistoryDialog 组件简化：6 个 props → 约 2 个 props
- PreviewPanel 保持从 store 读取，props 减少
- App.vue 移除大量中间变量和回调函数，代码行数显著减少
- 选中节点使用完整 Node 对象替代仅使用 ID

## Impact
- Affected specs: 无（新项目重构）
- Affected code: `src/App.vue`, `src/stores/treeStore.ts`（新建）, `src/stores/compareStore.ts`（新建）, `src/components/compare-dialog/index.vue`, `src/components/search-history-dialog/index.vue`, `src/components/preview-panel/index.vue`, `src/composables/useTreeData.ts`（删除）, `src/composables/useCompareDialog.ts`（删除）

## ADDED Requirements

### Requirement: Pinia Tree Store
系统应将树数据管理逻辑从 composable 迁移至 Pinia store `treeStore`，包含以下状态：

**State**: `allTrees`, `currentTree`, `nodes`, `viewMode`, `timelineOrder`, `searchKeyword`, `maxNodeCount`, `selectedTreeId`, `pagedTreeIndex`, `treeLoading`, `focusNodeId`, `selectedNode`（完整 Node 对象，替代仅用 ID）

**Getters**: `filteredTrees`, `hasPrevTree`, `hasNextTree`

**Actions**: `loadTreeData`, `loadTreeByRootId`, `changeSelectedTree`, `goToPrevTree`, `goToNextTree`, `refreshCurrentTree`, `refreshAllRootIds`, `setSelectedNode(node: Node)`

#### Scenario: 选中节点使用完整对象
- **WHEN** 用户在画布点击节点
- **THEN** `selectedNode` 存储完整 Node 对象，PreviewPanel 直接从 `selectedNode.selfId`、`selectedNode.imageUrl` 等属性取值

### Requirement: Pinia Compare Store
系统应将比对弹窗数据管理逻辑从 composable 迁移至 Pinia store `compareStore`，包含以下状态：

**State**: `compareVisible`, `compareRootImage`, `compareRootLabel`, `compareTimelineNodes`, `comparePage`, `compareTreeIndex`, `compareTreeFrames`, `compareFrameIndex`, `compareChildPage`, `gridMode`, `singlePreviewImage`, `singlePreviewLabel`, `compareTreeName`

**Getters**: `childPageSize`, `isSingleNodePreview`, `compareTreeRootId`, `maxComparePage`, `maxChildPage`, `currentFrame`, 各首/末判断布尔值

**Actions**: `openCompareForNode`, `updateTreeName`, `prevCompareGroup`, `nextCompareGroup`, `goPrevFrame`, `goNextFrame`, `treePrevPage`, `treeNextPage`, `prevCompareTree`, `nextCompareTree`, `handleCompareKeydown`, `onCompareClosed`

#### Scenario: CompareDialog 直接读写 store
- **WHEN** CompareDialog 需要切换宫格模式
- **THEN** 组件直接调用 `compareStore.gridMode = '4'`，无需 emit 到 App.vue

#### Scenario: 外部切换树同步比对弹窗
- **WHEN** 用户在侧边栏切换树且比对弹窗打开
- **THEN** compareStore 监听 `treeStore.selectedTreeId`，自动重新加载比对数据

### Requirement: App.vue 精简
App.vue 仅保留以下职责：
- 全局键盘事件监听（左右键翻树）
- AntVX6 画布组件的事件处理（双击/右键打开比对、选中节点）
- 审核提交（`handleSubmitReview`）
- 搜索历史匹配（`handleSearchHistory`）
- 移动节点成功后的刷新（`handleMoveSuccess`）
- 组合 layout 布局（三个区域 + 底部控件）

不再承担 composable 解构、逐 prop 传递、逐 emit 转发的角色。

## MODIFIED Requirements

### Requirement: CompareDialog 组件简化
**Before**: 26 个 props + 15 个 emits
**After**: 
- Props: `modelValue: boolean`（v-model 显隐）
- 其余数据直接从 `compareStore` 读取，状态变更直接写入 `compareStore`
- 保留 emit: `search-history`, `submit-review`, `update-model-value`, `closed`

#### Scenario: 审核按钮交互
- **WHEN** 用户点击 ✔ / ✘ 审核按钮
- **THEN** CompareDialog 内部维护 `reviewStates`，点击后直接写 `compareStore` 中的 review 状态，提交时 emit `submit-review` 给 App.vue

### Requirement: SearchHistoryDialog 组件简化
**Before**: 6 个 props + 3 个 emits
**After**: 
- Props: `modelValue: boolean`
- 搜索历史数据从 `treeStore` 读取或通过 `searchHistoryStore` 管理
- 保留 emit: `move-success`

## REMOVED Requirements

### Requirement: useTreeData Composable
**Reason**: 迁移至 Pinia `treeStore`
**Migration**: 所有调用点改为 `const treeStore = useTreeStore()`

### Requirement: useCompareDialog Composable
**Reason**: 迁移至 Pinia `compareStore`
**Migration**: 所有调用点改为 `const compareStore = useCompareStore()`
