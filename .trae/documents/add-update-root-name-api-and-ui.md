# 新增 update_root_name 接口及 Dialog 树名称编辑功能

## 需求概述

1. 新增后端接口 `POST /update_root_name`，入参 `{ rootId, name }`，用于修改树的名称（`TreeRoot.treeName`）
2. 在树形模式下，双击图片打开 CompareDialog 时，在 dialog 顶部显示当前树的名称（灰色字体）+ 编辑按钮
   - 有 `treeName` 时显示名称，旁边放编辑按钮
   - 点击编辑 → 变成 input 输入框 + 确认修改按钮
3. rootId 取的是双击时定位到的**根节点**，不是被双击的叶子/孙子节点本身

---

## 实现步骤

### 第1步：新增 API 函数 `updateRootName`

**文件**: `src/api/tree.ts`

- 新增请求类型 `UpdateRootNameRequest`：`{ rootId: string; name: string }`
- 新增函数 `updateRootName(data: UpdateRootNameRequest)`，调用 `request.post('/update_root_name', data)`
- Mock 模式下返回 `Promise.resolve({ success: true })`

### 第2步：新增 Mock 支持

**文件**: `src/mock/tree-mock.ts`

- 新增 `mockUpdateRootName(rootId: string, name: string)` 函数
- 在 `mockRootIds` 数组中找到对应 rootId 的项，更新其 `treeName`
- 返回 `{ success: true }`

### 第3步：在 `useCompareDialog` composable 中增加树名称相关状态

**文件**: `src/composables/useCompareDialog.ts`

- 新增 `compareTreeName` ref，从 `allTrees.value[compareTreeIndex.value]?.treeName` 获取
- 新增 `compareTreeRootId` computed，从 `allTrees.value[compareTreeIndex.value]?.rootId` 获取
- 新增 `updateTreeName(newName: string)` 方法：
  1. 调用 `updateRootName({ rootId: compareTreeRootId.value, name: newName })`
  2. 成功后更新 `allTrees.value` 中对应项的 `treeName`（响应式更新）
  3. 更新 `compareTreeName` 的值
- 在 `watch(compareTreeIndex, ...)` 中同步更新 `compareTreeName`
- 在 `openCompareForNode` 中同步设置 `compareTreeName`
- 导出 `compareTreeName`、`compareTreeRootId`、`updateTreeName`

### 第4步：CompareDialog 组件 UI 改造

**文件**: `src/components/compare-dialog/index.vue`

- **新增 Props**:
  - `compareTreeName: string` — 当前树名称
  - `compareTreeRootId: string` — 当前树根 ID

- **新增 Emits**:
  - `update-tree-name: [name: string]` — 通知父组件更新树名称

- **UI 结构**（在 dialog body 最顶部，所有模板之前）:
  ```
  <div class="tree-name-bar">
    <!-- 显示模式 -->
    <template v-if="!isEditingName">
      <span class="tree-name-text" v-if="compareTreeName">{{ compareTreeName }}</span>
      <el-button size="small" :icon="Edit" @click="startEditName" />
    </template>
    <!-- 编辑模式 -->
    <template v-else>
      <el-input v-model="editingName" size="small" style="width: 200px" @keyup.enter="confirmEditName" />
      <el-button size="small" type="primary" @click="confirmEditName">修改</el-button>
      <el-button size="small" @click="cancelEditName">取消</el-button>
    </template>
  </div>
  ```

- **逻辑**:
  - `isEditingName` ref 控制显示/编辑切换
  - `editingName` ref 存储编辑中的文本
  - `startEditName()` — 设 `editingName = compareTreeName`，`isEditingName = true`
  - `confirmEditName()` — emit `update-tree-name` 事件，设 `isEditingName = false`
  - `cancelEditName()` — 设 `isEditingName = false`
  - 仅在 `viewMode === 'tree'` 时显示此栏

- **样式**:
  - `.tree-name-bar` — flex 水平布局，居中对齐，padding 6px，背景 #f5f7fa
  - `.tree-name-text` — 灰色字体，color #909399，font-size 14px
  - 编辑按钮使用 Element Plus 的 Edit 图标

### 第5步：App.vue 串联事件

**文件**: `src/App.vue`

- 从 `useCompareDialog` 解构新增的 `compareTreeName`、`compareTreeRootId`、`updateTreeName`
- 将 `compareTreeName` 和 `compareTreeRootId` 作为 prop 传给 CompareDialog
- 监听 `@update-tree-name` 事件，调用 `updateTreeName`

---

## 数据流

```
双击节点 → openCompareForNode(node)
  → 找到根节点 rootId，设置 compareTreeIndex
  → compareTreeName / compareTreeRootId 自动从 allTrees 派生
  → CompareDialog 顶部显示 treeName (灰色) + 编辑按钮
  → 点击编辑 → input + 修改按钮
  → 点击修改 → emit('update-tree-name', newName)
  → App.vue → updateTreeName(newName)
  → 调用 POST /update_root_name { rootId, name }
  → 成功后更新 allTrees 中对应项的 treeName
  → UI 自动响应更新
```

## 关键注意点

- rootId 始终取根节点的 ID，即使双击的是叶子/孙子节点，因为 `openCompareForNode` 已经通过 `allTrees.findIndex` 找到了根
- 树名称编辑功能仅在**树形模式**下显示（时间轴比对不需要）
- API 修改成功后需要同步更新本地 `allTrees` 数据，确保右侧树列表中的名称也能同步更新
