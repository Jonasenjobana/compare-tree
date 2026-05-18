<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, SortUp, SortDown, Filter } from '@element-plus/icons-vue'
import PreviewPanel from '@/components/preview-panel/index.vue'
import AntVX6 from '@/components/antv-x6-tree/index.vue'
import CompareDialog from '@/components/compare-dialog/index.vue'
import SearchHistoryDialog from '@/components/search-history-dialog/index.vue'
import ContextMenu from '@/components/context-menu/index.vue'
import type { ContextMenuItem } from '@/components/context-menu/index.vue'
import { useTreeStore } from '@/stores/treeStore'
import { useCompareStore } from '@/stores/compareStore'
import { batchReview, searchHistory, type ReviewRecord } from '@/api/tree'
import type { Node, SearchHistoryItem } from '@/types'

const treeStore = useTreeStore()
const compareStore = useCompareStore()

const goJsTreeRef = ref<any>(null)
const treeListRef = ref<HTMLDivElement | null>(null)
const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const contextMenuItems = ref<ContextMenuItem[]>([])

function locateToRoot(rootId: string) {
  if (goJsTreeRef.value) {
    goJsTreeRef.value.locateNode(rootId)
  }
}

const handleNodeSelect = (node: Node) => {
  treeStore.setSelectedNode(node)
}

function handleNodeContextMenu(node: Node, e: MouseEvent) {
  contextMenuItems.value = [
    {
      label: '相似图片匹配',
      icon: Search,
      handler: () => handleSearchHistory(node.selfId),
    },
  ]
  contextMenuRef.value?.show(e.clientX, e.clientY)
}
const handleEdgeClick = (node: Node) => {
  const {parentId} = node;
  compareStore.openCompareForNode(treeStore.nodes.find((n) => n.id === parentId)!, node.selfId)
}
const handleNodeDoubleClick = (node: Node) => {
  compareStore.openCompareForNode(node)
}

const handleUpdateParent = (nodeId: string, newParentId: string) => {
  const nodeIndex = treeStore.nodes.findIndex((n) => n.id === nodeId)
  if (nodeIndex === -1) return
  treeStore.nodes[nodeIndex]!.parentId = newParentId
  treeStore.nodes[nodeIndex]!.isModified = true
  treeStore.focusNodeId = nodeId
  treeStore.nodes = [...treeStore.nodes]
  if (treeStore.selectedNode?.id === nodeId) {
    treeStore.selectedNode = treeStore.nodes[nodeIndex]!
  }
}

