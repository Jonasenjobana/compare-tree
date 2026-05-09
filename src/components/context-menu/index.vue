<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { Component } from 'vue'

export interface ContextMenuItem {
  label: string
  icon?: Component
  handler: () => void
  divided?: boolean
  disabled?: boolean
}

const props = defineProps<{
  items: ContextMenuItem[]
}>()

const visible = ref(false)
const posX = ref(0)
const posY = ref(0)

function show(x: number, y: number) {
  posX.value = x
  posY.value = y
  visible.value = true
}

function hide() {
  visible.value = false
}

function handleItemClick(item: ContextMenuItem) {
  if (item.disabled) return
  item.handler()
  hide()
}

function handleClickOutside(e: MouseEvent) {
  if (!visible.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.context-menu')) {
    hide()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && visible.value) {
    hide()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
  document.addEventListener('keydown', handleKeydown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
  document.removeEventListener('keydown', handleKeydown, true)
})

defineExpose({ show, hide })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="context-menu"
      :style="{ left: posX + 'px', top: posY + 'px' }"
    >
      <template v-for="(item, index) in items" :key="index">
        <div
          v-if="item.divided && index > 0"
          class="context-menu-divider"
        ></div>
        <div
          class="context-menu-item"
          :class="{ 'context-menu-item--disabled': item.disabled }"
          @click="handleItemClick(item)"
        >
          <el-icon v-if="item.icon" class="context-menu-icon">
            <component :is="item.icon" />
          </el-icon>
          <span class="context-menu-label">{{ item.label }}</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style>
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e4e7ed;
  padding: 4px 0;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: #f5f7fa;
}

.context-menu-item--disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.context-menu-item--disabled:hover {
  background: transparent;
}

.context-menu-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.context-menu-label {
  white-space: nowrap;
}

.context-menu-divider {
  height: 1px;
  background: #e4e7ed;
  margin: 4px 0;
}
</style>
