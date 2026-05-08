# 图片双击查看 - 紧凑布局 + 宫格切换 实施计划

## 需求概述
1. 图片双击查看弹窗需要更紧凑，去掉不必要的空隙，让图片占比最大化
2. 增加两宫格和四宫格切换按钮
3. 两宫格：左边图片固定，右边切换
4. 四宫格：左上角固定（当前行为）
5. 图片保持比例，不超过容器大小

## 涉及文件
- `src/components/compare-dialog/index.vue` — 主要UI和样式修改
- `src/composables/useCompareDialog.ts` — 增加gridMode状态和分页逻辑调整
- `src/App.vue` — 传递gridMode相关props和事件

## 实施步骤

### 步骤1：在useCompareDialog中增加gridMode状态

- 新增 `gridMode` ref，默认值 `'4'`（保持当前行为）
- 新增 computed `childPageSize`：根据gridMode返回每页显示的子图数量
  - 2宫格：每页1张子图
  - 4宫格：每页3张子图
- 修改 `maxChildPage` computed：使用 `childPageSize` 替代硬编码的3
- 修改 `goPrevFrame` 中的分页计算：使用 `childPageSize`
- 修改 `prevCompareTree` 中的分页计算：使用 `childPageSize`
- 导出 `gridMode`

### 步骤2：在CompareDialog组件中增加gridMode prop和切换按钮

- 新增prop `gridMode`
- 新增emit `update:gridMode`
- 在 `.compare-controls` 中增加两宫格/四宫格切换按钮组（使用el-radio-group）
- 根据gridMode调整模板：
  - **4宫格**：保持现有 `v-for="i in 3"` 和 `compareChildPage * 3 + i - 1` 逻辑
  - **2宫格**：左侧固定图片，右侧 `v-for="i in 1"` 即1张子图，使用 `compareChildPage * 1 + i - 1`

### 步骤3：CSS紧凑化 + 动态Grid布局

- `.compare-grid` 根据gridMode动态设置grid模板：
  - 4宫格：`grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;`
  - 2宫格：`grid-template-columns: 1fr 1fr; grid-template-rows: 1fr;`
- 紧凑化改动：
  - `gap: 10px` → `gap: 2px`
  - `.compare-cell` 的 `border: 1px solid #e4e7ed; border-radius: 8px;` → `border: 1px solid #e4e7ed; border-radius: 2px;`
  - `.compare-label` 的 `padding: 4px 0` → `padding: 2px 0`
  - `.compare-controls` 的 `padding: 8px 0` → `padding: 4px 0`，`gap: 16px` → `gap: 8px`
  - `.el-dialog__body` 的 `height: calc(100% - 54px)` → 调整为更紧凑
- 图片显示优化：确保 `object-fit: contain` 生效，图片不超出容器

### 步骤4：在App.vue中连接gridMode

- 从useCompareDialog解构出 `gridMode`
- 将 `gridMode` 作为prop传给CompareDialog
- 监听 `update:gridMode` 事件更新gridMode

### 步骤5：2宫格模式下的分页逻辑适配

2宫格和4宫格的分页逻辑一致，只是每页子图数量不同：
- 切换gridMode时需要重置 `compareChildPage` 为0（因为每页数量变了）
- 在watch gridMode变化时重置分页

## 关键设计决策

1. **gridMode默认为4**：保持向后兼容，用户打开弹窗默认看到4宫格
2. **gridMode状态放在useCompareDialog中**：和现有分页逻辑在一起，方便计算pageSize
3. **切换宫格时重置分页**：因为每页展示数量变了，需要回到第一页
4. **两宫格布局**：单行两列，左侧固定图片，右侧一张切换图片，视觉上对比更清晰
5. **4宫格布局**：双行两列，左上角固定，其余3格展示子图（和现有行为一致）
