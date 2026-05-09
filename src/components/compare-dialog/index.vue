<script setup lang="ts">
import { reactive, computed, watch, ref } from 'vue'
import type { Node } from '@/types'
import type { CompareFrame } from '@/utils/tree-utils'
import { api as viewerApi } from 'v-viewer'
import type { ReviewRecord } from '@/api/tree'
import { Edit } from '@element-plus/icons-vue'
import ContextMenu from '@/components/context-menu/index.vue'
import type { ContextMenuItem } from '@/components/context-menu/index.vue'
import { Search } from '@element-plus/icons-vue'

const isViewerOpen = ref(false)

function openImageViewer(url: string) {
  if (!url) return
  isViewerOpen.value = true
  viewerApi({
    images: [url],
    options: {
      hidden: () => {
        isViewerOpen.value = false
      }
    }
  })
}

const props = defineProps<{
  modelValue: boolean
  viewMode: 'tree' | 'timeline'
  gridMode: '2' | '4'
  compareRootImage: string
  compareRootLabel: string
  compareTimelineNodes: Node[]
  comparePage: number
  maxComparePage: number
  isCompareFirstPage: boolean
  isCompareLastPage: boolean
  currentFrame: CompareFrame | null
  compareChildPage: number
  maxChildPage: number
  compareFrameIndex: number
  compareTreeFrames: CompareFrame[]
  isFirstChildPage: boolean
  isFirstFrame: boolean
  isLastChildPage: boolean
  isLastFrame: boolean
  hasPrevCompareTrees: boolean
  hasMoreCompareTrees: boolean
  childPageSize: number
  isSingleNodePreview: boolean
  singlePreviewImage: string
  singlePreviewLabel: string
  compareTreeName: string
  compareTreeRootId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:comparePage': [value: number]
  'update:compareChildPage': [value: number]
  'update:gridMode': [value: '2' | '4']
  'prev-compare-group': []
  'next-compare-group': []
  'go-prev-frame': []
  'go-next-frame': []
  'prev-compare-tree': []
  'next-compare-tree': []
  'closed': []
  'keydown': [e: KeyboardEvent]
  'submit-review': [records: ReviewRecord[]]
  'update-tree-name': [name: string]
  'search-history': [selfId: string]
}>()

const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const contextMenuItems = ref<ContextMenuItem[]>([])

function handleImageContextMenu(e: MouseEvent, selfId: string) {
  contextMenuItems.value = [
    {
      label: '相似图片匹配',
      icon: Search,
      handler: () => emit('search-history', selfId),
    },
  ]
  contextMenuRef.value?.show(e.clientX, e.clientY)
}

const reviewStates = reactive<Record<string, '一致' | '不一致' | undefined>>({})

const isEditingName = ref(false)
const editingName = ref('')

function startEditName() {
  editingName.value = props.compareTreeName
  isEditingName.value = true
}

function confirmEditName() {
  const newName = editingName.value.trim()
  if (newName && newName !== props.compareTreeName) {
    emit('update-tree-name', newName)
  }
  isEditingName.value = false
}

function cancelEditName() {
  isEditingName.value = false
}

function getReviewKey(childIndex: number): string {
  return `${props.compareFrameIndex}-${childIndex}`
}

function getReviewState(childIndex: number): '一致' | '不一致' | undefined {
  const key = getReviewKey(childIndex)
  if (reviewStates[key] !== undefined) return reviewStates[key]
  const child = props.currentFrame?.children[childIndex]
  if (child) {
    if (child.reviewResult === '一致') return '一致'
    if (child.reviewResult === '不一致') return '不一致'
  }
  return undefined
}

