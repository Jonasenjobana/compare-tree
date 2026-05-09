# Picture-Tree 项目交接文档

## 项目概述

图片树形关系可视化比对系统。后端返回以根节点为起点的递归树结构（图片间相似匹配关系），前端以树形/时间轴两种模式展示，支持双击进入全屏比对、人工审核、相似图片搜索等功能。

## 技术栈

| 层面 | 选型 |
|------|------|
| 框架 | Vue 3 + TypeScript + `<script setup>` |
| 构建 | Vite 8 |
| UI | Element Plus |
| 图可视化 | AntV X6（生产）+ GoJS（已弃用，有水印问题） |
| 图布局 | @antv/layout AntVDagreLayout（LR方向） |
| 图片查看 | v-viewer（viewer.js） |
| HTTP | Axios |
| 状态管理 | Composables（useTreeData / useCompareDialog），Pinia 已安装但未使用 |

## 目录结构

```
src/
├── api/tree.ts              # API 层（含 Mock 开关）
├── composables/
│   ├── useTreeData.ts       # 树数据管理（加载/切换/搜索）
│   └── useCompareDialog.ts  # 比对对话框状态管理
├── components/
│   ├── antv-x6-tree/        # AntV X6 树形/时间轴画布组件（生产用）
│   ├── compare-dialog/      # 全屏比对对话框
│   ├── search-history-dialog/ # 相似图片搜索结果对话框
│   ├── context-menu/        # 通用右键菜单组件
│   └── preview-panel/       # 右侧节点信息面板
├── mock/tree-mock.ts        # Mock 数据
├── types/index.ts           # 全局类型定义
├── utils/
│   ├── tree-utils.ts        # 树遍历/CompareFrame构建
│   ├── gojs-utils.ts        # 连线样式计算（X6/GoJS共用）
│   └── request.ts           # Axios 封装，baseURL=/api，超时10s
└── App.vue                  # 主入口，串联所有组件和事件
```

## 后端接口

API 代理：Vite dev server 将 `/api` 代理到 `http://192.168.1.155:5889`

| 接口 | 方法 | 入参 | 说明 |
|------|------|------|------|
| `/get_all_root_ids` | GET | — | 返回所有树的根列表 `{ success, count, roots: TreeRoot[] }` |
| `/get_tree_by_root_id` | GET | `rootId` | 返回单棵树完整数据 `{ success, tree: TreeRoot }` |
| `/batch_review` | POST | `{ records: [{ selfId, reviewResult }] }` | 批量提交人工审核 |
| `/update_root_name` | POST | `{ rootId, name }` | 修改树名称（TreeRoot.treeName） |
| `/search_history` | POST | `{ selfId, top_k? }` | 根据节点ID查询最相似图片 |

## 核心类型

```typescript
// 递归树节点
interface TreeNode {
  id: string; selfId: string; selfUrl: string
  parentId: string; parentUrl: string
  rootId: string; rootUrl: string
  matchDate: string; score: number
  children: TreeNode[]
  manualReview: string; reviewResult: string; intelligentRecommend: string
}

// 树根
interface TreeRoot {
  rootId: string; rootUrl: string
  tree?: TreeNode; treeName: string; maxMatchDate: string
}

// 扁平化节点（用于画布渲染）
interface Node {
  id: string; parentId: string; selfId: string
  score: number; matchDate: string
  imageUrl: string; selfUrl: string; rootId: string
  isModified?: boolean; reviewResult?: string
}

// 比对帧（BFS遍历生成）
interface CompareFrame {
  parent: TreeNode; children: TreeNode[]; position: string
}

// 搜索历史结果
interface SearchHistoryItem { name: string; score: number; url: string }
```

## 数据流

