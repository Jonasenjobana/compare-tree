# 新增右键菜单组件 + 相似图片搜索功能

## 需求概述

1. **封装通用右键菜单组件**：类似 Windows 右键菜单，支持自定义菜单项
2. **CompareDialog 中右键图片**：弹出右键菜单，点击"相似图片匹配" → 调用 `/search_history` 接口 → 打开新的 SearchHistoryDialog 展示原匹配图片 + 10张最相似图片（支持 2/4 宫格）
3. **新增独立组件 SearchHistoryDialog**：不复用 CompareDialog，后续可扩展

---

## 实现步骤

### 第1步：新增类型定义

**文件**: `src/types/index.ts`

```typescript
// 搜索历史 - 单条结果
export interface SearchHistoryItem {
  name: string
  score: number
  url: string
}

// 搜索历史 - 接口响应
export interface SearchHistoryResponse {
  success: boolean
  selfId: string
  history_size: number
  top_k: number
  results: SearchHistoryItem[]
}
```

### 第2步：新增 API 函数

**文件**: `src/api/tree.ts`

```typescript
export interface SearchHistoryRequest {
  selfId: string
  top_k?: number
}

export function searchHistory(data: SearchHistoryRequest): Promise<SearchHistoryResponse> {
  if (USE_MOCK) {
    return mockSearchHistory(data.selfId)
  }
  return request.post<SearchHistoryResponse, SearchHistoryResponse>('/search_history', data)
}
```

### 第3步：新增 Mock 支持

**文件**: `src/mock/tree-mock.ts`

- 新增 `mockSearchHistory(selfId: string)` 函数
- 返回固定的 mock 数据：10 条带 name/score/url 的结果
- url 使用 `MOCK_IMAGE`

### 第4步：封装通用右键菜单组件 `ContextMenu`

**新建文件**: `src/components/context-menu/index.vue`

**功能设计**：
- 通过 props 传入菜单项列表 `items: ContextMenuItem[]`
- 菜单项类型定义：
  ```typescript
  export interface ContextMenuItem {
    label: string          // 显示文本
    icon?: Component       // 可选图标
    handler: () => void    // 点击回调
    divided?: boolean      // 是否显示分割线
    disabled?: boolean     // 是否禁用
  }
  ```
- 通过 `show(x, y)` 方法在指定坐标打开菜单
- 点击菜单项后自动关闭
- 点击空白处自动关闭
- ESC 关闭
- 固定定位，出现在鼠标位置
- 样式仿 Windows 右键菜单：白色背景、阴影、hover 高亮、分割线

**组件 API**：
```typescript
// 通过 defineExpose 暴露 show 方法
const show = (x: number, y: number) => { ... }
defineExpose({ show })
```

**UI 结构**：
```
<div class="context-menu" v-if="visible" :style="{ left: x + 'px', top: y + 'px' }">
  <div v-for="item in items" class="context-menu-item" @click="handleItemClick(item)">
    <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
    <span>{{ item.label }}</span>
  </div>
</div>
```