function setReviewState(childIndex: number, result: '一致' | '不一致') {
  const key = getReviewKey(childIndex)
  const child = props.currentFrame?.children[childIndex]
  const initialValue = child
    ? (child.reviewResult === '一致' ? '一致' : child.reviewResult === '不一致' ? '不一致' : undefined)
    : undefined
  const current = reviewStates[key] ?? initialValue
  const newValue = current === result ? undefined : result
  if (newValue === initialValue) {
    delete reviewStates[key]
  } else {
    reviewStates[key] = newValue
  }
}

const hasAnyReview = computed(() => {
  if (!props.currentFrame) return false
  return props.currentFrame.children.some((_, idx) => getReviewState(idx) !== undefined)
})

function submitReview() {
  if (!props.currentFrame) return
  const records: ReviewRecord[] = []
  props.currentFrame.children.forEach((child, idx) => {
    const state = getReviewState(idx)
    if (state) {
      records.push({ selfId: child.selfId, reviewResult: state })
    }
  })
  if (records.length > 0) {
    emit('submit-review', records)
  }
}

function clearReviewStates() {
  Object.keys(reviewStates).forEach((k) => delete reviewStates[k])
}

watch(() => props.modelValue, (val) => {
  if (!val) clearReviewStates()
})

const gridClass = computed(() => `compare-grid--${props.gridMode}`)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="viewMode === 'timeline' ? '时间轴比对' : '树形比对'"
    fullscreen
    append-to-body
    :close-on-press-escape="!isViewerOpen"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
    @keydown="emit('keydown', $event)"
  >
    <div v-if="viewMode === 'tree'" class="tree-name-bar">
      <template v-if="!isEditingName">
        <span v-if="compareTreeName" class="tree-name-text">{{ compareTreeName }}</span>
        <el-button size="small" :icon="Edit" circle @click="startEditName" />
      </template>
      <template v-else>
        <el-input v-model="editingName" size="small" class="tree-name-input" @keyup.enter="confirmEditName" />
        <el-button size="small" type="primary" @click="confirmEditName">修改</el-button>
        <el-button size="small" @click="cancelEditName">取消</el-button>
      </template>
    </div>
    <template v-if="isSingleNodePreview">
      <div class="single-preview">
        <el-image :src="singlePreviewImage" fit="contain" class="single-preview-image" @dblclick="openImageViewer(singlePreviewImage)" @contextmenu.prevent="handleImageContextMenu($event, singlePreviewLabel)">
          <template #placeholder>
            <div class="compare-image-loading">
              <div class="loading-spinner"></div>
            </div>
          </template>
        </el-image>
        <div class="compare-label">{{ singlePreviewLabel }}</div>
      </div>
    </template>
    <template v-else-if="viewMode === 'tree' && currentFrame">
      <div class="compare-body">
        <div class="compare-grid" :class="gridClass">
          <div class="compare-cell">
            <div class="compare-image-wrapper">
              <el-image :src="currentFrame.parent.selfUrl" fit="contain" class="compare-image" @dblclick="openImageViewer(currentFrame.parent.selfUrl)" @contextmenu.prevent="handleImageContextMenu($event, currentFrame.parent.selfId)">
                <template #placeholder>
                  <div class="compare-image-loading">
                    <div class="loading-spinner"></div>
                  </div>
                </template>
              </el-image>
            </div>
            <div class="compare-label">{{ currentFrame.parent.selfId }} | {{ currentFrame.position }}层</div>
          </div>
          <div v-for="i in childPageSize" :key="i" class="compare-cell compare-cell--child">
            <template v-if="currentFrame.children[compareChildPage * childPageSize + i - 1]">
              <div class="compare-image-wrapper">
                <el-image
                  :src="currentFrame.children[compareChildPage * childPageSize + i - 1]!.selfUrl"
                  fit="contain"
                  class="compare-image"
                  @dblclick="openImageViewer(currentFrame.children[compareChildPage * childPageSize + i - 1]!.selfUrl)"
                  @contextmenu.prevent="handleImageContextMenu($event, currentFrame.children[compareChildPage * childPageSize + i - 1]!.selfId)"
                >
                  <template #placeholder>
                    <div class="compare-image-loading">
                      <div class="loading-spinner"></div>
                    </div>
                  </template>
                </el-image>
                <div
                  v-if="gridMode === '4'"
                  class="cell-corner-group"
                  :class="`cell-corner-group--pos${i}`"
                >
                  <div class="score-badge score-badge--4">{{ currentFrame.children[compareChildPage * childPageSize + i - 1]!.score }}</div>
                  <div class="review-buttons review-buttons--4">
                    <button
                      class="review-btn review-btn--pass"
                      :class="{ active: getReviewState(compareChildPage * childPageSize + i - 1) === '一致' }"
                      @click="setReviewState(compareChildPage * childPageSize + i - 1, '一致')"
                    >✔</button>
                    <button
                      class="review-btn review-btn--fail"
                      :class="{ active: getReviewState(compareChildPage * childPageSize + i - 1) === '不一致' }"
                      @click="setReviewState(compareChildPage * childPageSize + i - 1, '不一致')"
                    >✘</button>
                  </div>
                </div>
                <div
                  v-if="gridMode === '2'"
                  class="review-bar"
                >
                  <button
                    class="review-btn-lg review-btn-lg--pass"
                    :class="{ active: getReviewState(compareChildPage * childPageSize + i - 1) === '一致' }"
                    @click="setReviewState(compareChildPage * childPageSize + i - 1, '一致')"
                  >✔ 一致</button>
                  <button
                    class="review-btn-lg review-btn-lg--fail"
                    :class="{ active: getReviewState(compareChildPage * childPageSize + i - 1) === '不一致' }"
                    @click="setReviewState(compareChildPage * childPageSize + i - 1, '不一致')"
                  >✘ 不一致</button>
                </div>
                <div
                  v-if="gridMode === '2'"
                  class="score-badge score-badge--2"
                >{{ currentFrame.children[compareChildPage * childPageSize + i - 1]!.score }}</div>
              </div>
              <div class="compare-label">
                {{ currentFrame.children[compareChildPage * childPageSize + i - 1]!.selfId }}
                {{ currentFrame.children[compareChildPage * childPageSize + i - 1]!.matchDate }}
              </div>
            </template>
            <div v-else class="compare-placeholder"></div>
          </div>
        </div>
        <div class="compare-controls">
          <el-radio-group :model-value="gridMode" size="small" @update:model-value="emit('update:gridMode', $event as '2' | '4')">
            <el-radio-button value="2">2宫格</el-radio-button>
            <el-radio-button value="4">4宫格</el-radio-button>
          </el-radio-group>
          <div class="compare-controls-divider"></div>
          <el-button
            v-if="isFirstChildPage && isFirstFrame && hasPrevCompareTrees"
            type="primary"
            size="small"
            @click="emit('prev-compare-tree')"
          >
            上一颗树
          </el-button>
          <el-button
            v-else-if="isFirstChildPage && !isFirstFrame"
            size="small"
            @click="emit('go-prev-frame')"
          >
            上一帧
          </el-button>
          <el-button
            v-else
            size="small"
            :disabled="isFirstChildPage"
            @click="emit('update:compareChildPage', compareChildPage - 1)"
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
            @click="emit('next-compare-tree')"
          >
            下一颗树
          </el-button>
          <el-button
            v-else-if="isLastChildPage && !isLastFrame"
            size="small"
            @click="emit('go-next-frame')"
          >
            下一帧
          </el-button>
          <el-button
            v-else
            size="small"
            :disabled="isLastChildPage"
            @click="emit('update:compareChildPage', compareChildPage + 1)"
          >
            下一页
          </el-button>
          <div class="compare-controls-divider"></div>
          <el-button
            type="success"
            size="small"
            :disabled="!hasAnyReview"
            @click="submitReview"
          >
            提交审核
          </el-button>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="compare-body">
        <div class="compare-grid" :class="gridClass">
          <div class="compare-cell">
            <div class="compare-image-wrapper">
              <el-image :src="compareRootImage" fit="contain" class="compare-image" @dblclick="openImageViewer(compareRootImage)" @contextmenu.prevent="handleImageContextMenu($event, compareRootLabel)">
                <template #placeholder>
                  <div class="compare-image-loading">
                    <div class="loading-spinner"></div>
                  </div>
                </template>
              </el-image>
            </div>
            <div class="compare-label">{{ compareRootLabel }}</div>
          </div>
          <div v-for="i in childPageSize" :key="i" class="compare-cell">
            <template v-if="compareTimelineNodes[comparePage * childPageSize + i - 1]">
              <div class="compare-image-wrapper">
                <el-image
                  :src="compareTimelineNodes[comparePage * childPageSize + i - 1]?.imageUrl"
                  fit="contain"
                  class="compare-image"
                  @dblclick="openImageViewer(compareTimelineNodes[comparePage * childPageSize + i - 1]?.imageUrl || '')"
                  @contextmenu.prevent="handleImageContextMenu($event, compareTimelineNodes[comparePage * childPageSize + i - 1]?.selfId || '')"
                >
                  <template #placeholder>
                    <div class="compare-image-loading">
                      <div class="loading-spinner"></div>
                    </div>
                  </template>
                </el-image>
              </div>
              <div class="compare-label">
                {{ compareTimelineNodes[comparePage * childPageSize + i - 1]?.selfId }}
                {{ compareTimelineNodes[comparePage * childPageSize + i - 1]?.matchDate }}
              </div>
            </template>
            <div v-else class="compare-placeholder"></div>
          </div>
        </div>
        <div class="compare-controls">
          <el-radio-group :model-value="gridMode" size="small" @update:model-value="emit('update:gridMode', $event as '2' | '4')">
            <el-radio-button value="2">2宫格</el-radio-button>
            <el-radio-button value="4">4宫格</el-radio-button>
          </el-radio-group>
          <div class="compare-controls-divider"></div>
          <el-button
            v-if="isCompareFirstPage && hasPrevCompareTrees"
            type="primary"
            size="small"
            @click="emit('prev-compare-group')"
          >
            上一组
          </el-button>
          <el-button
            v-else
            size="small"
            :disabled="comparePage === 0"
            @click="emit('update:comparePage', comparePage - 1)"
          >
            上一页
          </el-button>
          <span class="compare-page-info">{{ comparePage + 1 }} / {{ maxComparePage }}</span>
          <el-button
            v-if="isCompareLastPage && hasMoreCompareTrees"
            type="primary"
            size="small"
            @click="emit('next-compare-group')"
          >
            下一组
          </el-button>
          <el-button
            v-else
            size="small"
            :disabled="comparePage >= maxComparePage - 1"
            @click="emit('update:comparePage', comparePage + 1)"
          >
            下一页
          </el-button>
        </div>
      </div>
    </template>
    <ContextMenu ref="contextMenuRef" :items="contextMenuItems" />
  </el-dialog>
