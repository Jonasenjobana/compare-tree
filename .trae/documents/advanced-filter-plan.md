# 高级筛选功能计划

## 需求
在树列表搜索框旁增加一个筛选按钮，点击弹出 popover，可筛选节点总数 ≤ N 的树。N 为空时不筛选。

## 实现步骤

### 1. `useTreeData.ts` — 新增 `maxNodeCount` 筛选条件 + 整合到 `filteredTrees`

- 新增 `maxNodeCount = ref<number | null>(null)`
- 修改 `filteredTrees` computed：先按 `searchKeyword` 过滤，再按 `maxNodeCount` 过滤（如果非 null，只保留 `nodeCount <= maxNodeCount` 的项）
- 导出 `maxNodeCount`

### 2. `App.vue` — 搜索框旁加筛选按钮 + Popover

- 搜索框区域增加一个 `el-button`（图标用 Filter），点击弹出 `el-popover`
- Popover 内放一个 `el-input-number`，绑定 `maxNodeCount`，placeholder "节点数上限"，clearable
- 布局：搜索框和筛选按钮同行（flex），搜索框 flex:1
