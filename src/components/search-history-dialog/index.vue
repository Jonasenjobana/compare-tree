<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SearchHistoryItem } from '@/types'
import { api as viewerApi } from 'v-viewer'

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
  sourceImage: string
  sourceLabel: string
  results: SearchHistoryItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const gridMode = ref<'2' | '4'>('4')
const page = ref(0)
const childPageSize = computed(() => gridMode.value === '2' ? 1 : 3)
const maxPage = computed(() => Math.max(1, Math.ceil(props.results.length / childPageSize.value)))
const gridClass = computed(() => `compare-grid--${gridMode.value}`)

watch(gridMode, () => {
  page.value = 0
})

watch(() => props.modelValue, (val) => {
  if (val) {
    page.value = 0
    gridMode.value = '4'
  }
})
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="相似图片匹配"
    fullscreen
    append-to-body
    :close-on-press-escape="!isViewerOpen"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="search-body">
      <div class="compare-grid" :class="gridClass">
        <div class="compare-cell">
          <div class="compare-image-wrapper">
            <el-image :src="sourceImage" fit="contain" class="compare-image" @dblclick="openImageViewer(sourceImage)">
              <template #placeholder>
                <div class="compare-image-loading">
                  <div class="loading-spinner"></div>
                </div>
              </template>
            </el-image>
          </div>
          <div class="compare-label">{{ sourceLabel }} (原匹配图)</div>
        </div>
        <div v-for="i in childPageSize" :key="i" class="compare-cell">
          <template v-if="results[page * childPageSize + i - 1]">
            <div class="compare-image-wrapper">
              <el-image
                :src="results[page * childPageSize + i - 1]!.url"
                fit="contain"
                class="compare-image"
                @dblclick="openImageViewer(results[page * childPageSize + i - 1]!.url)"
              >
                <template #placeholder>
                  <div class="compare-image-loading">
                    <div class="loading-spinner"></div>
                  </div>
                </template>
              </el-image>
              <div :class="`score-badge score-badge--${gridMode}`">{{ results[page * childPageSize + i - 1]!.score.toFixed(4) }}</div>
            </div>
            <div class="compare-label">{{ results[page * childPageSize + i - 1]!.name }}</div>
          </template>
          <div v-else class="compare-placeholder"></div>
        </div>
      </div>
      <div class="compare-controls">
        <el-radio-group :model-value="gridMode" size="small" @update:model-value="gridMode = $event as '2' | '4'">
          <el-radio-button value="2">2宫格</el-radio-button>
          <el-radio-button value="4">4宫格</el-radio-button>
        </el-radio-group>
        <div class="compare-controls-divider"></div>
        <el-button size="small" :disabled="page === 0" @click="page--">上一页</el-button>
        <span class="compare-page-info">{{ page + 1 }} / {{ maxPage }}</span>
        <el-button size="small" :disabled="page >= maxPage - 1" @click="page++">下一页</el-button>
      </div>
    </div>
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

.search-body {
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
  overflow: visible;
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
  overflow: visible;
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

.score-badge {
  position: absolute;
  font-weight: bold;
  font-size: 14px;
  z-index: 10;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.5);
  color: #ddd;
  padding: 2px 6px;
  border-radius: 4px;
}
.score-badge--2 {
  top: 50%;
  transform: translate(-50%, -50%);
}
.score-badge--4 {
  top: 0;
  left: 0;
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