**样式**：
- `position: fixed; z-index: 9999;`
- 白色背景、圆角、阴影
- 菜单项 hover 高亮 (#f5f7fa)
- 分割线样式
- 禁用状态灰色

### 第5步：新建 SearchHistoryDialog 组件

**新建文件**: `src/components/search-history-dialog/index.vue`

**功能设计**：
- 全屏 el-dialog，标题 "相似图片匹配"
- 左上格显示**原匹配图片**（右键的那张）
- 其余格子显示搜索到的 10 张相似图片（带 score 标签）
- 支持 2 宫格 / 4 宫格切换
- 支持分页（与 CompareDialog 类似）
- 双击图片可打开 v-viewer 大图查看
- ESC 处理（v-viewer 打开时不关 dialog）

**Props**：
```typescript
{
  modelValue: boolean              // v-model 控制显隐
  sourceImage: string              // 原图 URL
  sourceLabel: string              // 原图标签（selfId）
  results: SearchHistoryItem[]     // 搜索结果列表
}
```

**内部状态**：
- `gridMode`: '2' | '4'，默认 '4'
- `page`: 当前页
- `childPageSize`: computed，2宫格=1，4宫格=3
- `maxPage`: computed
- `isViewerOpen`: ref，控制 ESC 行为

**UI 布局**（参考 CompareDialog 的 compare-body 结构）：
```
<el-dialog fullscreen :close-on-press-escape="!isViewerOpen">
  <div class="search-body">
    <div class="compare-grid" :class="gridClass">
      <!-- 左上：原图 -->
      <div class="compare-cell">
        <el-image :src="sourceImage" @dblclick="openImageViewer" />
        <div class="compare-label">{{ sourceLabel }} (原匹配图)</div>
      </div>
      <!-- 右侧/下方：搜索结果 -->
      <div v-for="i in childPageSize" class="compare-cell">
        <template v-if="results[page * childPageSize + i - 1]">
          <el-image :src="item.url" @dblclick="openImageViewer" />
          <div class="score-badge">{{ item.score }}</div>
          <div class="compare-label">{{ item.name }}</div>
        </template>
      </div>
    </div>
    <!-- 底部控制栏 -->
    <div class="compare-controls">
      <el-radio-group v-model="gridMode">2宫格/4宫格</el-radio-group>
      <el-button>上一页</el-button>
      <span>页码信息</span>
      <el-button>下一页</el-button>
    </div>
  </div>
</el-dialog>
```

**样式**：复用 CompareDialog 的 compare-grid/compare-cell/compare-controls 等样式类（抽离到公共样式或直接复制，因为两个组件结构类似但不耦合）

### 第6步：在 CompareDialog 中集成右键菜单

**文件**: `src/components/compare-dialog/index.vue`

- 引入 `ContextMenu` 组件和 `SearchHistoryItem` 类型
- 新增 `contextMenuRef` 模板引用
- 为所有图片（左上原图 + 子节点图片 + 单图预览）添加 `@contextmenu.prevent` 事件
- 右键事件处理：
  ```typescript
  function handleImageContextMenu(e: MouseEvent, selfId: string) {
    contextMenuItems.value = [
      {
        label: '相似图片匹配',
        icon: Search,
        handler: () => emit('search-history', selfId),
        divided: false,
      }
    ]
    contextMenuRef.value?.show(e.clientX, e.clientY)
  }
  ```
- 新增 emit：`'search-history': [selfId: string]`
- 右键需要区分图片来源：
  - 左上原图：`currentFrame.parent.selfId`
  - 子节点图片：`currentFrame.children[index].selfId`
  - 单图预览：`singlePreviewLabel`（即 selfId）
  - 时间轴模式：同上

### 第7步：App.vue 串联

**文件**: `src/App.vue`

- 引入 `SearchHistoryDialog` 组件
- 新增状态：
  ```typescript
  const searchHistoryVisible = ref(false)
  const searchHistorySourceImage = ref('')
  const searchHistorySourceLabel = ref('')
  const searchHistoryResults = ref<SearchHistoryItem[]>([])
  ```
- 新增方法 `handleSearchHistory(selfId: string)`：
  1. 从当前 nodes 中找到该 selfId 对应的节点获取 imageUrl
  2. 设置 sourceImage / sourceLabel
  3. 调用 `searchHistory({ selfId, top_k: 10 })` 获取结果
  4. 设置 results，打开 SearchHistoryDialog
- CompareDialog 新增 `@search-history="handleSearchSelfId"` 事件监听

---

## 数据流

```
CompareDialog 中右键图片
  → contextmenu.prevent 事件
  → ContextMenu 组件显示 "相似图片匹配" 菜单项
  → 点击菜单项 → emit('search-history', selfId)
  → App.vue.handleSearchHistory(selfId)
  → 调用 POST /search_history { selfId, top_k: 10 }
  → 设置 sourceImage/sourceLabel/results
  → 打开 SearchHistoryDialog
  → 展示原图 + 10张相似图（2/4宫格，分页）
```

## 关键注意点

- **ContextMenu 是通用组件**，后续可在其他地方（如 AntVX6 画布节点右键）复用
- **SearchHistoryDialog 是独立组件**，不复用 CompareDialog 代码，避免耦合
- 右键菜单在 CompareDialog 的 el-dialog 内使用，需要 `append-to-body` 或确保 z-index 正确
- v-viewer 打开时 ESC 行为：SearchHistoryDialog 和 CompareDialog 都需要处理（各自独立）
- Mock 数据的 url 使用本地 MOCK_IMAGE 以便开发测试

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/index.ts` | 修改 | 新增 SearchHistoryItem / SearchHistoryResponse 类型 |
| `src/api/tree.ts` | 修改 | 新增 searchHistory API |
| `src/mock/tree-mock.ts` | 修改 | 新增 mockSearchHistory |
| `src/components/context-menu/index.vue` | **新建** | 通用右键菜单组件 |
| `src/components/search-history-dialog/index.vue` | **新建** | 相似图片匹配对话框 |
| `src/components/compare-dialog/index.vue` | 修改 | 集成右键菜单 + 新增 emit |
| `src/App.vue` | 修改 | 串联 SearchHistoryDialog + 事件处理 |
