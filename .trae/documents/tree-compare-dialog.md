# 树形模式比对弹窗改造计划

## 需求概述

双击节点打开的比对弹窗，根据当前视图模式分两种行为：

- **时间轴模式**：保持现有逻辑（根节点固定左上角，其余按时间排序展示，3个一页，翻页/切组）
- **树形模式**：改为层次遍历逻辑

### 树形模式遍历规则

以双击的节点为起点，进行类BFS遍历，每个节点依次作为"父节点"固定在左上角，其子节点展示在剩余3个格子中：

1. 双击节点 = 第一个父节点（左上角），其子节点填充剩余3格（不足3个用灰色占位）
2. 当该父节点的子节点展示完 → 进入子节点所在层级的**第一个节点**作为新父节点
3. 新父节点的子节点展示完后 → 继续遍历**同级的下一个节点**作为父节点
4. 同级全部遍历完 → 进入下一层级，重复上述逻辑
5. 整棵树遍历完 → 显示"下一颗树"按钮，可切换到下一棵树重复此逻辑

**左上角标签**：显示树的根节点名 + 当前层级（如 `ROOT-001 | 第2层`）

### 遍历示例

```
A (双击节点)
├── B
│   ├── D
│   └── E
├── C
│   ├── F
│   └── G
│       └── H
```

| 帧 | 左上角(父) | 剩余3格(子) | 层级 |
|----|-----------|------------|------|
| 1  | A         | B, C, 灰   | 1    |
| 2  | B         | D, E, 灰   | 2    |
| 3  | C         | F, G, 灰   | 2    |
| 4  | D         | 灰,灰,灰   | 3    |
| 5  | E         | 灰,灰,灰   | 3    |
| 6  | F         | 灰,灰,灰   | 3    |
| 7  | G         | H, 灰,灰   | 3    |
| 8  | H         | 灰,灰,灰   | 4    |

遍历完 → 显示"下一颗树"按钮

---

## 实现步骤

### Step 1: 新增响应式变量

在 `App.vue` script 中新增：

```ts
// 树形模式比对帧序列
interface CompareFrame {
  parent: TreeNode        // 左上角父节点
  children: TreeNode[]    // 其子节点列表
  level: number           // 当前层级（1-based，相对双击节点）
  rootName: string        // 树的根节点名
}
const compareTreeFrames = ref<CompareFrame[]>([])
const compareFrameIndex = ref(0)      // 当前帧索引
const compareChildPage = ref(0)       // 当前帧内子节点分页（3个一页）
```

### Step 2: 新增 `buildTreeCompareFrames` 函数

BFS遍历树，构建帧序列：

```ts
function buildTreeCompareFrames(startNode: TreeNode, treeRoot: TreeRoot): CompareFrame[] {
  const frames: CompareFrame[] = []
  const rootName = treeRoot.rootId
  const queue: { node: TreeNode; level: number }[] = [{ node: startNode, level: 1 }]

  while (queue.length > 0) {
    const { node, level } = queue.shift()!
    frames.push({
      parent: node,
      children: node.children ? [...node.children] : [],
      level,
      rootName,
    })
    if (node.children) {
      node.children.forEach(child => queue.push({ node: child, level: level + 1 }))
    }
  }
  return frames
}
```

### Step 3: 修改 `handleNodeDoubleClick`

根据 `viewMode` 分流：

```ts
const handleNodeDoubleClick = (node: Node) => {
  const idx = allTrees.value.findIndex(t => {
    let found = false
    function walk(n: TreeNode) {
      if (n.selfId === node.id) found = true
      if (n.children) n.children.forEach(c => walk(c))
    }
    walk(t.tree)
    return found
  })
  if (idx === -1) return
  compareTreeIndex.value = idx

  if (viewMode.value === 'timeline') {
    // 保持原有逻辑
    loadCompareTree(idx)
  } else {
    // 树形模式：找到双击的TreeNode，构建BFS帧
    const tree = allTrees.value[idx]
    const startNode = findTreeNodeById(tree.tree, node.id)
    if (!startNode) return
    compareTreeFrames.value = buildTreeCompareFrames(startNode, tree)
    compareFrameIndex.value = 0
    compareChildPage.value = 0
  }
  compareVisible.value = true
}
```