</template>

<style scoped>
.el-dialog__body {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  height: calc(100% - 44px);
  overflow: hidden;
}

.tree-name-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f5f7fa;
  flex-shrink: 0;
  border-bottom: 1px solid #e4e7ed;
}

.tree-name-text {
  color: #909399;
  font-size: 14px;
}

.tree-name-input {
  width: 200px;
}

.single-preview {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.single-preview :deep(.el-image) {
  width: 100% !important;
  height: 100% !important;
}

.single-preview :deep(.el-image__inner) {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}

.single-preview :deep(.el-image__placeholder) {
  width: 100%;
  height: 100%;
}

.single-preview .compare-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2px 8px 4px;
  font-size: 11px;
  color: #fff;
  background: linear-gradient(to top, rgba(0,0,0,0.45), transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 10;
  pointer-events: none;
}

.compare-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.compare-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  flex-shrink: 0;
}

.compare-controls-divider {
  width: 1px;
  height: 20px;
  background: #dcdfe6;
  margin: 0 4px;
}

.compare-page-info {
  font-size: 13px;
  color: #606266;
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.compare-grid--4 {
  grid-template-rows: 1fr 1fr;
}

.compare-grid--2 {
  grid-template-rows: 1fr;
}

.compare-cell {
  position: relative;
  overflow: hidden;
  background: #fff;
  min-height: 0;
}

.compare-image-wrapper {
  width: 100%;
  height: 100%;
}

.compare-image-wrapper :deep(.el-image) {
  width: 100% !important;
  height: 100% !important;
}

.compare-image-wrapper :deep(.el-image__inner) {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}

.compare-image-wrapper :deep(.el-image__placeholder) {
  width: 100%;
  height: 100%;
}

.compare-cell .compare-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2px 8px 4px;
  font-size: 11px;
  color: #fff;
  background: linear-gradient(to top, rgba(0,0,0,0.45), transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 10;
  pointer-events: none;
}

.compare-placeholder {
  width: 100%;
  height: 100%;
  background: #e8e8e8;
}

.review-buttons {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  z-index: 10;
}

.review-bar {
  position: absolute;
  bottom: 28px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.45));
  z-index: 10;
}

