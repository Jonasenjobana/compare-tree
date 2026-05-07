<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, SortUp, SortDown } from '@element-plus/icons-vue'
import PreviewPanel from '@/components/preview-panel/index.vue'
import type { Node } from '@/types'
import { getAllTrees } from '@/api/tree'
import AntVX6 from '@/components/antv-x6-tree/index.vue'
import type { TreeNode, TreeRoot } from '@/types'

const allTrees = ref<TreeRoot[]>([])
const nodes = ref<Node[]>([])
const viewMode = ref<'tree' | 'timeline'>('tree')
const timelineOrder = ref<'asc' | 'desc'>('asc')
const searchKeyword = ref('')
const selectedTreeId = ref('')

function convertTreeNodeToList(node: TreeNode, list: Node[]) {
  const convertedNode: Node = {
    id: node.selfId,
    parentId: node.parentId,
    selfId: node.selfId,
    score: node.score,
    matchDate: node.matchDate,
    imageUrl: node.selfUrl,
    selfUrl: node.selfUrl,
  }
  list.push(convertedNode)

  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => convertTreeNodeToList(child, list))
  }
}

function convertTreeListToNodes(trees: TreeRoot[]) {
  const nodeList: Node[] = []
  if (selectedTreeId.value) {
    const targetTree = trees.find((t) => t.rootId === selectedTreeId.value)
    if (targetTree) {
      convertTreeNodeToList(targetTree.tree, nodeList)
    }
  } else {
    trees.forEach((root) => {
      convertTreeNodeToList(root.tree, nodeList)
    })
  }
  return nodeList
}

