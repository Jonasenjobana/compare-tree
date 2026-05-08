<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import type { Node } from '@/types'
import type { CompareFrame } from '@/utils/tree-utils'

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
  'submit-review': [records: { selfId: string; reviewResult: string }[]]
}>()

const reviewStates = reactive<Record<string, '一致' | '不一致' | undefined>>({})

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
  const records: { selfId: string; reviewResult: string }[] = []
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
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
    @keydown="emit('keydown', $event)"
  >
    <template v-if="viewMode === 'tree' && currentFrame">
      <div class="compare-body">
        <div class="compare-grid" :class="gridClass">
          <div class="compare-cell">
            <div class="compare-image-wrapper">
              <el-image :src="currentFrame.parent.selfUrl" fit="contain" class="compare-image">
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
                >
                  <template #placeholder>
                    <div class="compare-image-loading">
                      <div class="loading-spinner"></div>
                    </div>
                  </template>
                </el-image>
                <div class="review-buttons" :class="{ 'review-buttons--bottom': gridMode === '2' }">
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
              <el-image :src="compareRootImage" fit="contain" class="compare-image">
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
  </el-dialog>
</template>

<style>
.el-dialog__body {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  height: calc(100% - 44px);
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
}

.compare-grid--4 {
  grid-template-rows: 1fr 1fr;
}

.compare-grid--2 {
  grid-template-rows: 1fr;
}

.compare-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid #e4e7ed;
  border-radius: 2px;
  overflow: hidden;
  background: #fff;
  min-height: 0;
}

.compare-cell .el-image {
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.compare-cell .el-image__placeholder {
  width: 100%;
  height: 100%;
}

.compare-cell .el-image__inner {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain !important;
}

.compare-image {
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.compare-image-wrapper {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.compare-image-wrapper .el-image {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
}

.compare-image-wrapper .el-image__inner {
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
}

.review-buttons {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  z-index: 10;
}

.review-buttons--bottom {
  top: auto;
  right: 50%;
  transform: translateX(50%);
  bottom: 6px;
  gap: 20px;
}

.review-buttons--bottom .review-btn {
  width: 120px;
  height: 120px;
  font-size: 48px;
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

.compare-label {
  padding: 2px 0;
  font-size: 11px;
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
