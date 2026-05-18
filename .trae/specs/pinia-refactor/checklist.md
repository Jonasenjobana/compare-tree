# 数据流重构 Checklist

## 功能完整性
- [x] 树列表加载和渲染正常 — treeStore.loadTreeData 保持不变
- [x] 搜索框支持序号/名称过滤 — treeStore.filteredTrees 逻辑不变
- [x] 节点数筛选功能正常 — treeStore.maxNodeCount 逻辑不变
- [x] 树列表翻页（上一颗树/下一颗树）正常 — treeStore.goToPrevTree/goToNextTree
- [x] 键盘左右键翻树正常 — handleGlobalKeydown 调用 treeStore
- [x] 预览面板显示选中节点信息正常 — PreviewPanel 从 treeStore 读取
- [x] 双击节点打开比对弹窗正常 — compareStore.openCompareForNode
- [x] 点击边打开比对弹窗并定位到子节点正常 — compareStore.openCompareForNode
- [x] 时间轴模式比对弹窗正常 — compareStore 支持两种模式
- [x] 比对弹窗 2宫格/4宫格切换正常 — compareStore.gridMode
- [x] 比对弹窗翻页/翻帧/翻树正常 — compareStore actions
- [x] 比对弹窗内键盘左右键翻页正常 — compareStore.handleCompareKeydown
- [x] 比对弹窗审核提交正常 — emit submit-review 到 App.vue
- [x] 比对弹窗编辑树名称正常 — compareStore.updateTreeName
- [x] 右键菜单"相似图片匹配"正常 — App.vue 保留 handleNodeContextMenu
- [x] 搜索历史弹窗打开和匹配图展示正常 — 保持原样
- [x] 搜索历史弹窗翻页正常 — 保持原样
- [x] 搜索历史弹窗选中/取消选中匹配图正常 — 保持原样
- [x] 确认移动/确认移除（根节点）正常 — 保持原样
- [x] 移动成功后列表刷新和跳转正常 — App.vue handleMoveSuccess
- [x] 图片查看器双击正常 — v-viewer 保持不变

## 代码质量
- [x] App.vue 代码行数显著减少 — 移除 composable 解构，~40 个 props/emits 绑定
- [x] CompareDialog props 数量 ≤ 4 — 实际 1 个 (modelValue)
- [x] CompareDialog emits 数量 ≤ 6 — 实际 3 个
- [x] SearchHistoryDialog props 数量保持 — 6 个（瞬时数据合理）
- [x] 所有 store 关键逻辑有注释
- [x] 无 any 类型滥用
- [x] `npx vue-tsc --noEmit` 通过，零错误
- [x] 旧 composable 文件由用户保留