const filteredTrees = computed(() => {
  if (!searchKeyword.value) return allTrees.value
  return allTrees.value.filter((tree) =>
    tree.rootId.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

function changeSelectedTree(rootId: string) {
  selectedTreeId.value = rootId === selectedTreeId.value ? '' : rootId
  const convertedNodes = convertTreeListToNodes(allTrees.value)
  nodes.value = convertedNodes
}

const goJsTreeRef = ref<any>(null)
const focusNodeId = ref('')

function locateToRoot(rootId: string) {
  if (goJsTreeRef.value) {
    goJsTreeRef.value.locateNode(rootId)
  }
}

const selectedNode = ref<Node | null>(null)
const compareVisible = ref(false)
const compareRootImage = ref('')
const compareRootLabel = ref('')
const compareTimelineNodes = ref<Node[]>([])
const comparePage = ref(0)
const compareTreeIndex = ref(0)

interface CompareFrame {
  parent: TreeNode
  children: TreeNode[]
  position: string
}
const compareTreeFrames = ref<CompareFrame[]>([])
const compareFrameIndex = ref(0)
const compareChildPage = ref(0)

function collectTreeNodesFlat(node: TreeNode, list: Node[]): void {
  list.push({
    id: node.selfId,
    parentId: node.parentId,
    selfId: node.selfId,
    score: node.score,
    matchDate: node.matchDate,
    imageUrl: node.selfUrl,
    selfUrl: node.selfUrl,
  })
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => collectTreeNodesFlat(child, list))
  }
}

function loadCompareTree(index: number) {
  const tree = allTrees.value[index]
  if (!tree) return
  compareTreeIndex.value = index
  compareRootImage.value = tree.tree.selfUrl
  compareRootLabel.value = `${tree.tree.selfId} ${tree.tree.matchDate}`
  const allNodes: Node[] = []
  collectTreeNodesFlat(tree.tree, allNodes)
  allNodes.sort((a, b) => a.matchDate.localeCompare(b.matchDate))
  compareTimelineNodes.value = allNodes.filter((n) => n.selfId !== tree.tree.selfId)
  comparePage.value = 0
}

function prevCompareGroup() {
  if (compareTreeIndex.value > 0) {
    loadCompareTree(compareTreeIndex.value - 1)
  }
}

function nextCompareGroup() {
  if (compareTreeIndex.value < allTrees.value.length - 1) {
    loadCompareTree(compareTreeIndex.value + 1)
  }
}

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

function buildPositionMap(root: TreeNode): Map<TreeNode, string> {
  const map = new Map<TreeNode, string>()
  const queue: { node: TreeNode; depth: number; indexInLevel: number }[] = []
  let levelCounter = new Map<number, number>()
  queue.push({ node: root, depth: 1, indexInLevel: 0 })
  while (queue.length > 0) {
    const { node, depth } = queue.shift()!
    const count = (levelCounter.get(depth) || 0) + 1
    levelCounter.set(depth, count)
    map.set(node, `${depth}.${count}`)
    if (node.children) {
      node.children.forEach((child) => {
        queue.push({ node: child, depth: depth + 1, indexInLevel: 0 })
      })
    }
  }
  return map
}

function buildTreeCompareFrames(startNode: TreeNode, treeRoot: TreeRoot): CompareFrame[] {
  const positionMap = buildPositionMap(treeRoot.tree)
  const frames: CompareFrame[] = []
  const queue: TreeNode[] = [startNode]
  while (queue.length > 0) {
    const node = queue.shift()!
    frames.push({
      parent: node,
      children: node.children ? [...node.children] : [],
      position: positionMap.get(node) || '?',
    })
    if (node.children) {
      node.children.forEach((child) => queue.push(child))
    }
  }
  return frames
}

const maxComparePage = computed(() => Math.max(1, Math.ceil(compareTimelineNodes.value.length / 3)))
const isCompareFirstPage = computed(() => comparePage.value === 0)
const isCompareLastPage = computed(() => comparePage.value >= maxComparePage.value - 1)
const hasPrevCompareTrees = computed(() => compareTreeIndex.value > 0)
const hasMoreCompareTrees = computed(() => compareTreeIndex.value < allTrees.value.length - 1)

const currentFrame = computed(() => compareTreeFrames.value[compareFrameIndex.value] || null)
const maxChildPage = computed(() => {
  if (!currentFrame.value) return 1
  return Math.max(1, Math.ceil(currentFrame.value.children.length / 3))
})
const isLastChildPage = computed(() => compareChildPage.value >= maxChildPage.value - 1)
const isLastFrame = computed(() => compareFrameIndex.value >= compareTreeFrames.value.length - 1)
const isFirstChildPage = computed(() => compareChildPage.value === 0)
const isFirstFrame = computed(() => compareFrameIndex.value === 0)

function treeNextPage() {
  if (!isLastChildPage.value) {
    compareChildPage.value++
  } else if (!isLastFrame.value) {
    goNextFrame()
  } else if (hasMoreCompareTrees.value) {
    nextCompareTree()
  }
}

function treePrevPage() {
  if (!isFirstChildPage.value) {
    compareChildPage.value--
  } else if (!isFirstFrame.value) {
    goPrevFrame()
  } else if (hasPrevCompareTrees.value) {
    prevCompareTree()
  }
}

function goNextFrame() {
  if (compareFrameIndex.value < compareTreeFrames.value.length - 1) {
    compareFrameIndex.value++
    compareChildPage.value = 0
  }
}

function goPrevFrame() {
  if (compareFrameIndex.value > 0) {
    compareFrameIndex.value--
    const prevFrame = compareTreeFrames.value[compareFrameIndex.value]
    compareChildPage.value = Math.max(0, Math.ceil(prevFrame.children.length / 3) - 1)
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
    const lastFrame = compareTreeFrames.value[compareFrameIndex.value]
    compareChildPage.value = Math.max(0, Math.ceil(lastFrame.children.length / 3) - 1)
  }
}

function handleCompareKeydown(e: KeyboardEvent) {
  if (viewMode.value === 'timeline') {
    if (e.key === 'ArrowLeft' || e.key === 'Left') {
      if (comparePage.value > 0) {
        comparePage.value--
      } else if (hasPrevCompareTrees.value) {
        prevCompareGroup()
      }
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
      if (comparePage.value < maxComparePage.value - 1) {
        comparePage.value++
      } else if (hasMoreCompareTrees.value) {
        nextCompareGroup()
      }
    }
  } else {
    if (e.key === 'ArrowLeft' || e.key === 'Left') treePrevPage()
    else if (e.key === 'ArrowRight' || e.key === 'Right') treeNextPage()
  }
}

const handleNodeSelect = (node: Node) => {
  selectedNode.value = node
  focusNodeId.value = node.id
}

const handleNodeDoubleClick = (node: Node) => {
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

function onCompareClosed() {
  compareTimelineNodes.value = []
  compareTreeFrames.value = []
  compareFrameIndex.value = 0
  compareChildPage.value = 0
}

const handleUpdateParent = (nodeId: string, newParentId: string) => {
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

onMounted(async () => {
  try {
    const res = await getAllTrees()
    allTrees.value = res.trees
    const convertedNodes = convertTreeListToNodes(res.trees)
    nodes.value = convertedNodes
  } catch (error) {
    console.error('获取树数据失败:', error)
    ElMessage.error('获取树数据失败，请检查接口是否正常')
  }
})
</script>

<template>
  <div class="app-container">
    <div class="canvas-area">
      <AntVX6
        ref="goJsTreeRef"
        :nodes="nodes"
        :focus-node-id="focusNodeId"
        :view-mode="viewMode"
        :trees="allTrees"
        :timeline-order="timelineOrder"
        @node-select="handleNodeSelect"
        @node-double-click="handleNodeDoubleClick"
      />
    </div>
    <div class="preview-area">
      <div class="tree-filter-section">
        <div class="view-mode-row">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="tree">树形</el-radio-button>
            <el-radio-button value="timeline">时间轴</el-radio-button>
          </el-radio-group>
          <el-button
            v-if="viewMode === 'timeline'"
            size="small"
            :icon="timelineOrder === 'asc' ? SortUp : SortDown"
            @click="timelineOrder = timelineOrder === 'asc' ? 'desc' : 'asc'"
          >
            {{ timelineOrder === 'asc' ? '正序' : '倒序' }}
          </el-button>
        </div>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索根节点ID"
          clearable
          style="margin-bottom: 10px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <div class="tree-list">
          <div
            v-for="tree in filteredTrees"
            :key="tree.rootId"
            class="tree-item"
            :class="{ active: selectedTreeId === tree.rootId }"
          >
            <div class="tree-info" @click="changeSelectedTree(tree.rootId)">
              <span class="tree-id">{{ tree.rootId }}</span>
            </div>
            <el-button type="primary" size="small" @click.stop="locateToRoot(tree.rootId)">
              定位
            </el-button>
          </div>
        </div>
      </div>
      <div style="height: 1px; background: #eee; margin: 10px 0"></div>
      <PreviewPanel
        :selected-node="selectedNode"
        :all-nodes="nodes"
        @update-parent="handleUpdateParent"
      />
    </div>

    <el-dialog
      v-model="compareVisible"
      :title="viewMode === 'timeline' ? '时间轴比对' : '树形比对'"
      fullscreen
      append-to-body
      @closed="onCompareClosed"
      @keydown="handleCompareKeydown"
    >
      <template v-if="viewMode === 'tree' && currentFrame">
        <div class="compare-body">
          <div class="compare-grid">
            <div class="compare-cell">
              <el-image :src="currentFrame.parent.selfUrl" fit="contain" class="compare-image">
                <template #placeholder>
                  <div class="compare-image-loading">
                    <div class="loading-spinner"></div>
                  </div>
                </template>
              </el-image>
              <div class="compare-label">{{ currentFrame.parent.selfId }} | {{ currentFrame.position }}层</div>
            </div>
            <div v-for="i in 3" :key="i" class="compare-cell">
              <template v-if="currentFrame.children[compareChildPage * 3 + i - 1]">
                <el-image
                  :src="currentFrame.children[compareChildPage * 3 + i - 1].selfUrl"
                  fit="contain"
                  class="compare-image"
                >
                  <template #placeholder>
                    <div class="compare-image-loading">
                      <div class="loading-spinner"></div>
                    </div>
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
            <el-button
              v-if="isFirstChildPage && isFirstFrame && hasPrevCompareTrees"
              type="primary"
              size="small"
              @click="prevCompareTree"
            >
              上一颗树
            </el-button>
            <el-button
              v-else-if="isFirstChildPage && !isFirstFrame"
              size="small"
              @click="goPrevFrame"
            >
              上一帧
            </el-button>
            <el-button
              v-else
              size="small"
              :disabled="isFirstChildPage"
              @click="compareChildPage--"
            >
              上一页
            </el-button>
            <span class="compare-page-info">
              帧 {{ compareFrameIndex + 1 }}/{{ compareTreeFrames.length }}
              · 页 {{ compareChildPage + 1 }}/{{ maxChildPage }}
            </span>
            <el-button
              v-if="isLastChildPage && isLastFrame && hasMoreCompareTrees"
              type="primary"
              size="small"
              @click="nextCompareTree"
            >
              下一颗树
            </el-button>
            <el-button
              v-else-if="isLastChildPage && !isLastFrame"
              size="small"
              @click="goNextFrame"
            >
              下一帧
            </el-button>
            <el-button
              v-else
              size="small"
              :disabled="isLastChildPage"
              @click="compareChildPage++"
            >
              下一页
            </el-button>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="compare-body">
          <div class="compare-grid">
            <div class="compare-cell">
              <el-image :src="compareRootImage" fit="contain" class="compare-image">
                <template #placeholder>
                  <div class="compare-image-loading">
                    <div class="loading-spinner"></div>
                  </div>
                </template>
              </el-image>
              <div class="compare-label">{{ compareRootLabel }}</div>
            </div>
            <div v-for="i in 3" :key="i" class="compare-cell">
              <template v-if="compareTimelineNodes[comparePage * 3 + i - 1]">
                <el-image
                  :src="compareTimelineNodes[comparePage * 3 + i - 1]?.imageUrl"
                  fit="contain"
                  class="compare-image"
                >
                  <template #placeholder>
                    <div class="compare-image-loading">
                      <div class="loading-spinner"></div>
                    </div>
                  </template>
                </el-image>
                <div class="compare-label">
                  {{ compareTimelineNodes[comparePage * 3 + i - 1]?.selfId }}
                  {{ compareTimelineNodes[comparePage * 3 + i - 1]?.matchDate }}
                </div>
              </template>
              <div v-else class="compare-placeholder"></div>
            </div>
          </div>
          <div class="compare-controls">
            <el-button
              v-if="isCompareFirstPage && hasPrevCompareTrees"
              type="primary"
              size="small"
              @click="prevCompareGroup"
            >
              上一组
            </el-button>
            <el-button v-else size="small" :disabled="comparePage === 0" @click="comparePage--">
              上一页
            </el-button>
            <span class="compare-page-info">{{ comparePage + 1 }} / {{ maxComparePage }}</span>
            <el-button
              v-if="isCompareLastPage && hasMoreCompareTrees"
              type="primary"
              size="small"
              @click="nextCompareGroup"
            >
              下一组
            </el-button>
            <el-button
              v-else
              size="small"
              :disabled="comparePage >= maxComparePage - 1"
              @click="comparePage++"
            >
              下一页
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.canvas-area {
  flex: 0 0 85%;
  height: 100%;
}

.preview-area {
  flex: 0 0 15%;
  height: 100%;
  padding: 10px;
  box-sizing: border-box;
  overflow-y: auto;
}

.tree-filter-section {
  margin-bottom: 10px;
}

.view-mode-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.tree-list {
  max-height: 300px;
  overflow-y: auto;
}

.tree-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  margin-bottom: 6px;
  border-radius: 4px;
  background: #f5f7fa;
  cursor: pointer;
  transition: all 0.3s;
}

.tree-item:hover {
  background: #eaf2ff;
}

.tree-item.active {
  background: #d0e7ff;
  border: 1px solid #409eff;
}

.tree-id {
  font-size: 13px;
  color: #333;
  word-break: break-all;
}
</style>

<style>
.el-dialog__body {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  height: calc(100% - 54px);
  overflow: hidden;
}

.compare-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.compare-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  flex-shrink: 0;
}

.compare-page-info {
  font-size: 14px;
  color: #606266;
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.compare-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  min-height: 0;
}

.compare-cell .el-image {
  width: 100%;
  flex: 1;
  min-height: 0;
}

.compare-cell .el-image__placeholder {
  width: 100%;
  height: 100%;
}

.compare-cell .el-image__inner {
  object-fit: contain !important;
}

.compare-image {
  width: 100%;
  flex: 1;
  min-height: 0;
}

.compare-image-loading {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid #e4e7ed;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.compare-label {
  padding: 4px 0;
  font-size: 12px;
  color: #666;
  background: #f5f7fa;
  width: 100%;
  text-align: center;
  flex-shrink: 0;
}

.compare-placeholder {
  flex: 1;
  width: 100%;
  background: #e8e8e8;
  min-height: 0;
}
</style>