新增辅助函数 `findTreeNodeById`：

```ts
function findTreeNodeById(root: TreeNode, id: string): TreeNode | null {
  if (root.selfId === id) return root
  if (root.children) {
    for (const child of root.children) {
      const found = findTreeNodeById(child, id)
      if (found) return found
    }
  }
  return null
}
```

### Step 4: 新增树形模式计算属性

```ts
const currentFrame = computed(() => compareTreeFrames.value[compareFrameIndex.value] || null)
const maxChildPage = computed(() => {
  if (!currentFrame.value) return 1
  return Math.max(1, Math.ceil(currentFrame.value.children.length / 3))
})
const isLastChildPage = computed(() => compareChildPage.value >= maxChildPage.value - 1)
const isLastFrame = computed(() => compareFrameIndex.value >= compareTreeFrames.value.length - 1)
const isFirstChildPage = computed(() => compareChildPage.value === 0)
const isFirstFrame = computed(() => compareFrameIndex.value === 0)
```

### Step 5: 修改导航逻辑

树形模式下的"下一页/上一页"：

```ts
function treeNextPage() {
  if (!isLastChildPage.value) {
    compareChildPage.value++
  } else if (!isLastFrame.value) {
    compareFrameIndex.value++
    compareChildPage.value = 0
  } else if (hasMoreCompareTrees.value) {
    nextCompareTree()
  }
}

function treePrevPage() {
  if (!isFirstChildPage.value) {
    compareChildPage.value--
  } else if (!isFirstFrame.value) {
    compareFrameIndex.value--
    compareChildPage.value = Math.max(0, Math.ceil(compareTreeFrames.value[compareFrameIndex.value].children.length / 3) - 1)
  } else if (hasPrevCompareTrees.value) {
    prevCompareTree()
  }
}

function nextCompareTree() {
  if (compareTreeIndex.value < allTrees.value.length - 1) {
    const nextIdx = compareTreeIndex.value + 1
    compareTreeIndex.value = nextIdx
    const tree = allTrees.value[nextIdx]
    compareTreeFrames.value = buildTreeCompareFrames(tree.tree, tree)
    compareFrameIndex.value = 0
    compareChildPage.value = 0
  }
}

function prevCompareTree() {
  if (compareTreeIndex.value > 0) {
    const prevIdx = compareTreeIndex.value - 1
    compareTreeIndex.value = prevIdx
    const tree = allTrees.value[prevIdx]
    compareTreeFrames.value = buildTreeCompareFrames(tree.tree, tree)
    compareFrameIndex.value = compareTreeFrames.value.length - 1
    compareChildPage.value = Math.max(0, Math.ceil(compareTreeFrames.value[compareFrameIndex.value].children.length / 3) - 1)
  }
}
```

### Step 6: 修改键盘事件处理

```ts
function handleCompareKeydown(e: KeyboardEvent) {
  if (viewMode.value === 'timeline') {
    // 保持原有时间轴模式逻辑
    if (e.key === 'ArrowLeft' || e.key === 'Left') {
      if (comparePage.value > 0) comparePage.value--
      else if (hasPrevCompareTrees.value) prevCompareGroup()
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
      if (comparePage.value < maxComparePage.value - 1) comparePage.value++
      else if (hasMoreCompareTrees.value) nextCompareGroup()
    }
  } else {
    // 树形模式
    if (e.key === 'ArrowLeft' || e.key === 'Left') treePrevPage()
    else if (e.key === 'ArrowRight' || e.key === 'Right') treeNextPage()
  }
}
```

