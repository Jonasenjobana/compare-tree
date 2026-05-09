<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, SortUp, SortDown } from '@element-plus/icons-vue'
import PreviewPanel from '@/components/preview-panel/index.vue'
import AntVX6 from '@/components/antv-x6-tree/index.vue'
import CompareDialog from '@/components/compare-dialog/index.vue'
import SearchHistoryDialog from '@/components/search-history-dialog/index.vue'
import { useTreeData } from '@/composables/useTreeData'
import { useCompareDialog } from '@/composables/useCompareDialog'
import { batchReview, searchHistory, type ReviewRecord } from '@/api/tree'
import type { Node, SearchHistoryItem } from '@/types'

const {
  allTrees, currentTree, nodes, viewMode, timelineOrder,
  searchKeyword, selectedTreeId, pagedTreeIndex,
  filteredTrees, hasPrevTree, hasNextTree, treeLoading,
  changeSelectedTree,
  goToPrevTree, goToNextTree, loadTreeData, refreshCurrentTree, refreshAllRootIds, loadTreeByRootId, getTreeIndex
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
  gridMode, childPageSize,
  isSingleNodePreview, singlePreviewImage, singlePreviewLabel,
  compareTreeName, compareTreeRootId, updateTreeName,
} = useCompareDialog(allTrees, viewMode, loadTreeByRootId, selectedTreeId)

const goJsTreeRef = ref<any>(null)
const treeListRef = ref<HTMLDivElement | null>(null)
const focusNodeId = ref('')
const selectedNode = ref<Node | null>(null)

function locateToRoot(rootId: string) {
  if (goJsTreeRef.value) {
    goJsTreeRef.value.locateNode(rootId)
  }
}