```
App.vue
 ├── useTreeData()
 │    ├── loadTreeData()       → getAllRootIds() → 填充 allTrees
 │    ├── loadTreeByRootId()   → getTreeByRootId() → buildNodesFromTree() → nodes[]
 │    └── goToPrevTree/Next()  → 切换 selectedTreeId → focusNodeId 定位根节点
 │
 ├── useCompareDialog(allTrees, viewMode, loadTreeByRootId)
 │    ├── openCompareForNode() → 找根 → getTreeByRootId()
 │    │   ├── timeline模式 → loadCompareTreeFromData() → 扁平排序节点
 │    │   └── tree模式 → findTreeNodeById → buildTreeCompareFrames() → CompareFrame[]
 │    ├── updateTreeName()     → POST /update_root_name → 更新 allTrees 同步UI
 │    └── 跨树翻页 prevCompareTree/nextCompareTree → 动态加载
 │
 ├── AntVX6(nodes, focusNodeId, viewMode, ...)
 │    ├── 双击节点 → nodeDoubleClick → openCompareForNode
 │    ├── 单击边 → edgeClick → openCompareForNode(父节点, 子ID)
 │    └── locateNode(focusNodeId) → 画布定位
 │
 ├── CompareDialog(全屏el-dialog)
 │    ├── 树形比对：左上父图 + 子图(2/4宫格,帧/页翻页,审核按钮)
 │    ├── 时间轴比对：左上根图 + 按时间排序子图
 │    ├── 单图预览：无子节点时
 │    ├── 顶部树名称栏(显示/编辑切换)
 │    ├── 右键图片 → ContextMenu → "相似图片匹配"
 │    └── ESC行为：v-viewer打开时只关查看器不关dialog
 │
 ├── SearchHistoryDialog(独立全屏dialog)
 │    ├── 左上原图 + 10张相似结果(2/4宫格,分页)
 │    └── 双击打开v-viewer
 │
 └── PreviewPanel(右侧面板)
      └── 显示选中节点图片/信息
```

## 功能特性

### 画布交互
- **双击节点**：打开比对对话框，从该节点开始 BFS 生成比对帧
- **单击边**：等效于双击边的父节点，并定位到对应子节点所在帧
- **树切换**：上一颗/下一颗树，自动定位到根节点
- **键盘**：左右方向键切换树（比对对话框未打开时）

### 比对对话框
- **树形模式**：帧(CompareFrame)→页(childPageSize)两级分页；2/4宫格切换
- **时间轴模式**：单级分页；2/4宫格切换
- **审核**：✔/✘按钮 + 提交批量审核
- **跨树翻页**：帧/页翻到头自动跳上/下一棵树
- **树名称编辑**：灰色文字+编辑按钮 ↔ input输入框+修改/取消
- **ESC**：v-viewer打开时只关查看器；否则关dialog
- **右键图片**：ContextMenu → "相似图片匹配" → SearchHistoryDialog

### 右键菜单（通用组件）
- `ContextMenu` 组件，通过 `show(x,y)` 打开
- 支持 `ContextMenuItem[]`：label/icon/handler/divided/disabled
- 点击菜单项/空白/ESC 自动关闭
- Teleport to body，z-index 9999

### 相似图片搜索
- 右键图片 → "相似图片匹配" → POST `/search_history` → SearchHistoryDialog
- 左上原匹配图 + 10张相似结果，2/4宫格，分页浏览
- score 标签显示，双击打开 v-viewer

## Mock 机制

- `.env.mock` 设 `VITE_USE_MOCK=true`，`npm run dev:mock` 启动
- `.env.development` 设 `VITE_USE_MOCK=false`，走真实后端
- Mock 数据：3棵树(A-001/B-001/C-001)，本地图片 `/XZZD15557_2_v0.jpg`

## 关键约定

1. **rootId 始终取根节点**：无论双击叶子/孙子节点，`openCompareForNode` 通过 `allTrees.findIndex` 定位根
2. **审核状态**：`reviewResult` 字段值 `'一致'`/`'不一致'`，中文
3. **连线颜色**：审核一致→绿，不一致→红，手动修改→橙，score>0.8→浅绿，其他→灰
4. **图片懒加载**：X6画布 `updateVisibleImages()` 只加载视口内图片
5. **CompareDialog 与 SearchHistoryDialog 完全独立**：代码不耦合，各自处理ESC/v-viewer
6. **GoJS 已弃用**：`src/components/gojs-tree/` 保留但未引用，有水印问题
