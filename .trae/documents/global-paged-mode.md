# 全局/分页查看模式计划

## 需求概述

增加"全局"和"分页"两种查看模式：

* **全局**：当前默认行为，显示所有树

* **分页**：每次只显示一颗树，画布底部出现"上一颗树"/"下一颗树"按钮，支持键盘左右切换

分页模式等同于 `selectedTreeId` 被设为某棵树的 rootId，即手动点击了右侧树列表中的某一项。

## 交互设计

### 模式切换

在视图模式行（树形/时间轴旁边）增加一个 radio-group：`全局` / `分页`

### 分页模式

* 切换到分页模式时，默认显示第一棵树（`filteredTrees[0]`）

* 画布底部浮层显示：`上一颗树` | `1/10` | `下一颗树`

* 点击"上一颗树"/"下一颗树"切换显示

* 键盘左右方向键也可切换

* 分页模式下，右侧树列表当前树高亮，点击其他树也可切换

### 全局模式

* `selectedTreeId` 设为空，显示所有树（现有行为）

### 模式切换逻辑

* 全局 → 分页：`selectedTreeId` 设为当前 `filteredTrees[0]`（或保持之前选中的）

* 分页 → 全局：`selectedTreeId` 设为空

## 实现步骤

### Step 1: 在 `useTreeData.ts` 中新增 `displayMode` 状态

```ts
const displayMode = ref<'global' | 'paged'>('global')

// 分页模式下当前树索引
const pagedTreeIndex = ref(0)
```

新增计算属性和方法：

```ts
const currentPagedTree = computed(() => filteredTrees.value[pagedTreeIndex.value] || null)

function switchToPagedMode() {
  displayMode.value = 'paged'
  if (!selectedTreeId.value && filteredTrees.value.length > 0) {
    pagedTreeIndex.value = 0
    selectedTreeId.value = filteredTrees.value[0].rootId
    nodes.value = convertTreeListToNodes(allTrees.value)
  }
}

function switchToGlobalMode() {
  displayMode.value = 'global'
  selectedTreeId.value = ''
  pagedTreeIndex.value = 0
  nodes.value = convertTreeListToNodes(allTrees.value)
}

function goToPrevTree() {
  if (pagedTreeIndex.value > 0) {
    pagedTreeIndex.value--
    selectedTreeId.value = filteredTrees.value[pagedTreeIndex.value].rootId
    nodes.value = convertTreeListToNodes(allTrees.value)
  }
}

function goToNextTree() {
  if (pagedTreeIndex.value < filteredTrees.value.length - 1) {
    pagedTreeIndex.value++
    selectedTreeId.value = filteredTrees.value[pagedTreeIndex.value].rootId
    nodes.value = convertTreeListToNodes(allTrees.value)
  }
}

const hasPrevTree = computed(() => pagedTreeIndex.value > 0)
const hasNextTree = computed(() => pagedTreeIndex.value < filteredTrees.value.length - 1)
```

修改 `changeSelectedTree`：在分页模式下，点击右侧树列表时同步更新 `pagedTreeIndex`：

```ts
function changeSelectedTree(rootId: string) {
  if (displayMode.value === 'paged') {
    // 分页模式下点击树列表，切换到对应树
    const idx = filteredTrees.value.findIndex(t => t.rootId === rootId)
    if (idx !== -1) {
      pagedTreeIndex.value = idx
      selectedTreeId.value = rootId
    }
  } else {
    // 全局模式下切换选中
    selectedTreeId.value = rootId === selectedTreeId.value ? '' : rootId
  }
  nodes.value = convertTreeListToNodes(allTrees.value)
}
```

修改 `displayMode` 的 watch：切换时自动更新 nodes。

### Step 2: 在 `App.vue` 模板中增加模式切换 UI

视图模式行增加全局/分页 radio：

```html
<div class="view-mode-row">
  <el-radio-group v-model="viewMode" size="small">
    <el-radio-button value="tree">树形</el-radio-button>
    <el-radio-button value="timeline">时间轴</el-radio-button>
  </el-radio-group>
  <el-radio-group v-model="displayMode" size="small" @change="onDisplayModeChange">
    <el-radio-button value="global">全局</el-radio-button>
    <el-radio-button value="paged">分页</el-radio-button>
  </el-radio-group>
  <!-- 原有排序按钮 -->
</div>
```

### Step 3: 画布底部增加分页控制浮层

在 canvas-area 内部，AntVX6 下方增加分页控制条（仅分页模式显示）：

```html
<div class="canvas-area">
  <AntVX6 ... />
  <div v-if="displayMode === 'paged'" class="paged-controls">
    <el-button size="small" :disabled="!hasPrevTree" @click="goToPrevTree">
      上一颗树
    </el-button>
    <span class="paged-info">
      {{ pagedTreeIndex + 1 }} / {{ filteredTrees.length }}
    </span>
    <el-button size="small" :disabled="!hasNextTree" @click="goToNextTree">
      下一颗树
    </el-button>
  </div>
</div>
```

样式：固定在画布底部居中，半透明背景。

### Step 4: 键盘左右切换

在 App.vue 中监听键盘事件（分页模式下）：

```ts
function handleGlobalKeydown(e: KeyboardEvent) {
  if (compareVisible.value) return // 比对弹窗打开时不处理
  if (displayMode.value !== 'paged') return
  if (e.key === 'ArrowLeft') goToPrevTree()
  else if (e.key === 'ArrowRight') goToNextTree()
}

onMounted(() => {
  loadTreeData()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
```

### Step 5: 树列表项点击时同步分页状态

分页模式下点击树列表，`changeSelectedTree` 已在 Step 1 中处理了 `pagedTreeIndex` 同步。同时高亮状态也自动正确，因为 `selectedTreeId` 已更新。

## 涉及文件

| 文件                               | 修改内容                                       |
| -------------------------------- | ------------------------------------------ |
| `src/composables/useTreeData.ts` | 新增 displayMode、pagedTreeIndex、切换/导航函数、计算属性 |
| `src/App.vue`                    | 模板增加模式切换 radio + 画布底部分页控制 + 键盘监听 + 样式      |

## 不涉及的文件

* `src/components/antv-x6-tree/index.vue` — 无需修改，它只接收 nodes/trees 数据

* `src/components/compare-dialog/index.vue` — 无需修改

