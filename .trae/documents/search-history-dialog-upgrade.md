# SearchHistoryDialog 改造计划 — 新增移动节点功能

## 一、需求分析

### 背景
当前 `SearchHistoryDialog` 仅展示搜索结果（原图 + 10张相似图），不具备交互功能。现需改造为「移动节点」操作页面，用户可以通过搜索结果选择新父节点，并调用 `/move_tree_node` 接口完成节点移动。

### 新增接口
```
POST /move_tree_node
{
  "selfId": "DNS1833_1",       // 要移动的节点ID
  "parentId": "DNS1833_2",     // 新的父节点ID（移除节点时为空）
  "score": 80                  // 搜索历史接口的score（移除节点时为100）
}
```

### 功能详述
1. **上方预览区**：原图（左） + 新选择的节点（右）并排展示
2. **默认状态**：新节点位置显示原节点的当前父节点（来自树结构中的 parentId）
3. **下方列表区**：搜索结果列表，可横向滚动，点击某项 → 替换上方新节点
4. **重置按钮**：还原为原父节点
5. **移除节点**：新节点右上角 ✕ 按钮 → 调用接口 parentId='' score=100，即该节点变为新根节点
6. **确认移动**：点击"确认移动"按钮 → 调用 `/move_tree_node` 接口 → 成功后刷新画布

### 关键传参逻辑
- 正常移动：`{ selfId, parentId: 选中节点的name(即selfId), score: 选中节点的score }`
- 移除节点（变为根）：`{ selfId, parentId: '', score: 100 }`
- 重置：还原到原始父节点，不调用接口

---

## 二、UI 设计方案

### 页面布局（全屏对话框）
```
┌─────────────────────────────────────────────────┐
│  移动节点                                  [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│   ┌──────────┐          ┌──────────┐           │
│   │          │          │      [✕] │           │
│   │   原图    │    →    │  新节点   │           │
│   │          │          │          │           │
│   └──────────┘          └──────────┘           │
│    原节点ID              新父节点ID              │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  [重置]                        [确认移动] │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ─ ─ ─ ─ 搜索结果（点击选择新父节点） ─ ─ ─ ─  │
│                                                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ → 滚动   │
│  │ 图1 │ │ 图2 │ │ 图3 │ │ 图4 │ │ 图5 │       │
│  │0.96 │ │0.94 │ │0.93 │ │0.91 │ │0.89 │       │
│  └────┘ └────┘ └────┘ └────┘ └────┘           │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 设计要点
1. **上方预览区**：两图并排（flex row），各占约 40% 宽度，中间有 → 箭头
2. **新节点图片右上角 ✕**：绝对定位，点击后清空新节点（此时确认移动会按"移除节点"逻辑传参）
3. **操作栏**：重置按钮（还原到原父节点）+ 确认移动按钮（主色调）
4. **下方搜索结果列表**：横向滚动（flex row + overflow-x: auto），每张图显示缩略图 + score，选中高亮边框
5. **选中态**：当前被选为新节点的图在列表中有高亮边框标识

---

## 三、前端实现步骤

### 步骤 1：新增 API 接口
**文件**: `src/api/tree.ts`

- 新增 `MoveTreeNodeRequest` 接口类型
- 新增 `moveTreeNode()` 函数，POST `/move_tree_node`

### 步骤 2：改造 SearchHistoryDialog Props 和状态
**文件**: `src/components/search-history-dialog/index.vue`

新增 props：
- `sourceSelfId: string` — 原节点的 selfId（移动接口需要）
- `sourceParentId: string` — 原节点的父节点 selfId
- `sourceParentUrl: string` — 原节点父节点的图片 URL

新增 emit：
- `move-success` — 移动成功后通知父组件刷新

新增内部状态：
- `selectedNode: { name, score, url } | null` — 当前选中的新父节点
- 初始值 = 原父节点信息（从 props 传入）
- `originalParent` — 保存原始父节点信息（用于重置）

### 步骤 3：重构 SearchHistoryDialog 模板
**文件**: `src/components/search-history-dialog/index.vue`

布局改为：
1. 顶部区域：原图 + 箭头 + 新节点（右上角 ✕ 按钮）
2. 操作栏：重置按钮 + 确认移动按钮
3. 底部区域：搜索结果横向滚动列表，点击选中

### 步骤 4：实现核心交互逻辑
**文件**: `src/components/search-history-dialog/index.vue`

- 点击列表中图片 → 设置 selectedNode
- 点击 ✕ → 清空 selectedNode（标记为"移除节点"模式）
- 点击重置 → selectedNode = originalParent
- 点击确认移动 → 判断是"正常移动"还是"移除节点"→ 调用 moveTreeNode → emit('move-success')
- 选中高亮：列表中与 selectedNode 匹配的项有高亮边框

### 步骤 5：App.vue 适配
**文件**: `src/App.vue`

- `handleSearchHistory` 函数增加参数：传入原节点的 parentId 和 parentUrl
- SearchHistoryDialog 组件增加 props: sourceSelfId, sourceParentId, sourceParentUrl
- 监听 `move-success` 事件 → 刷新当前树数据（refreshCurrentTree）

### 步骤 6：CompareDialog 适配
**文件**: `src/components/compare-dialog/index.vue`

- `search-history` 事件需要额外传递当前节点的 parentId 信息
- 或者通过 App.vue 中根据 selfId 查找节点信息来获取 parentId（当前 App.vue 的 handleSearchHistory 已经做了这个查找，只需扩展）

---

## 四、涉及文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/api/tree.ts` | 修改 | 新增 moveTreeNode 接口 |
| `src/components/search-history-dialog/index.vue` | 重构 | 改造为移动节点功能页面 |
| `src/App.vue` | 修改 | 传递新 props、监听新事件、刷新逻辑 |
| `src/components/compare-dialog/index.vue` | 微调 | search-history 事件传递更多节点信息（可选，App.vue 可自行查找） |

---

## 五、风险点与注意事项

1. **parentId 为空的处理**：移除节点时 `parentId` 传空字符串，需确认后端接受空字符串还是 null
2. **score 精度**：SearchHistoryItem 的 score 是浮点数（如 0.962341），但移动接口示例中 score 是整数 80，需确认后端是否接受浮点数还是需要乘以 100 转整数
3. **刷新时机**：移动成功后需刷新画布，但当前比对对话框可能还开着，需确认是否需要关闭对话框
4. **Mock 数据**：新增 moveTreeNode 的 mock 处理（可选，开发阶段可能直接走真实后端）
