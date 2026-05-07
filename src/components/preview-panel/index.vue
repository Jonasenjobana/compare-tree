<template>
  <div class="preview-panel">
    <div class="empty-tip" v-if="!selectedNode">请选择一个节点</div>
    <div v-else>
      <div class="preview-image">
        <el-image :src="selectedNode.imageUrl" fit="contain" />
      </div>
      <el-divider />
      <div class="info-item">
        <span class="label">图片ID:</span>
        <span class="value">{{ selectedNode.selfId }}</span>
      </div>
      <div class="info-item">
        <span class="label">相似度:</span>
        <el-tag :type="selectedNode.score > 0.8 ? 'success' : 'info'">
          {{ selectedNode.score.toFixed(2) }}
        </el-tag>
      </div>
      <div class="info-item">
        <span class="label">父节点ID:</span>
        <span class="value">{{ selectedNode.parentId || '无' }}</span>
      </div>
      <div class="info-item">
        <span class="label">匹配时间:</span>
        <span class="value">{{ selectedNode.matchDate }}</span>
      </div>
      <div class="info-item">
        <span class="label">修改状态:</span>
        <el-tag :type="selectedNode.isModified ? 'warning' : 'info'">
          {{ selectedNode.isModified ? '已手动修改' : '系统匹配' }}
        </el-tag>
      </div>
      <el-divider />
      <div class="edit-section">
        <h4>修改父节点</h4>
        <el-select v-model="selectedParentId" placeholder="请选择父节点" style="width: 100%; margin: 8px 0;">
          <el-option v-for="node in availableNodes" :key="node.id" :label="node.selfId" :value="node.id" />
        </el-select>
        <el-button type="primary" style="width: 100%" @click="handleSubmit" :disabled="!selectedParentId || selectedParentId === selectedNode.parentId">
          确认修改
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, defineProps, defineEmits } from 'vue'
import type { Node } from '@/types'

const props = defineProps<{
  selectedNode: Node | null
  allNodes: Node[]
}>()

const emit = defineEmits<{
  updateParent: [nodeId: string, newParentId: string]
}>()

const selectedParentId = ref<string>('')

const availableNodes = computed(() => {
  if (!props.selectedNode) return []
  // 只能选择根节点（parentId为空），不能选自己
  return props.allNodes.filter(node => !node.parentId && node.id !== props.selectedNode.id)
})

watch(() => props.selectedNode, (node) => {
  if (node) {
    selectedParentId.value = node.parentId
  } else {
    selectedParentId.value = ''
  }
}, { immediate: true })

const handleSubmit = () => {
  if (!props.selectedNode || !selectedParentId.value) return
  emit('updateParent', props.selectedNode.id, selectedParentId.value)
}
</script>

<style scoped>
.preview-panel {
  height: 100%;
  padding: 16px;
  background: #fff;
  border-left: 1px solid #E4E7ED;
  overflow-y: auto;
}

.empty-tip {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 14px;
}

.preview-image {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 4px;
  overflow: hidden;
  background: #F5F7FA;
}

.preview-image :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.info-item .label {
  color: #606266;
  font-weight: 500;
}

.info-item .value {
  color: #303133;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-section h4 {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
</style>
