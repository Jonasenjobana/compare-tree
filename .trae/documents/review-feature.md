# 人工审核功能计划

## 需求概述

在树形模式的比对弹窗中，每个子节点图片区域增加 ✔ / ❌ 审核按钮，表示"一致"/"不一致"。底部增加确认提交按钮，调用 `POST /batch_review` 接口。

## 交互设计

### 审核状态
每个子节点图片有三种审核状态：
- **未选中**（默认）：两个按钮均为默认样式
- **一致**（✔）：✔ 按钮高亮绿色
- **不一致**（❌）：❌ 按钮高亮红色

### 按钮位置
在子节点图片区域的**右上角**，覆盖在图片上方，使用绝对定位：
```
┌─────────────────┐
│          [✔][❌] │  ← 右上角浮层
│                  │
│    子节点图片    │
│                  │
├─────────────────┤
│  selfId  date   │  ← 原有标签
└─────────────────┘
```

左上角父节点图片**不显示审核按钮**（它是参照图，不需要审核）。

### 提交按钮
底部翻页控制区域旁边增加"提交审核"按钮：
- 当**没有任何子节点被选择**时，按钮禁用
- 当**至少有一个子节点被选择**时，按钮可用
- 点击后调用 `POST /batch_review` 接口

### 提交数据格式
```json
{
  "records": [
    { "id": "子节点selfId", "reviewResult": "一致" },
    { "id": "子节点selfId", "reviewResult": "不一致" }
  ]
}
```

只提交当前帧中**已选择状态**的子节点记录。

### 状态持久化
- 审核状态随帧索引 + 子节点索引关联，翻页/切帧后保留已选择的状态
- 切换到下一颗树时清空审核状态
- 关闭弹窗时清空所有审核状态

## 实现步骤

### Step 1: 新增 API 接口

在 `src/api/tree.ts` 中新增：

```ts
export interface ReviewRecord {
  id: string
  reviewResult: '一致' | '不一致'
}

export interface BatchReviewRequest {
  records: ReviewRecord[]
}

export function batchReview(data: BatchReviewRequest): Promise<any> {
  return request.post('/batch_review', data)
}
```

### Step 2: 在 compare-dialog 组件中增加审核状态

新增本地状态管理：

```ts
import { reactive } from 'vue'

// key: `${frameIndex}-${childIndex}`，value: '一致' | '不一致' | undefined
const reviewStates = reactive<Record<string, '一致' | '不一致' | undefined>>({})

function getReviewKey(childIndex: number): string {
  return `${props.compareFrameIndex}-${childIndex}`
}

function getReviewState(childIndex: number): '一致' | '不一致' | undefined {
  return reviewStates[getReviewKey(childIndex)]
}

function setReviewState(childIndex: number, result: '一致' | '不一致') {
  const key = getReviewKey(childIndex)
  const current = reviewStates[key]
  // 再次点击相同按钮取消选择
  reviewStates[key] = current === result ? undefined : result
}
```

### Step 3: 模板中增加审核按钮

在每个子节点 `compare-cell` 内，图片区域增加浮层按钮：

```html
<div class="compare-cell compare-cell--child">
  <div class="compare-image-wrapper">
    <el-image ... />
    <div class="review-buttons">
      <button
        class="review-btn review-btn--pass"
        :class="{ active: getReviewState(compareChildPage * 3 + i - 1) === '一致' }"
        @click="setReviewState(compareChildPage * 3 + i - 1, '一致')"
      >✔</button>
      <button
        class="review-btn review-btn--fail"
        :class="{ active: getReviewState(compareChildPage * 3 + i - 1) === '不一致' }"
        @click="setReviewState(compareChildPage * 3 + i - 1, '不一致')"
      >❌</button>
    </div>
  </div>
  <div class="compare-label">...</div>
</div>
```

### Step 4: 底部增加提交按钮

在树形模式的 `compare-controls` 区域末尾增加：

```html
<el-button
  type="success"
  size="small"
  :disabled="!hasAnyReview"
  @click="submitReview"
>
  提交审核
</el-button>
```

计算属性和提交函数：

```ts
const hasAnyReview = computed(() => {
  return Object.values(reviewStates).some(v => v !== undefined)
})

const emit = defineEmits<{
  ...
  'submit-review': [records: { id: string; reviewResult: string }[]]
}>()

async function submitReview() {
  const currentFrame = props.currentFrame
  if (!currentFrame) return
  
  const records: { id: string; reviewResult: string }[] = []
  currentFrame.children.forEach((child, idx) => {
    const state = getReviewState(idx)
    if (state) {
      records.push({ id: child.selfId, reviewResult: state })
    }
  })
  if (records.length > 0) {
    emit('submit-review', records)
  }
}
```

### Step 5: App.vue 中处理提交事件

```ts
import { batchReview } from '@/api/tree'
import { ElMessage } from 'element-plus'

async function handleSubmitReview(records: { id: string; reviewResult: string }[]) {
  try {
    await batchReview({ records })
    ElMessage.success('审核提交成功')
  } catch (error) {
    console.error('审核提交失败:', error)
    ElMessage.error('审核提交失败')
  }
}
```

模板中：
```html
@submit-review="handleSubmitReview"
```

### Step 6: 清空审核状态

- 切换树时（`nextCompareTree`/`prevCompareTree`）需要清空 reviewStates
- 关闭弹窗时清空

在 compare-dialog 的 `closed` 事件处理中：
```ts
function onDialogClosed() {
  Object.keys(reviewStates).forEach(k => delete reviewStates[k])
  emit('closed')
}
```

### Step 7: 样式

```css
.compare-cell--child {
  position: relative;
}

.compare-image-wrapper {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
}

.review-buttons {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  z-index: 10;
}

.review-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #dcdfe6;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

.review-btn--pass.active {
  background: #67c23a;
  border-color: #67c23a;
  color: #fff;
  transform: scale(1.15);
}

.review-btn--fail.active {
  background: #f56c6c;
  border-color: #f56c6c;
  color: #fff;
  transform: scale(1.15);
}

.review-btn:hover {
  border-color: #409eff;
}
```

## 涉及文件

| 文件 | 修改内容 |
|------|---------|
| `src/api/tree.ts` | 新增 `batchReview` 接口和相关类型 |
| `src/components/compare-dialog/index.vue` | 新增审核状态、按钮、提交逻辑、样式 |
| `src/App.vue` | 处理 `submit-review` 事件调用 API |

## 不涉及的文件

- `src/composables/useCompareDialog.ts` — 审核状态完全在 compare-dialog 组件内部管理，不需要提升到 composable
- `src/types/index.ts` — 不需要修改，ReviewRecord 类型放在 api 层
- `src/utils/tree-utils.ts` — 无需修改
