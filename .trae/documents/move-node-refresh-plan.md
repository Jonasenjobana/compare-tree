# 移动节点后刷新渲染计划

## 需求分析

`/move_tree_node` 接口新增了 `selfId` 和 `rootId` 两个返回字段，用于移动成功后定位正确的树并刷新渲染。

移动节点后有两种情况：
1. **作为根节点**（未选中匹配图，parentId 为空）：节点变成了新根节点，需要用自身的 `selfId` 作为 `rootId` 调用 `getTreeByRootId` 查询并渲染
2. **作为子节点插入**（选中了匹配图）：节点被移到了另一棵树，需要用接口返回的 `rootId` 调用 `getTreeByRootId` 查询并渲染

两种情况都需要：
- 关闭 CompareDialog
- 更新侧边栏树列表（重新拉取 allTrees）
- 定位到新的 rootId 对应的树
- 刷新画布和节点列表

## 实现步骤

### 1. 更新 `MoveTreeNodeRequest` 接口和 `moveTreeNode` 返回类型

**文件**: `src/api/tree.ts`

- 给 `moveTreeNode` 的返回值定义类型 `MoveTreeNodeResponse`，包含 `selfId` 和 `rootId`
- 更新 `moveTreeNode` 函数签名的返回类型

### 2. 更新 SearchHistoryDialog 的 `move-success` emit 传递 `rootId`

**文件**: `src/components/search-history-dialog/index.vue`

- `confirmMove` 成功后，从 `moveTreeNode` 返回值中提取 `rootId`
- 修改 `move-success` 事件，携带 `rootId: string` 参数
- 如果 `rootId` 为空（节点作为根节点），用 `selfId` 作为 `rootId`

### 3. 更新 App.vue 的 `handleMoveSuccess` 处理

**文件**: `src/App.vue`

- `handleMoveSuccess(rootId: string)` 接收新 rootId
- 关闭 CompareDialog
- 先调用 `getAllRootIds()` 刷新侧边栏列表（因为移动可能产生新根节点）
- 再调用 `changeSelectedTree(rootId)` 定位到目标树并刷新画布

### 4. 更新 `useTreeData` 的 `changeSelectedTree` 确保列表同步

**文件**: `src/composables/useTreeData.ts`

- 新增 `loadAllRootIds()` 方法，重新拉取并更新 `allTrees`
- 或者直接在 `handleMoveSuccess` 中调用已有的 `loadTreeData` 但保留当前选中状态

## 数据流

```
SearchHistoryDialog.confirmMove()
  → moveTreeNode() 返回 { selfId, rootId }
  → emit('move-success', rootId || selfId)

App.handleMoveSuccess(newRootId)
  → compareVisible = false (关闭比对对话框)
  → getAllRootIds() (刷新侧边栏列表)
  → changeSelectedTree(newRootId) (定位+渲染新树)
```
