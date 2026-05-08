<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, SortUp, SortDown } from '@element-plus/icons-vue'
import PreviewPanel from '@/components/preview-panel/index.vue'
import AntVX6 from '@/components/antv-x6-tree/index.vue'
import CompareDialog from '@/components/compare-dialog/index.vue'
import { useTreeData } from '@/composables/useTreeData'
import { useCompareDialog } from '@/composables/useCompareDialog'
import { batchReview } from '@/api/tree'
import type { Node } from '@/types'

const {
  allTrees, nodes, viewMode, timelineOrder,
  searchKeyword, selectedTreeId, filteredTrees,
  changeSelectedTree, loadTreeData,
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
  if (goJsTreeRef.value) {
    goJsTreeRef.value.locateNode(rootId)
  }
}

const handleNodeSelect = (node: Node) => {
  selectedNode.value = node
  focusNodeId.value = node.id
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

async function handleSubmitReview(records: { selfId: string; reviewResult: string }[]) {
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
    function updateTreeReviewResult(node: any) {
      const newResult = recordMap.get(node.selfId)
      if (newResult !== undefined) {
        node.reviewResult = newResult
      }
      if (node.children) {
        node.children.forEach((c: any) => updateTreeReviewResult(c))
      }
    }
    allTrees.value.forEach((t) => updateTreeReviewResult(t.tree))
  } catch (error) {
    console.error('审核提交失败:', error)
    ElMessage.error('审核提交失败')
  }
}

onMounted(() => {
  loadTreeData()
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

    <CompareDialog
      v-model="compareVisible"
      :view-mode="viewMode"
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
      @update:compare-page="comparePage = $event"
      @update:compare-child-page="compareChildPage = $event"
      @prev-compare-group="prevCompareGroup"
      @next-compare-group="nextCompareGroup"
      @go-prev-frame="goPrevFrame"
      @go-next-frame="goNextFrame"
      @prev-compare-tree="prevCompareTree"
      @next-compare-tree="nextCompareTree"
      @closed="onCompareClosed"
      @keydown="handleCompareKeydown"
      @submit-review="handleSubmitReview"
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
