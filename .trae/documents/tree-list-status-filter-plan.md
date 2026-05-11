# 树列表审核进度展示及完成状态筛选计划

## 需求
`getAllRootIds` 接口返回的 `TreeRoot` 已包含 `totalChildCount`（总子节点数）、`completedCount`（已审核数）、`isCompleted`（是否完成）三个字段。需在树列表中展示审核进度，并支持按完成状态筛选。

## 实现步骤

### 1. `treeStore.ts` — 新增 `filterCompleted` 筛选状态

- 新增 `filterCompleted = ref<'all' | 'completed' | 'pending'>('all')`
- 修改 `filteredTrees` computed：在现有筛选之后，若 `filterCompleted` 不为 `'all'`，按 `isCompleted` 字段过滤
- 导出 `filterCompleted`

### 2. `App.vue` — 树列表项展示审核进度 + 筛选按钮

- 树列表每项增加审核进度显示：`nodeCount` 节点中 `completedCount` 已审核
- 格式改为两行显示（类似子标题），颜色根据 `isCompleted` 区分（完成=绿色、未完成=橙色）
- 筛选 Popover 中增加完成状态切换（三个单选项：全部 / 已完成 / 未完成）

### 3. `App.vue` — 筛选按钮激活状态感知

- 当 `filterCompleted` 不为 `'all'` 时，筛选按钮也显示为 `primary` 类型（和节点数筛选一致）