const handleNodeSelect = (node: Node) => {
  selectedNode.value = node
  focusNodeId.value = node.id
}
const handleEdgeClick = (node: Node) => {
  const {parentId} = node;
  openCompareForNode(nodes.value.find((n) => n.id === parentId)!, node.selfId)
}
const handleNodeDoubleClick = (node: Node) => {
  openCompareForNode(node)
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

async function handleSubmitReview(records: ReviewRecord[]) {
  try {
    await batchReview({ records })
    ElMessage.success('审核提交成功')
    const recordMap = new Map(records.map((r) => [r.selfId, r.reviewResult]))
    nodes.value = nodes.value.map((n) => {
      const newResult = recordMap.get(n.selfId)
      if (newResult !== undefined) {
        return { ...n, reviewResult: newResult }
      }
      return n
    })
    await refreshCurrentTree()
  } catch (error) {
    console.error('审核提交失败:', error)
    ElMessage.error('审核提交失败')
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (compareVisible.value) return
  if (e.key === 'ArrowLeft') goToPrevTree()
  else if (e.key === 'ArrowRight') goToNextTree()
}

const searchHistoryVisible = ref(false)
const searchHistorySourceImage = ref('')
const searchHistorySourceSelfId = ref('')
const searchHistoryResults = ref<SearchHistoryItem[]>([])
const searchHistoryLoading = ref(false)

async function handleSearchHistory(selfId: string) {
  const node = nodes.value.find((n) => n.selfId === selfId)
  searchHistorySourceImage.value = node?.selfUrl || node?.imageUrl || ''
  searchHistorySourceSelfId.value = selfId
  searchHistoryLoading.value = true
  searchHistoryVisible.value = true
  try {
    const res = await searchHistory({ selfId, top_k: 9 })
    searchHistoryResults.value = res.results
  } catch (error) {
    console.error('搜索相似图片失败:', error)
    ElMessage.error('搜索相似图片失败')
  } finally {
    searchHistoryLoading.value = false
  }
}

async function handleMoveSuccess(newRootId: string) {
  compareVisible.value = false
  await refreshAllRootIds()
  await changeSelectedTree(newRootId)
}

function scrollTreeListToActive() {
  nextTick(() => {
    if (!treeListRef.value) return
    const activeItem = treeListRef.value.querySelector('.tree-item.active')
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
}

watch(selectedTreeId, (rootId) => {
  scrollTreeListToActive()
  if (rootId) {
    focusNodeId.value = rootId
  }
})

watch(compareTreeIndex, (newIdx) => {
  if (!compareVisible.value) return
  const tree = allTrees.value[newIdx]
  if (!tree) return
  const rootId = tree.rootId
  const idx = filteredTrees.value.findIndex((t) => t.rootId === rootId)
  if (idx !== -1) {
    pagedTreeIndex.value = idx
    selectedTreeId.value = rootId
  }
  locateToRoot(rootId)
})

onMounted(() => {
  loadTreeData()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
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
        :trees="currentTree ? [currentTree] : []"
        :timeline-order="timelineOrder"
        :loading="treeLoading"
        @edge-click="handleEdgeClick"
        @node-select="handleNodeSelect"
        @node-double-click="handleNodeDoubleClick"
      />
      <div class="paged-controls">
        <el-button size="small" :disabled="!hasPrevTree" @click="goToPrevTree">
          上一颗树
        </el-button>
        <span class="paged-info">{{ pagedTreeIndex + 1 }} / {{ filteredTrees.length }}</span>
        <el-button size="small" :disabled="!hasNextTree" @click="goToNextTree">
          下一颗树
        </el-button>
      </div>
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
          placeholder="搜索序号或名称"
          clearable
          style="margin-bottom: 10px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <div ref="treeListRef" class="tree-list">
          <div
            v-for="tree in filteredTrees"
            :key="tree.rootId"
            class="tree-item"
            :class="{ active: selectedTreeId === tree.rootId }"
             @click="changeSelectedTree(tree.rootId)"
          >
            <div class="tree-info">
              <span class="tree-index">{{ getTreeIndex(tree.rootId) + 1 }}.</span>
              <span class="tree-id">{{ tree.treeName ? tree.treeName + '(' + tree.rootId + ')' : tree.rootId }}</span>
              <span class="tree-id" style="font-size: 10px;">({{ tree.nodeCount }})</span>
            </div>
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

    <CompareDialog
      v-model="compareVisible"
      :view-mode="viewMode"
      :grid-mode="gridMode"
      :compare-root-image="compareRootImage"
      :compare-root-label="compareRootLabel"
      :compare-timeline-nodes="compareTimelineNodes"
      :compare-page="comparePage"
      :max-compare-page="maxComparePage"
      :is-compare-first-page="isCompareFirstPage"
      :is-compare-last-page="isCompareLastPage"
      :current-frame="currentFrame"
      :compare-child-page="compareChildPage"
      :max-child-page="maxChildPage"
      :compare-frame-index="compareFrameIndex"
      :compare-tree-frames="compareTreeFrames"
      :is-first-child-page="isFirstChildPage"
      :is-first-frame="isFirstFrame"
      :is-last-child-page="isLastChildPage"
      :is-last-frame="isLastFrame"
      :has-prev-compare-trees="hasPrevCompareTrees"
      :has-more-compare-trees="hasMoreCompareTrees"
      :child-page-size="childPageSize"
      :is-single-node-preview="isSingleNodePreview"
      :single-preview-image="singlePreviewImage"
      :single-preview-label="singlePreviewLabel"
      :compare-tree-name="compareTreeName"
      :compare-tree-root-id="compareTreeRootId"
      @update:compare-page="comparePage = $event"
      @update:compare-child-page="compareChildPage = $event"
      @update:grid-mode="gridMode = $event"
      @prev-compare-group="prevCompareGroup"
      @next-compare-group="nextCompareGroup"
      @go-prev-frame="goPrevFrame"
      @go-next-frame="goNextFrame"
      @prev-compare-tree="prevCompareTree"
      @next-compare-tree="nextCompareTree"
      @closed="onCompareClosed"
      @keydown="handleCompareKeydown"
      @submit-review="handleSubmitReview"
      @update-tree-name="updateTreeName"
      @search-history="handleSearchHistory"
    />

    <SearchHistoryDialog
      v-model="searchHistoryVisible"
      :source-image="searchHistorySourceImage"
      :source-self-id="searchHistorySourceSelfId"
      :results="searchHistoryResults"
      @move-success="handleMoveSuccess"
    />
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
  position: relative;
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

.tree-index {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
  margin-right: 2px;
  min-width: 24px;
}

.tree-id {
  font-size: 13px;
  color: #333;
  word-break: break-all;
}

.paged-controls {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.paged-info {
  font-size: 14px;
  color: #606266;
  min-width: 60px;
  text-align: center;
}
</style>
