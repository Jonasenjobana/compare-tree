# 时间轴排序切换 + 图片懒加载 实现计划

## 需求概述
1. 在当前树形视图基础上，增加一个「时间轴」排序按钮。默认展示树形结构，点击切换按钮后，将同一棵树的所有节点展开为一维列表，按 `matchDate` 时间排序，并在节点上展示对应时间。再次点击切换回树形视图。
2. 图片懒加载：节点图片仅在进入视口可视区域时才请求加载，减少不必要的网络请求和渲染开销。

## 实现步骤

### 1. App.vue — 增加视图模式状态和切换按钮
- 新增响应式变量 `viewMode: ref<'tree' | 'timeline'>('tree')`，默认 `tree`
- 在 `preview-area` 的树筛选区域上方增加切换按钮组（使用 `el-radio-group`），包含「树形」和「时间轴」两个选项
- 将 `viewMode` 作为 prop 传递给 `AntVX6` 组件
- 同时把 `allTrees` 也传入组件（时间轴模式需要知道哪些节点属于同一棵树来分组展示）

### 2. types/index.ts — Node 类型确认
- `Node` 类型已有 `matchDate` 字段，无需修改

### 3. antv-x6-tree/index.vue — 核心改动

#### 3.1 新增 props
- `viewMode: 'tree' | 'timeline'`
- `trees: TreeRoot[]`（用于时间轴模式按树分组）

#### 3.2 图片懒加载机制
**核心思路**：初始渲染时所有节点图片设为占位符/空，节点进入可视区域后才设置真实图片 URL。

**具体实现**：
1. 新增 `updateVisibleImages()` 方法：
   - 调用 `graph.getVisibleArea()` 获取当前视口区域（返回 `{ x, y, width, height }`）
   - 遍历图中所有节点，对比节点位置与视口区域，判断是否在可视范围内（加一定 buffer，如 200px 预加载区域）
   - 对于刚进入可视区域的节点：通过 `node.attr('image/xlink:href', imageUrl)` 设置真实图片
   - 对于已加载图片的节点：跳过（使用 `Set<string> loadedNodeIds` 记录已加载节点）
2. 监听视口变化事件触发 `updateVisibleImages()`：
   - `graph.on('blank:mousewheel')` — 鼠标滚轮缩放
   - `graph.on('scroll:drag')` 或 `graph.on('blank:mousedown')` + `graph.on('blank:mouseup')` — 平移操作
   - `graph.on('scale')` — 缩放完成
3. 初始加载完成后（`loadData` 最后），调用一次 `updateVisibleImages()`
4. 新增 `loadedNodeIds: Set<string>` 变量，`loadData` 重新加载数据时清空此 Set

**图片占位**：
- 在 `layoutTree` 和 `layoutTimeline` 创建节点时，`image/xlink:href` 设为空字符串或一个轻量占位图
- 节点的 `data` 中保存真实 `imageUrl`，懒加载时从 `data` 取

#### 3.3 修改 `loadData` 方法
根据 `viewMode` 走不同布局路径：
- `tree` 模式：保持现有 `splitTrees` + `layoutTree` 逻辑
- `timeline` 模式：调用新的 `layoutTimeline` 方法
- 两种模式最后都调用 `updateVisibleImages()` 触发首次图片加载

#### 3.4 新增 `layoutTimeline` 方法
- 接收 `nodes: Node[]` 和 `trees: TreeRoot[]`
- 按 `rootId`（树根ID）对节点分组：遍历 `trees`，每棵树的节点归为一组
- 同一棵树内的节点按 `matchDate` 升序排序
- 布局策略：
  - 每棵树占一行（水平排列），不同树纵向排列
  - 同一树内节点从左到右按时间排列，节点之间间距固定（`TIMELINE_GAP_X = 120`）
  - 不同树之间纵向间距 `ROOT_GAP_Y = 140`（比树形模式略大，给时间标签留空间）
  - **不绘制边（edge）**——时间轴模式无需父子连线
- 返回 `{ nodes: positionedNodes, edges: [], minY, maxY }`

#### 3.5 时间轴模式节点样式
- 注册新节点类型 `timeline-card`，基于 `picture-card` 增加时间标签：
  - 在 markup 中增加 `timeLabel` 文本元素
  - 位置：节点下方（`refY: NODE_HEIGHT + 2`）
  - 字体：10px 灰色，显示 `matchDate`
- 树形模式继续使用 `picture-card`（无时间标签）

#### 3.6 时间轴模式树分组标识
- 每棵树行首添加一个纯文本标签节点（`shape: 'text-block'`），显示树根ID
- 使用较小字体，灰色背景区分

### 4. watch viewMode 变化
- 在 `antv-x6-tree/index.vue` 中 watch `viewMode`，变化时清空 `loadedNodeIds`，重新调用 `loadData`
- 在 `App.vue` 中 watch `viewMode`，无需额外处理（节点数据不变）

## 关键设计决策

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 时间轴排列方向 | 水平从左到右 | 符合时间轴直觉，左早右晚 |
| 不同树如何区分 | 每棵树占一行，行首显示树根ID标签 | 清晰区分，避免混淆 |
| 时间轴节点样式 | 注册 `timeline-card` 新类型 | 避免污染原 `picture-card`，职责清晰 |
| 边的处理 | 时间轴模式不显示边 | 一维排列无父子关系连线需求 |
| 切换交互 | `el-radio-group` 即时切换 | 操作简单直观 |
| 图片懒加载方式 | 视口检测 + 逐节点设置 `xlink:href` | X6 原生支持，无需额外库，可控性强 |
| 预加载策略 | 可视区域外扩 200px buffer | 平滑滚动体验，避免滚动时图片闪烁 |
| 图片占位 | 空字符串（显示节点 body 背景色） | 最轻量，无需额外占位图资源 |

## 涉及文件

1. **`src/App.vue`** — 添加 viewMode 状态、切换按钮、传递新 props
2. **`src/components/antv-x6-tree/index.vue`** — 核心：时间轴布局、图片懒加载、新节点类型、新 props、watch
