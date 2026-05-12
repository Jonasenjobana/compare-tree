import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Node, TreeRoot, TreeNode } from '@/types'
import { getAllRootIds, getTreeByRootId } from '@/api/tree'

function convertTreeNodeToList(node: TreeNode, list: Node[]) {
  const convertedNode: Node = {
    id: node.selfId,
    parentId: node.parentId,
    selfId: node.selfId,
    score: node.score,
    matchDate: node.matchDate,
    imageUrl: node.selfUrl,
    rootId: node.rootId,
    selfUrl: node.selfUrl,
    reviewResult: node.reviewResult,
  }
  list.push(convertedNode)
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => convertTreeNodeToList(child, list))
  }
}

type CompareOp = 'le' | 'lt'

interface NodeCountFilter {
  min: number | undefined
  max: number | undefined
  minOp: CompareOp
  maxOp: CompareOp
}

export const useTreeStore = defineStore('tree', () => {
  const allTrees = ref<TreeRoot[]>([])
  const currentTree = ref<TreeRoot | null>(null)
  const nodes = ref<Node[]>([])
  const viewMode = ref<'tree' | 'timeline'>('tree')
  const timelineOrder = ref<'asc' | 'desc'>('asc')
  const searchKeyword = ref('')
  const nodeCountFilter = ref<NodeCountFilter>({
    min: undefined,
    max: undefined,
    minOp: 'le',
    maxOp: 'le',
  })
  const filterCompleted = ref<'all' | 'completed' | 'pending'>('all')
  const selectedTreeId = ref('')
  const pagedTreeIndex = ref(0)
  const treeLoading = ref(false)
  const focusNodeId = ref('')
  const selectedNode = ref<Node | null>(null)

  const filteredTrees = computed(() => {
    let result = allTrees.value
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase()
      const isIndex = /^\d+$/.test(kw)
      if (isIndex) {
        const idx = parseInt(kw, 10) - 1
        if (idx >= 0 && idx < allTrees.value.length) {
          result = [allTrees.value[idx]!]
        } else {
          result = []
        }
      } else {
        result = allTrees.value.filter((tree) =>
          tree.rootId.toLowerCase().includes(kw) ||
          (tree.treeName && tree.treeName.toLowerCase().includes(kw))
        )
      }
    }
    const { min, max, minOp, maxOp } = nodeCountFilter.value
    if (min !== undefined || max !== undefined) {
      result = result.filter((tree) => {
        const count = tree.nodeCount
        const minOk = min === undefined || (minOp === 'le' ? count >= min : count > min)
        const maxOk = max === undefined || (maxOp === 'le' ? count <= max : count < max)
        return minOk && maxOk
      })
    }
    if (filterCompleted.value !== 'all') {
      result = result.filter((tree) =>
        filterCompleted.value === 'completed'
          ? tree.isCompleted
          : !tree.isCompleted
      )
    }
    return result
  })

  const hasPrevTree = computed(() => pagedTreeIndex.value > 0)
  const hasNextTree = computed(() => pagedTreeIndex.value < filteredTrees.value.length - 1)

  const nodeCountFilterActive = computed(() => {
    const f = nodeCountFilter.value
    return f.min !== undefined || f.max !== undefined
  })

  const nodeCountFilterError = computed(() => {
    const { min, max, minOp, maxOp } = nodeCountFilter.value
    if (min === undefined || max === undefined) return null
    const effectiveMin = minOp === 'lt' ? min + 1 : min
    const effectiveMax = maxOp === 'lt' ? max - 1 : max
    if (effectiveMin > effectiveMax) {
      return `范围无效：${minOp === 'lt' ? '<' : '≤'}${min} 与 ${maxOp === 'lt' ? '<' : '≤'}${max} 无交集`
    }
    return null
  })

  function getTreeIndex(rootId: string): number {
    return allTrees.value.findIndex((t) => t.rootId === rootId)
  }

  function setSelectedNode(node: Node) {
    selectedNode.value = node
    focusNodeId.value = node.id
  }

  function buildNodesFromTree(tree: TreeRoot) {
    if (!tree.tree) return
    const nodeList: Node[] = []
    convertTreeNodeToList(tree.tree, nodeList)
    nodes.value = nodeList
  }

  async function loadTreeByRootId(rootId: string): Promise<TreeRoot | null> {
    treeLoading.value = true
    try {
      const res = await getTreeByRootId(rootId)
      currentTree.value = res.tree
      buildNodesFromTree(res.tree)
      return res.tree
    } catch (error) {
      console.error('获取树详情失败:', error)
      ElMessage.error('获取树详情失败')
      return null
    } finally {
      treeLoading.value = false
    }
  }

  async function changeSelectedTree(rootId: string) {
    const idx = filteredTrees.value.findIndex((t) => t.rootId === rootId)
    if (idx !== -1) {
      pagedTreeIndex.value = idx
      selectedTreeId.value = rootId
    }
    await loadTreeByRootId(rootId)
  }

  async function goToPrevTree() {
    if (pagedTreeIndex.value > 0) {
      pagedTreeIndex.value--
      const rootId = filteredTrees.value[pagedTreeIndex.value]!.rootId
      selectedTreeId.value = rootId
      await loadTreeByRootId(rootId)
    }
  }

  async function goToNextTree() {
    if (pagedTreeIndex.value < filteredTrees.value.length - 1) {
      pagedTreeIndex.value++
      const rootId = filteredTrees.value[pagedTreeIndex.value]!.rootId
      selectedTreeId.value = rootId
      await loadTreeByRootId(rootId)
    }
  }

  async function refreshCurrentTree() {
    if (selectedTreeId.value) {
      await loadTreeByRootId(selectedTreeId.value)
    }
  }

  async function refreshAllRootIds() {
    try {
      const res = await getAllRootIds()
      allTrees.value = res.roots
    } catch (error) {
      console.error('刷新根节点列表失败:', error)
    }
  }

  async function loadTreeData() {
    try {
      const res = await getAllRootIds()
      allTrees.value = res.roots
      if (res.roots.length > 0) {
        pagedTreeIndex.value = 0
        selectedTreeId.value = res.roots[0]!.rootId
        await loadTreeByRootId(res.roots[0]!.rootId)
      }
    } catch (error) {
      console.error('获取树数据失败:', error)
      ElMessage.error('获取树数据失败，请检查接口是否正常')
    }
  }

  return {
    allTrees,
    currentTree,
    nodes,
    viewMode,
    timelineOrder,
    searchKeyword,
    nodeCountFilter,
    nodeCountFilterActive,
    nodeCountFilterError,
    filterCompleted,
    selectedTreeId,
    pagedTreeIndex,
    treeLoading,
    focusNodeId,
    selectedNode,
    filteredTrees,
    hasPrevTree,
    hasNextTree,
    getTreeIndex,
    setSelectedNode,
    changeSelectedTree,
    goToPrevTree,
    goToNextTree,
    loadTreeData,
    refreshCurrentTree,
    refreshAllRootIds,
    loadTreeByRootId,
  }
})
