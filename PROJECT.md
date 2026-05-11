# Picture-Tree 图片树形关系可视化比对系统

## 项目简介

后端返回以根节点为起点的递归树结构（图片间相似匹配关系），前端以树形/时间轴两种模式展示，支持双击进入全屏比对、人工审核、相似图片搜索等功能。

## 技术栈

| 层面 | 选型 |
|------|------|
| 框架 | Vue 3 + TypeScript + `<script setup>` |
| 构建 | Vite 8 |
| UI | Element Plus |
| 图可视化 | AntV X6（生产）+ GoJS（已弃用） |
| 图布局 | @antv/layout AntVDagreLayout |
| 图片查看 | v-viewer（viewer.js） |
| HTTP | Axios |
| 状态管理 | Composables + Pinia |

## 目录结构

```
src/
├── api/tree.ts              # API 层（含 Mock 开关）
├── composables/
│   ├── useTreeData.ts       # 树数据管理（加载/切换/搜索）
│   └── useCompareDialog.ts  # 比对对话框状态管理
├── components/
│   ├── antv-x6-tree/        # AntV X6 树形/时间轴画布组件
│   ├── compare-dialog/       # 全屏比对对话框
│   ├── search-history-dialog/# 相似图片搜索结果对话框
│   ├── context-menu/         # 通用右键菜单组件
│   └── preview-panel/       # 右侧节点信息面板
├── mock/tree-mock.ts        # Mock 数据
├── types/index.ts           # 全局类型定义
├── utils/
│   ├── tree-utils.ts        # 树遍历/CompareFrame构建
│   ├── gojs-utils.ts        # 连线样式计算
│   └── request.ts           # Axios 封装
└── App.vue                  # 主入口
```

## 核心功能

### 1. 树形可视化
- 使用 AntV X6 渲染图片节点和连线关系
- 支持树形模式和时间轴模式切换
- 图片懒加载优化性能

### 2. 全屏比对
- 双击节点打开比对对话框
- 支持2宫格/4宫格视图切换
- 人工审核功能（一致/不一致）
- 批量提交审核结果

### 3. 相似图片搜索
- 右键菜单选择"相似图片匹配"
- 查询并展示最相似的10张图片

### 4. 树切换
- 支持切换上一颗/下一颗树
- 自动定位到根节点

## 后端接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/get_all_root_ids` | GET | 获取所有树的根列表 |
| `/get_tree_by_root_id` | GET | 获取单棵树完整数据 |
| `/batch_review` | POST | 批量提交人工审核 |
| `/update_root_name` | POST | 修改树名称 |
| `/search_history` | POST | 根据节点ID查询相似图片 |

## 核心类型

```typescript
// 递归树节点
interface TreeNode {
  id: string; selfId: string; selfUrl: string
  parentId: string; parentUrl: string
  rootId: string; rootUrl: string
  matchDate: string; score: number
  children: TreeNode[]
  manualReview: string; reviewResult: string
}

// 扁平化节点（用于画布渲染）
interface Node {
  id: string; parentId: string; selfId: string
  score: number; matchDate: string
  imageUrl: string; selfUrl: string; rootId: string
  isModified?: boolean; reviewResult?: string
}
```

## 开发命令

```sh
pnpm install     # 安装依赖
pnpm dev         # 开发模式（连接真实后端）
pnpm dev:mock    # 开发模式（使用Mock数据）
pnpm build       # 构建生产版本
```
