# 树列表增加序号及序号/名称过滤

## 需求
1. 树列表每项前面增加序号（基于 `allTrees` 原始数组的索引，不随过滤变化）
2. 搜索框支持输入序号或名称过滤，输入序号时直接跳到对应树

## 实现步骤

### 1. `useTreeData.ts` — 扩展 `filteredTrees` 计算属性

当前只支持 `rootId` 匹配，改为：
- 如果输入的是纯数字 → 按序号匹配（`allTrees` 中的 1-based 索引）
- 否则 → 按 `rootId` 和 `treeName` 模糊匹配（和当前一样，但增加 treeName）

### 2. `App.vue` — 模板中增加序号显示

在 `v-for` 中用 `allTrees.findIndex(t => t.rootId === tree.rootId) + 1` 作为序号，显示在树项前面。格式如：`1. DNS1001(根节点ID)`。

### 3. `App.vue` — 更新搜索框 placeholder

改为 `搜索序号或名称`

## 数据流

```
用户输入 "3"  → filteredTrees 只返回 allTrees[2]（第3棵）
用户输入 "dns" → filteredTrees 返回 rootId 或 treeName 包含 "dns" 的项
列表显示: "1. xxx" "2. xxx" ...序号基于 allTrees 原始位置
```