.review-btn-lg {
  padding: 8px 20px;
  border-radius: 20px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  background: rgba(0, 0, 0, 0.35);
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
  line-height: 1;
  letter-spacing: 1px;
}

.review-btn-lg--pass {
  color: #95d475;
}

.review-btn-lg--fail {
  color: #f89898;
}

.review-btn-lg--pass.active {
  background: #67c23a;
  border-color: #67c23a;
  color: #fff;
  transform: scale(1.08);
  box-shadow: 0 2px 16px rgba(103, 194, 58, 0.55);
}

.review-btn-lg--fail.active {
  background: #f56c6c;
  border-color: #f56c6c;
  color: #fff;
  transform: scale(1.08);
  box-shadow: 0 2px 16px rgba(245, 108, 108, 0.55);
}

.review-btn-lg:hover {
  border-color: #fff;
  background: rgba(0, 0, 0, 0.55);
}

.cell-corner-group {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  z-index: 10;
}

.cell-corner-group--pos1 {
  bottom: 28px;
  left: 6px;
}

.cell-corner-group--pos2 {
  top: 6px;
  right: 6px;
}

.cell-corner-group--pos3 {
  top: 6px;
  left: 6px;
}

.review-buttons--4 {
  position: relative;
  top: auto;
  right: auto;
}

.score-badge {
  font-weight: bold;
  font-size: 14px;
  color: #888;
  z-index: 10;
  pointer-events: none;
}

.score-badge--2 {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.5);
  color: #ddd;
  padding: 2px 6px;
  border-radius: 4px;
}

.score-badge--4 {
  position: relative;
  background: rgba(0, 0, 0, 0.5);
  color: #ddd;
  padding: 2px 6px;
  border-radius: 4px;
}

.review-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #dcdfe6;
  background: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  line-height: 1;
}

.review-btn--pass {
  color: #95d475;
}

.review-btn--fail {
  color: #f89898;
}

.review-btn--pass.active {
  background: #67c23a;
  border-color: #67c23a;
  color: #fff;
  transform: scale(1.15);
  box-shadow: 0 2px 12px rgba(103, 194, 58, 0.6);
}

.review-btn--fail.active {
  background: #f56c6c;
  border-color: #f56c6c;
  color: #fff;
  transform: scale(1.15);
  box-shadow: 0 2px 12px rgba(245, 108, 108, 0.6);
}

.review-btn:hover {
  border-color: #fff;
  background: rgba(0, 0, 0, 0.6);
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
  width: 40px;
  height: 40px;
  border: 3px solid #e4e7ed;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
