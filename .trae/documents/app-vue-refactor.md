# App.vue 拆分重构计划

## 核心原则

**功能逻辑零影响**：拆分仅改变代码组织方式，不改变任何业务逻辑、变量名、函数签名、计算属性逻辑、模板结构、样式规则。每个函数的实现代码原封不动搬走。

## 现状分析

App.vue 当前 ~740 行，职责分布：

| 职责 | 行范围 | 行数 |
|------|--------|------|
| 数据获取与转换 | L11-48 | ~38 |
| 树过滤与选择 | L50-70 | ~20 |
| 比对弹窗状态+逻辑 | L72-308 | ~236 |
| 事件处理+挂载 | L310-332 | ~22 |
| 模板（主布局） | L335-398 | ~63 |
| 模板（比对弹窗） | L399-562 | ~163 |
| scoped样式 | L565-628 | ~63 |
| 全局比对样式 | L630-741 | ~111 |

## 拆分方案

### 1. 补充 `src/utils/tree-utils.ts` — 合并去重

App.vue 中的 `findTreeNodeById(root, id)` 与 tree-utils.ts 中已有的 `findNodeInTree(node, targetId)` **逻辑完全一致**，直接复用。

```ts
// tree-utils.ts 已有：
function findNodeInTree(node: TreeNode, targetId: string): TreeNode | null { ... }

// 新增导出（其实就是复用 findNodeInTree）：
export { findNodeInTree as findTreeNodeById }
```

同时将 `buildPositionMap` 和 `buildTreeCompareFrames` 也放入此文件，它们是纯工具函数，不依赖 Vue 响应式。

### 2. 新建 `src/composables/useTreeData.ts`

**完整代码迁移**，函数体不变：

```ts
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Node, TreeRoot } from '@/types'
import { getAllTrees } from '@/api/tree'

export function useTreeData() {
  // 以下变量和函数的实现代码从 App.vue 原封不动搬入
  const allTrees = ref<TreeRoot[]>([])          // 原L11
  const nodes = ref<Node[]>([])                 // 原L12
  const viewMode = ref<'tree' | 'timeline'>('tree')  // 原L13
  const timelineOrder = ref<'asc' | 'desc'>('asc')    // 原L14
  const searchKeyword = ref('')                  // 原L15
  const selectedTreeId = ref('')                 // 原L16

  function convertTreeNodeToList(...) { ... }    // 原L18-33，不变
  function convertTreeListToNodes(...) { ... }   // 原L35-48，不变

  const filteredTrees = computed(...)            // 原L50-55，不变

  function changeSelectedTree(...) { ... }       // 原L57-61，不变

  async function loadTreeData() {                // 从原L322-332 onMounted 提取
    try {
      const res = await getAllTrees()
      allTrees.value = res.trees
      nodes.value = convertTreeListToNodes(res.trees)
    } catch (error) {
      console.error('获取树数据失败:', error)
      ElMessage.error('获取树数据失败，请检查接口是否正常')
    }
  }

  return {
    allTrees, nodes, viewMode, timelineOrder,
    searchKeyword, selectedTreeId, filteredTrees,
    changeSelectedTree, loadTreeData,
  }
}
```

**验证点**：
- `changeSelectedTree` 内部引用 `selectedTreeId.value`、`allTrees.value`、`convertTreeListToNodes` — 全部在同一 composable 内，无外部依赖 ✅
- `filteredTrees` 引用 `searchKeyword.value`、`allTrees.value` — 同上 ✅
- `loadTreeData` 引用 `getAllTrees`、`ElMessage` — 需导入 ✅

### 3. 新建 `src/composables/useCompareDialog.ts`

**完整代码迁移**，函数体不变：