async function handleSubmitReview(records: ReviewRecord[]) {
  try {
    await batchReview({ records })
    ElMessage.success('审核提交成功')
    const recordMap = new Map(records.map((r) => [r.selfId, r.reviewResult]))
    treeStore.nodes = treeStore.nodes.map((n) => {
      const newResult = recordMap.get(n.selfId)
      if (newResult !== undefined) {
        return { ...n, reviewResult: newResult }
      }
      return n
    })
    await treeStore.refreshCurrentTree()
    await treeStore.refreshAllRootIds()
  } catch (error) {
    console.error('审核提交失败:', error)
    ElMessage.error('审核提交失败')
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (compareStore.compareVisible) return
  if (e.key === 'ArrowLeft') treeStore.goToPrevTree()
  else if (e.key === 'ArrowRight') treeStore.goToNextTree()
}

const searchHistoryVisible = ref(false)
const searchHistorySourceImage = ref('')
const searchHistorySourceSelfId = ref('')
const searchHistoryRootId = ref('')
const searchHistoryResults = ref<SearchHistoryItem[]>([])
const searchHistoryLoading = ref(false)
const searchCount = ref(9)
watch(searchCount, (newCount) => {
  handleSearchHistory(searchHistorySourceSelfId.value)
})
async function handleSearchHistory(selfId: string) {
  const node = treeStore.nodes.find((n) => n.selfId === selfId)
  searchHistorySourceImage.value = node?.selfUrl || node?.imageUrl || ''
  searchHistorySourceSelfId.value = selfId
  searchHistoryRootId.value = node?.rootId || ''
  searchHistoryLoading.value = true
  searchHistoryVisible.value = true
  try {
    const res = await searchHistory({ selfId, top_k: searchCount.value })
    searchHistoryResults.value = res.results
  } catch (error) {
    console.error('搜索相似图片失败:', error)
    ElMessage.error('搜索相似图片失败')
  } finally {
    searchHistoryLoading.value = false
  }
}

async function handleMoveSuccess(newRootId: string | null) {
  compareStore.compareVisible = false
  await treeStore.refreshAllRootIds()
  if (newRootId) {
    await treeStore.changeSelectedTree(newRootId)
  } else {
    await treeStore.refreshCurrentTree()
  }
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

watch(() => treeStore.selectedTreeId, (rootId) => {
  scrollTreeListToActive()
  if (rootId) {
    treeStore.focusNodeId = rootId
  }
})

watch(() => compareStore.compareTreeIndex, (newIdx) => {
  if (!compareStore.compareVisible) return
  const tree = treeStore.allTrees[newIdx]
  if (!tree) return
  const rootId = tree.rootId
  const idx = treeStore.filteredTrees.findIndex((t) => t.rootId === rootId)
  if (idx !== -1) {
    treeStore.pagedTreeIndex = idx
    treeStore.selectedTreeId = rootId
  }
  locateToRoot(rootId)
})

onMounted(() => {
  treeStore.loadTreeData()
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
        :nodes="treeStore.nodes"
        :focus-node-id="treeStore.focusNodeId"
        :view-mode="treeStore.viewMode"
        :trees="treeStore.currentTree ? [treeStore.currentTree] : []"
        :timeline-order="treeStore.timelineOrder"
        :loading="treeStore.treeLoading"
        @edge-click="handleEdgeClick"
        @node-select="handleNodeSelect"
        @node-double-click="handleNodeDoubleClick"
        @node-context-menu="handleNodeContextMenu"
      />
      <div class="paged-controls">
        <el-button size="small" :disabled="!treeStore.hasPrevTree" @click="treeStore.goToPrevTree()">
          上一颗树
        </el-button>
        <span class="paged-info">{{ treeStore.pagedTreeIndex + 1 }} / {{ treeStore.filteredTrees.length }}</span>
        <el-button size="small" :disabled="!treeStore.hasNextTree" @click="treeStore.goToNextTree()">
          下一颗树
        </el-button>
      </div>
    </div>
    <div class="preview-area">
      <div class="tree-filter-section">
        <div class="view-mode-row">
          <el-radio-group v-model="treeStore.viewMode" size="small">
            <el-radio-button value="tree">树形</el-radio-button>
            <el-radio-button value="timeline">时间轴</el-radio-button>
          </el-radio-group>
          <el-button
            v-if="treeStore.viewMode === 'timeline'"
            size="small"
            :icon="treeStore.timelineOrder === 'asc' ? SortUp : SortDown"
            @click="treeStore.timelineOrder = treeStore.timelineOrder === 'asc' ? 'desc' : 'asc'"
          >
            {{ treeStore.timelineOrder === 'asc' ? '正序' : '倒序' }}
          </el-button>
        </div>
        <div class="search-row">
          <el-input
            v-model="treeStore.searchKeyword"
            placeholder="搜索序号或名称"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-popover placement="bottom" :width="320" trigger="click">
            <template #reference>
              <el-button
                size="small"
                :type="treeStore.nodeCountFilterActive || treeStore.filterCompleted !== 'all' ? 'primary' : 'default'"
                :icon="Filter"
              />
            </template>
            <div class="filter-popover-content">
              <span class="filter-label">状态</span>
              <el-radio-group v-model="treeStore.filterCompleted" size="small">
                <el-radio-button value="all">全部</el-radio-button>
                <el-radio-button value="completed">已完成</el-radio-button>
                <el-radio-button value="pending">未完成</el-radio-button>
              </el-radio-group>
            </div>
            <div class="filter-popover-content node-count-range" style="margin-top: 8px">
              <span class="filter-label">节点数</span>
              <div class="node-count-range-content">
                <div class="range-row">
                  <el-input-number
                    v-model="treeStore.nodeCountFilter.min"
                    :min="1"
                    controls-position="right"
                    placeholder="最小"
                    clearable
                    size="small"
                    class="range-input"
                  />
                  <el-button
                    text
                    size="small"
                    class="op-btn"
                    @click="treeStore.nodeCountFilter.minOp = treeStore.nodeCountFilter.minOp === 'le' ? 'lt' : 'le'"
                  >
                    {{ treeStore.nodeCountFilter.minOp === 'le' ? '≤' : '<' }}
                  </el-button>
                  <span class="range-n">n</span>
                  <el-button
                    text
                    size="small"
                    class="op-btn"
                    @click="treeStore.nodeCountFilter.maxOp = treeStore.nodeCountFilter.maxOp === 'le' ? 'lt' : 'le'"
                  >
                    {{ treeStore.nodeCountFilter.maxOp === 'le' ? '≤' : '<' }}
                  </el-button>
                  <el-input-number
                    v-model="treeStore.nodeCountFilter.max"
                    :min="1"
                    controls-position="right"
                    placeholder="最大"
                    clearable
                    size="small"
                    class="range-input"
                  />
                </div>
                <div v-if="treeStore.nodeCountFilterError" class="range-error">
                  {{ treeStore.nodeCountFilterError }}
                </div>
              </div>
            </div>
          </el-popover>
        </div>
        <div ref="treeListRef" class="tree-list">
          <div
            v-for="tree in treeStore.filteredTrees"
            :key="tree.rootId"
            class="tree-item"
            :class="{ active: treeStore.selectedTreeId === tree.rootId }"
             @click="treeStore.changeSelectedTree(tree.rootId)"
          >
            <div class="tree-info">
              <span class="tree-index">{{ treeStore.getTreeIndex(tree.rootId) + 1 }}.</span>
              <div class="tree-info-text">
                <span class="tree-id">{{ tree.treeName ? tree.treeName + '(' + tree.rootId + ')' : tree.rootId }}</span>
                <span class="tree-review" :class="tree.isCompleted === true ? 'tree-review--done' : 'tree-review--pending'">
                  {{ tree.completedCount || 0 }}/{{ tree.totalChildCount || tree.nodeCount }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style="height: 1px; background: #eee; margin: 10px 0"></div>
      <PreviewPanel
        @update-parent="handleUpdateParent"
      />
    </div>

    <CompareDialog
      v-model="compareStore.compareVisible"
      @submit-review="handleSubmitReview"
      @search-history="handleSearchHistory"
    />

    <SearchHistoryDialog
      v-model="searchHistoryVisible"
      :source-image="searchHistorySourceImage"
      :source-self-id="searchHistorySourceSelfId"
      :root-id="searchHistoryRootId"
      :results="searchHistoryResults"
      :count="searchHistoryResults.length"
      @update:count="searchCount = $event"
      @move-success="handleMoveSuccess"
    />

    <ContextMenu ref="contextMenuRef" :items="contextMenuItems" />
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

.search-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
}

.search-row .el-input {
  flex: 1;
}

.filter-popover-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}

.node-count-range {
  align-items: flex-start;
  flex-direction: column;
}

.node-count-range-content {
  width: 100%;
}

.range-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.op-btn {
  padding: 4px 6px !important;
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary) !important;
  min-width: 24px;
}

.range-n {
  font-size: 13px;
  font-style: italic;
  color: var(--el-text-color-secondary);
  min-width: 14px;
  text-align: center;
}

.range-input {
  width: 100px !important;
}

.range-error {
  font-size: 11px;
  color: var(--el-color-danger);
  margin-top: 2px;
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

.tree-info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.tree-review {
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.tree-review--done {
  color: #67c23a;
}

.tree-review--pending {
  color: #e6a23c;
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