# 比对弹窗功能实现计划

## 需求概述
把现有双击预览单张图片的弹窗，改成比对功能弹窗。双击任意节点，弹出 2×2 网格布局的大框，左上角固定展示该树根节点，其余 3 格按时间轴顺序展示图片，支持翻页切换，不足 3 张用灰色占位。每张图片底部显示编号和时间。

## 实现步骤

### 1. App.vue — 替换旧预览状态和逻辑

**删除旧的状态：**
- `previewImageVisible`
- `currentPreviewImage`

**新增状态：**
- `compareVisible: ref<boolean>(false)` — 比对弹窗开关
- `compareRootImage: ref<string>('')` — 根节点图片 URL
- `compareRootLabel: ref<string>('')` — 根节点编号+时间文本
- `compareTimelineNodes: ref<Node[]>([])` — 当前树按时间排序的所有节点
- `comparePage: ref<number>(0)` — 当前页码，每页 3 张

### 2. App.vue — 修改 handleNodeDoubleClick

双击时：
1. 从 `allTrees` 找到被双击节点所属的树（遍历每棵树的嵌套结构匹配 `selfId`）
2. 找到后：
   - `compareRootImage` = 该树根节点的 `selfUrl`
   - `compareRootLabel` = 根节点 `selfId` + `matchDate`
   - 递归收集该树所有节点，按 `matchDate` 升序排列 → `compareTimelineNodes`
3. `comparePage` 重置为 0
4. 打开 `compareVisible = true`

### 3. App.vue — 模板替换

把旧的 `<el-dialog v-model="previewImageVisible" ...>` 替换为：

```html
<el-dialog v-model="compareVisible" title="比对" width="90%" top="3vh" append-to-body>
  <!-- 翻页控制栏 -->
  <div class="compare-controls">
    <el-button :disabled="comparePage === 0" @click="comparePage--">上一页</el-button>
    <span class="compare-page-info">{{ comparePage + 1 }} / {{ maxComparePage }}</span>
    <el-button :disabled="comparePage >= maxComparePage - 1" @click="comparePage++">下一页</el-button>
  </div>

  <!-- 2×2 网格 -->
  <div class="compare-grid">
    <!-- 左上：根节点（固定） -->
    <div class="compare-cell">
      <el-image :src="compareRootImage" fit="contain" class="compare-image" />
      <div class="compare-label">{{ compareRootLabel }}</div>
    </div>

    <!-- 其余 3 格：时间轴图片 -->
    <div v-for="i in 3" :key="i" class="compare-cell">
      <template v-if="compareTimelineNodes[comparePage * 3 + i - 1]">
        <el-image :src="compareTimelineNodes[comparePage * 3 + i - 1].imageUrl" fit="contain" class="compare-image" />
        <div class="compare-label">
          {{ compareTimelineNodes[comparePage * 3 + i - 1].selfId }} {{ compareTimelineNodes[comparePage * 3 + i - 1].matchDate }}
        </div>
      </template>
      <div v-else class="compare-placeholder"></div>
    </div>
  </div>
</el-dialog>
```

### 4. App.vue — 计算属性

- `maxComparePage`: `Math.max(1, Math.ceil(compareTimelineNodes.length / 3))`

### 5. App.vue — 样式

```css
.compare-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 12px;
  min-height: 500px;
}
.compare-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.compare-image {
  width: 100%;
  height: 0;
  flex: 1;
}
.compare-label {
  padding: 6px 0;
  font-size: 12px;
  color: #666;
  background: #f5f7fa;
  width: 100%;
  text-align: center;
}
.compare-placeholder {
  flex: 1;
  width: 100%;
  background: #e8e8e8;
}
```

### 6. App.vue — 收集树内所有节点的辅助函数

```ts
function collectTreeNodes(node: TreeNode, list: Node[]): void {
  list.push({
    id: node.selfId,
    parentId: node.parentId,
    selfId: node.selfId,
    score: node.score,
    matchDate: node.matchDate,
    imageUrl: node.selfUrl,
    selfUrl: node.selfUrl,
  })
  if (node.children) {
    node.children.forEach((child) => collectTreeNodes(child, list))
  }
}
```

## 涉及文件

仅 **`src/App.vue`** 一个文件需要修改。