```ts
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { Node, TreeNode, TreeRoot } from '@/types'
import { findTreeNodeById, buildPositionMap, buildTreeCompareFrames } from '@/utils/tree-utils'

export interface CompareFrame {
  parent: TreeNode
  children: TreeNode[]
  position: string
}

export function useCompareDialog(
  allTrees: Ref<TreeRoot[]>,
  viewMode: Ref<'tree' | 'timeline'>
) {
  // 以下所有变量和函数的实现代码从 App.vue 原封不动搬入
  const compareVisible = ref(false)              // 原L73
  const compareRootImage = ref('')               // 原L74
  const compareRootLabel = ref('')               // 原L75
  const compareTimelineNodes = ref<Node[]>([])   // 原L76
  const comparePage = ref(0)                     // 原L77
  const compareTreeIndex = ref(0)                // 原L78
  const compareTreeFrames = ref<CompareFrame[]>([])  // 原L85
  const compareFrameIndex = ref(0)               // 原L86
  const compareChildPage = ref(0)                // 原L87

  function collectTreeNodesFlat(...) { ... }     // 原L89-102，不变
  function loadCompareTree(...) { ... }          // 原L104-115，不变
  function prevCompareGroup() { ... }            // 原L117-121，不变
  function nextCompareGroup() { ... }            // 原L123-127，不变

  // findTreeNodeById → 从 tree-utils 导入，不再本地定义
  // buildPositionMap → 从 tree-utils 导入
  // buildTreeCompareFrames → 从 tree-utils 导入

  const maxComparePage = computed(...)           // 原L177，不变
  const isCompareFirstPage = computed(...)       // 原L178，不变
  const isCompareLastPage = computed(...)        // 原L179，不变
  const hasPrevCompareTrees = computed(...)      // 原L180，不变
  const hasMoreCompareTrees = computed(...)      // 原L181，不变
  const currentFrame = computed(...)             // 原L183，不变
  const maxChildPage = computed(...)             // 原L184-186，不变
  const isLastChildPage = computed(...)          // 原L188，不变
  const isLastFrame = computed(...)              // 原L189，不变
  const isFirstChildPage = computed(...)         // 原L190，不变
  const isFirstFrame = computed(...)             // 原L191，不变

  function treeNextPage() { ... }                // 原L193-201，不变
  function treePrevPage() { ... }                // 原L203-211，不变
  function goNextFrame() { ... }                 // 原L213-218，不变
  function goPrevFrame() { ... }                 // 原L220-226，不变
  function nextCompareTree() { ... }             // 原L228-237，不变
  function prevCompareTree() { ... }             // 原L239-249，不变
  function handleCompareKeydown(...) { ... }     // 原L251-270，不变
  function onCompareClosed() { ... }             // 原L303-308，不变

  function openCompareForNode(node: Node) {      // 从原 handleNodeDoubleClick 提取比对部分
    const idx = allTrees.value.findIndex((t) => {
      let found = false
      function walk(n: TreeNode) {
        if (n.selfId === node.id) found = true
        if (n.children && n.children.length > 0) n.children.forEach((c) => walk(c))
      }
      walk(t.tree)
      return found
    })
    if (idx === -1) return
    compareTreeIndex.value = idx

    if (viewMode.value === 'timeline') {
      loadCompareTree(idx)
    } else {
      const tree = allTrees.value[idx]
      const startNode = findTreeNodeById(tree.tree, node.id)
      if (!startNode) return
      compareTreeFrames.value = buildTreeCompareFrames(startNode, tree)
      compareFrameIndex.value = 0
      compareChildPage.value = 0
    }
    compareVisible.value = true
  }

  return {
    compareVisible, compareRootImage, compareRootLabel,
    compareTimelineNodes, comparePage, compareTreeIndex,
    compareTreeFrames, compareFrameIndex, compareChildPage,
    currentFrame, maxComparePage, maxChildPage,
    isCompareFirstPage, isCompareLastPage,
    isFirstChildPage, isFirstFrame, isLastChildPage, isLastFrame,
    hasPrevCompareTrees, hasMoreCompareTrees,
    loadCompareTree, prevCompareGroup, nextCompareGroup,
    goPrevFrame, goNextFrame, prevCompareTree, nextCompareTree,
    handleCompareKeydown, onCompareClosed, openCompareForNode,
  }
}
```

**验证点**：
- 所有引用 `allTrees.value` 的地方通过入参 `allTrees: Ref<TreeRoot[]>` 获取 ✅
- 所有引用 `viewMode.value` 的地方通过入参 `viewMode: Ref<'tree' | 'timeline'>` 获取 ✅
- `findTreeNodeById` 改为从 tree-utils 导入，功能与原 App.vue 中的实现一致 ✅
- `handleCompareKeydown` 内部引用 `viewMode.value` — 通过入参获取 ✅

### 4. 新建 `src/components/compare-dialog/index.vue`

**模板迁移**：将 App.vue L399-561 的 `el-dialog` 部分原封不动搬入，只做 props/emits 替换。

**Props 设计**（用 v-model + 事件代替直接操作 ref）：

```ts
const props = defineProps<{
  modelValue: boolean                              // compareVisible → v-model
  viewMode: 'tree' | 'timeline'
  // 时间轴模式
  compareRootImage: string
  compareRootLabel: string
  compareTimelineNodes: Node[]
  comparePage: number
  maxComparePage: number
  isCompareFirstPage: boolean
  isCompareLastPage: boolean
  // 树形模式
  currentFrame: CompareFrame | null
  compareChildPage: number
  maxChildPage: number
  compareFrameIndex: number
  compareTreeFrames: CompareFrame[]
  isFirstChildPage: boolean
  isFirstFrame: boolean
  isLastChildPage: boolean
  isLastFrame: boolean
  // 共享
  hasPrevCompareTrees: boolean
  hasMoreCompareTrees: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:comparePage': [value: number]
  'update:compareChildPage': [value: number]
  'prev-compare-group': []
  'next-compare-group': []
  'go-prev-frame': []
  'go-next-frame': []
  'prev-compare-tree': []
  'next-compare-tree': []
  'closed': []
  'keydown': [e: KeyboardEvent]
}>()
```

**模板逻辑**：
- `v-model="compareVisible"` → `v-model="modelValue"` + emit `update:modelValue`
- `comparePage--` → `emit('update:comparePage', comparePage - 1)`
- `@click="prevCompareGroup"` → `@click="emit('prev-compare-group')"`
- 其他同理，每个操作都 emit 对应事件，**逻辑完全不变**