### Step 7: 修改模板

弹窗内容根据 `viewMode` 条件渲染：

**树形模式模板**：

```html
<!-- 树形模式 -->
<template v-if="viewMode === 'tree' && currentFrame">
  <div class="compare-body">
    <div class="compare-grid">
      <!-- 左上角：父节点 -->
      <div class="compare-cell">
        <el-image :src="currentFrame.parent.selfUrl" fit="contain" class="compare-image">
          <template #placeholder>
            <div class="compare-image-loading"><div class="loading-spinner"></div></div>
          </template>
        </el-image>
        <div class="compare-label">{{ currentFrame.rootName }} | 第{{ currentFrame.level }}层</div>
      </div>
      <!-- 其余3格：子节点 -->
      <div v-for="i in 3" :key="i" class="compare-cell">
        <template v-if="currentFrame.children[compareChildPage * 3 + i - 1]">
          <el-image :src="currentFrame.children[compareChildPage * 3 + i - 1].selfUrl" fit="contain" class="compare-image">
            <template #placeholder>
              <div class="compare-image-loading"><div class="loading-spinner"></div></div>
            </template>
          </el-image>
          <div class="compare-label">
            {{ currentFrame.children[compareChildPage * 3 + i - 1].selfId }}
            {{ currentFrame.children[compareChildPage * 3 + i - 1].matchDate }}
          </div>
        </template>
        <div v-else class="compare-placeholder"></div>
      </div>
    </div>
    <div class="compare-controls">
      <!-- 上一页/上一组/上一颗树 -->
      <el-button
        v-if="isFirstChildPage && isFirstFrame && hasPrevCompareTrees"
        type="primary" size="small" @click="prevCompareTree"
      >上一颗树</el-button>
      <el-button
        v-else-if="isFirstChildPage && !isFirstFrame"
        size="small" @click="compareFrameIndex--; compareChildPage = Math.max(0, Math.ceil(compareTreeFrames[compareFrameIndex].children.length / 3) - 1)"
      >上一帧</el-button>
      <el-button
        v-else
        size="small" :disabled="isFirstChildPage" @click="compareChildPage--"
      >上一页</el-button>

      <span class="compare-page-info">
        帧 {{ compareFrameIndex + 1 }}/{{ compareTreeFrames.length }}
        · 页 {{ compareChildPage + 1 }}/{{ maxChildPage }}
      </span>

      <!-- 下一页/下一帧/下一颗树 -->
      <el-button
        v-if="isLastChildPage && isLastFrame && hasMoreCompareTrees"
        type="primary" size="small" @click="nextCompareTree"
      >下一颗树</el-button>
      <el-button
        v-else-if="isLastChildPage && !isLastFrame"
        size="small" @click="compareFrameIndex++; compareChildPage = 0"
      >下一帧</el-button>
      <el-button
        v-else
        size="small" :disabled="isLastChildPage" @click="compareChildPage++"
      >下一页</el-button>
    </div>
  </div>
</template>

<!-- 时间轴模式（保持原有） -->
<template v-else>
  ...existing timeline compare template...
</template>
```

### Step 8: 修改弹窗关闭清理

```ts
@closed="onCompareClosed"

function onCompareClosed() {
  compareTimelineNodes.value = []
  compareTreeFrames.value = []
  compareFrameIndex.value = 0
  compareChildPage.value = 0
}
```

### Step 9: 弹窗标题动态化

```html
:title="viewMode === 'timeline' ? '时间轴比对' : '树形比对'"
```

---

## 涉及文件

| 文件 | 修改内容 |
|------|---------|
| `src/App.vue` | 所有改动集中在该文件，新增变量、函数、计算属性、模板条件渲染 |

## 不涉及的文件

- `src/components/antv-x6-tree/index.vue` - 无需修改
- `src/types/index.ts` - TreeNode 类型已有 children、selfUrl、selfId、matchDate，满足需求
