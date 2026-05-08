# 树形模式下叶子节点预览优化 实施计划

## 需求分析

1. **跳过叶子节点的帧**：`buildTreeCompareFrames` 当前会为每个节点（包括叶子节点）创建帧，叶子节点的帧 `children` 为空，只有 parent 没有子图可对比，没有意义。需要过滤掉叶子节点的帧。
2. **双击叶子节点的特殊情况**：如果用户直接双击了一个叶子节点，此时帧列表为空（全被过滤了），应该进入单照片预览模式——只有一张图片占满整个 dialog，没有功能按钮（没有宫格切换、没有翻页、没有审核按钮）。
3. **总帧数调整**：过滤叶子帧后，总帧数自然减少，帧索引、翻页逻辑自动适配。

## 涉及文件

* `src/utils/tree-utils.ts` — 修改 `buildTreeCompareFrames` 过滤叶子节点帧

* `src/composables/useCompareDialog.ts` — 处理双击叶子节点的单图预览模式

* `src/components/compare-dialog/index.vue` — 新增单图预览模板

## 实施步骤

### 步骤1：修改 `buildTreeCompareFrames` 过滤叶子节点

在 `tree-utils.ts` 的 `buildTreeCompareFrames` 函数中，BFS 遍历时跳过没有子节点的节点（叶子节点）：

```typescript
export function buildTreeCompareFrames(startNode: TreeNode, treeRoot: TreeRoot): CompareFrame[] {
  const positionMap = buildPositionMap(treeRoot.tree)
  const frames: CompareFrame[] = []
  const queue: TreeNode[] = [startNode]
  while (queue.length > 0) {
    const node = queue.shift()!
    // 先将子节点入队（不管当前节点是否为叶子）
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => queue.push(child))
      // 只有非叶子节点才创建帧
      frames.push({
        parent: node,
        children: [...node.children],
        position: positionMap.get(node) || '?',
      })
    }
  }
  return frames
}
```

关键变化：

* 子节点入队逻辑移到判断前面，确保叶子节点的子树不被丢失

* 只有 `children.length > 0` 的节点才创建帧

* **注意**：如果 `startNode` 本身就是叶子节点，返回空数组 `[]`

### 步骤2：`useCompareDialog` 处理双击叶子节点

在 `openCompareForNode` 中，树形模式下 `buildTreeCompareFrames` 返回空数组时，说明双击的是叶子节点，需要设置一个标志位表示单图预览模式：

* 新增 `isSingleNodePreview` computed：`viewMode === 'tree' && compareTreeFrames.length === 0 && compareVisible`

* 当双击叶子节点时，`compareTreeFrames` 为空，但 `compareVisible = true`，此时进入单图预览

* 需要保存被双击的叶子节点的图片URL：`singlePreviewImage` ref 和 `singlePreviewLabel` ref

* 在 `openCompareForNode` 中，如果构建帧为空且是树形模式，设置 `singlePreviewImage = node.selfUrl`，`singlePreviewLabel = node.selfId`

* 导出 `isSingleNodePreview`、`singlePreviewImage`、`singlePreviewLabel`

### 步骤3：`CompareDialog` 新增单图预览模板

在 CompareDialog 中：

* 新增 props：`isSingleNodePreview`、`singlePreviewImage`、`singlePreviewLabel`

* 模板中增加条件判断：

  * 如果 `isSingleNodePreview` 为 true：显示单张图片，占满整个 dialog body，`fit="contain"`，没有控制按钮区域

  * 否则保持现有的树形/时间轴模板

单图预览模板结构：

```html
<template v-if="isSingleNodePreview">
  <div class="single-preview">
    <el-image :src="singlePreviewImage" fit="contain" class="single-preview-image">
      <template #placeholder>
        <div class="compare-image-loading">
          <div class="loading-spinner"></div>
        </div>
      </template>
    </el-image>
    <div class="compare-label">{{ singlePreviewLabel }}</div>
  </div>
</template>
```

CSS：

```css
.single-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.single-preview-image {
  width: 100%;
  flex: 1;
  min-height: 0;
}
```

### 步骤4：App.vue 传递新 props

从 `useCompareDialog` 解构出 `isSingleNodePreview`、`singlePreviewImage`、`singlePreviewLabel`，传递给 CompareDialog。

## 关键设计决策

1. **过滤在** **`buildTreeCompareFrames`** **中做**：从源头过滤，下游所有逻辑（帧数、分页、导航）自动适配
2. **单图预览用标志位判断**：`compareTreeFrames.length === 0` 且 `compareVisible === true` 表示双击了叶子节点
3. **单图预览极简**：只有一张图 + 一个 label，没有宫格切换、翻页、审核按钮，图片占满 dialog
4. **时间轴模式不受影响**：时间轴模式不使用 `buildTreeCompareFrames`，不涉及帧过滤