**样式迁移**：App.vue 中非 scoped 的 `.el-dialog__body` 覆盖、`.compare-*` 等全部样式搬入此组件。

### 5. 重写 App.vue

拆分后 App.vue 预计 ~150 行，只负责：
- 组合 composable
- 页面布局模板
- 事件协调（节点选中 → 更新 selectedNode/focusNodeId）
- 树列表 UI（视图切换、搜索、定位）

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search, SortUp, SortDown } from '@element-plus/icons-vue'
import AntVX6 from '@/components/antv-x6-tree/index.vue'
import PreviewPanel from '@/components/preview-panel/index.vue'
import CompareDialog from '@/components/compare-dialog/index.vue'
import { useTreeData } from '@/composables/useTreeData'
import { useCompareDialog } from '@/composables/useCompareDialog'
import type { Node } from '@/types'

const {
  allTrees, nodes, viewMode, timelineOrder,
  searchKeyword, selectedTreeId, filteredTrees,
  changeSelectedTree, loadTreeData
} = useTreeData()

const {
  compareVisible, compareRootImage, compareRootLabel,
  compareTimelineNodes, comparePage, compareTreeIndex,
  compareTreeFrames, compareFrameIndex, compareChildPage,
  currentFrame, maxComparePage, maxChildPage,
  isCompareFirstPage, isCompareLastPage,
  isFirstChildPage, isFirstFrame, isLastChildPage, isLastFrame,
  hasPrevCompareTrees, hasMoreCompareTrees,
  prevCompareGroup, nextCompareGroup,
  goPrevFrame, goNextFrame, prevCompareTree, nextCompareTree,
  handleCompareKeydown, onCompareClosed, openCompareForNode,
} = useCompareDialog(allTrees, viewMode)

const goJsTreeRef = ref<any>(null)
const focusNodeId = ref('')
const selectedNode = ref<Node | null>(null)

function locateToRoot(rootId: string) {
  if (goJsTreeRef.value) goJsTreeRef.value.locateNode(rootId)
}

function handleNodeSelect(node: Node) {
  selectedNode.value = node
  focusNodeId.value = node.id
}

function handleNodeDoubleClick(node: Node) {
  openCompareForNode(node)
}

function handleUpdateParent(nodeId: string, newParentId: string) {
  const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId)
  if (nodeIndex === -1) return
  nodes.value[nodeIndex]!.parentId = newParentId
  nodes.value[nodeIndex]!.isModified = true
  focusNodeId.value = nodeId
  nodes.value = [...nodes.value]
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = nodes.value[nodeIndex]!
  }
}

onMounted(() => { loadTreeData() })
</script>
```

**功能不变验证清单**：

| 原始逻辑 | 拆分后 | 一致性 |
|----------|--------|--------|
| `allTrees` 数据加载 | `useTreeData().loadTreeData()` | 实现代码完全相同 ✅ |
| `convertTreeNodeToList` | 搬入 `useTreeData` | 函数体不变 ✅ |
| 双击节点打开比对 | `handleNodeDoubleClick` → `openCompareForNode` | 逻辑从原函数提取，实现不变 ✅ |
| 时间轴比对翻页/切组 | composable 内 `loadCompareTree`/`prevCompareGroup`/`nextCompareGroup` | 实现不变 ✅ |
| 树形比对帧/页/切树导航 | composable 内 `treeNextPage`/`goNextFrame`/`nextCompareTree` 等 | 实现不变 ✅ |
| 键盘事件 | composable 内 `handleCompareKeydown` | 实现不变 ✅ |
| 比对弹窗模板 | CompareDialog 组件 | 模板结构不变，props/emits 一一对应 ✅ |
| 比对弹窗样式 | 搬入 CompareDialog 组件 | CSS 规则不变 ✅ |
| 节点选中/修改父节点 | 保留在 App.vue | 代码不变 ✅ |

## 实施步骤

1. **补充 `src/utils/tree-utils.ts`**：导出 `findTreeNodeById`（复用 `findNodeInTree`）、新增 `buildPositionMap`、`buildTreeCompareFrames`、`CompareFrame` 类型
2. **新建 `src/composables/useTreeData.ts`**：搬入数据加载和转换逻辑
3. **新建 `src/composables/useCompareDialog.ts`**：搬入所有比对弹窗逻辑
4. **新建 `src/components/compare-dialog/index.vue`**：搬入比对弹窗模板和样式
5. **重写 App.vue**：引用上述模块，保留页面布局和事件协调
6. **验证**：`GetDiagnostics` 检查零错误 + 手动核对功能逻辑

## 涉及文件

| 文件 | 操作 |
|------|------|
| `src/utils/tree-utils.ts` | 修改：新增导出 |
| `src/composables/useTreeData.ts` | 新建 |
| `src/composables/useCompareDialog.ts` | 新建 |
| `src/components/compare-dialog/index.vue` | 新建 |
| `src/App.vue` | 修改：瘦身到~150行 |
