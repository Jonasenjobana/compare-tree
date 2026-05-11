<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SearchHistoryItem } from '@/types'
import { moveTreeNode } from '@/api/tree'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api as viewerApi } from 'v-viewer'

const props = defineProps<{
  modelValue: boolean
  sourceImage: string
  sourceSelfId: string
  rootId: string
  count: number
  results: SearchHistoryItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:count': [value: number]
  'move-success': [newRootId: string | null]
}>()

const selectedName = ref<string | null>(null)
const selectedUrl = ref('')
const selectedScore = ref(0)
const selectedHistory = ref<SearchHistoryItem | null>(null)
const submitting = ref(false)
const page = ref(0)
const pageSize = 1
const maxPage = computed(() => Math.max(1, Math.ceil(props.results.length / pageSize)))
const isLastPage = computed(() => page.value >= maxPage.value - 1)

const currentItem = computed(() => props.results[page.value] || null)

const isSelected = computed(() => {
  if (!currentItem.value) return false
  return selectedName.value === currentItem.value.name
})

function selectItem(item: SearchHistoryItem) {
  if (selectedName.value === item.name) {
    selectedName.value = null
    selectedUrl.value = ''
    selectedScore.value = 0
    selectedHistory.value = null
  } else {
    selectedName.value = item.name
    selectedUrl.value = item.url
    selectedScore.value = item.score
    selectedHistory.value = item
  }
}

function openImageViewer(url: string) {
  if (!url) return
  viewerApi({
    images: [url],
    options: {
      hidden: () => {}
    }
  })
}

async function confirmMove() {
  let parentId = null
  let score = 100
  const { rootId, selfId } = currentItem.value || {}
  if (selectedName.value) {
    const splitName = selectedName.value.split('_')
    parentId = splitName.slice(0, 2).join('_')
    score = selectedScore.value
  }

  const actionLabel = selectedName.value
    ? `移动到 ${parentId}`
    : '移除节点（变为根节点）'

  try {
    await ElMessageBox.confirm(
      `确认将节点 ${props.sourceSelfId} ${actionLabel}？`,
      '确认操作',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  submitting.value = true
  try {
    await moveTreeNode({ selfId: props.sourceSelfId, parentId, score })
    ElMessage.success('节点移动成功')
    emit('move-success', props.rootId == props.sourceSelfId ? rootId! : props.rootId)
    emit('update:modelValue', false)
  } catch (error) {
    console.error('节点移动失败:', error)
    ElMessage.error('节点移动失败')
  } finally {
    submitting.value = false
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    selectedName.value = null
    selectedUrl.value = ''
    selectedScore.value = 0
    page.value = 0
  }
})

watch(() => props.results, () => {
  page.value = 0
})

function pageChange(flag: boolean) {
  selectedName.value = null;
  selectedHistory.value = null;
  if (flag) {
    page.value++
  } else {
    page.value--
  }
}

</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="移动节点"
    fullscreen
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="move-grid">
      <div class="grid-cell">
        <div class="cell-label">原图</div>
        <div class="cell-image-wrap">
          <el-image :src="sourceImage" fit="contain" class="cell-image" @dblclick="openImageViewer(sourceImage)">
            <template #placeholder>
              <div class="image-loading"><div class="loading-spinner"></div></div>
            </template>
          </el-image>
        </div>
        <div class="cell-id">{{ sourceSelfId }}</div>
      </div>

      <div
        class="grid-cell grid-cell--candidate"
        :class="{ 'grid-cell--active': isSelected }"
        @click="currentItem && selectItem(currentItem)"
      >
        <template v-if="currentItem">
          <div class="cell-label">匹配图</div>
          <div class="cell-image-wrap">
            <el-image :src="currentItem.url" fit="contain" class="cell-image" @dblclick.stop="openImageViewer(currentItem.url)">
              <template #placeholder>
                <div class="image-loading"><div class="loading-spinner"></div></div>
              </template>
            </el-image>
            <div class="score-tag">{{ currentItem.score.toFixed(4) }}</div>
          </div>
          <div class="cell-id">{{ currentItem.name }}</div>
        </template>
        <template v-else>
          <div class="cell-label">匹配图</div>
          <div class="empty-cell">暂无</div>
        </template>
      </div>
    </div>

    <div class="bottom-bar">
      <el-input-number v-model="props.count" :min="1" @change="emit('update:count', $event)" />
      <el-button size="small" :disabled="page === 0" @click="pageChange(false)">上一页</el-button>
      <span class="page-info">{{ page + 1 }} / {{ maxPage }}</span>
      <el-button size="small" :disabled="isLastPage" @click="pageChange(true)">下一页</el-button>
      <el-button
        size="small"
        type="primary"
        :loading="submitting"
        @click="confirmMove"
      >
        {{ selectedName ? '确认移动' : '确认移除（根节点）' }}
      </el-button>
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

.move-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
  gap: 2px;
  background: #e4e7ed;
}

.grid-cell {
  position: relative;
  background: #fff;
  overflow: hidden;
  min-height: 0;
}

.grid-cell--candidate {
  cursor: pointer;
  border: 3px solid transparent;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.grid-cell--active {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.35), inset 0 0 20px rgba(64, 158, 255, 0.1);
}

.cell-label {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(to bottom, rgba(0,0,0,0.45), transparent);
  z-index: 10;
  pointer-events: none;
}

.cell-image-wrap {
  width: 100%;
  height: 100%;
}

.cell-image {
  width: 100%;
  height: 100%;
}

.cell-image :deep(.el-image__inner) {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}

.score-tag {
  position: absolute;
  bottom: 24px;
  left: 4px;
  font-weight: bold;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.5);
  color: #ddd;
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
}

.cell-id {
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

.empty-cell {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 14px;
}

.bottom-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  flex-shrink: 0;
  background: #fff;
  border-top: 1px solid #e4e7ed;
}

.page-info {
  font-size: 13px;
  color: #606266;
  margin: 0 4px;
}

.image-loading {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.loading-spinner {
  width: 36px;
  height: 36px;
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
