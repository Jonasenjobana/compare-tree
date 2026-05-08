import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Node, TreeRoot, TreeNode } from '@/types'
import { getAllRootIds, getTreeByRootId } from '@/api/tree'

export function useTreeData() {
  const allTrees = ref<TreeRoot[]>([])
  const currentTree = ref<TreeRoot | null>(null)
  const nodes = ref<Node[]>([])
  const viewMode = ref<'tree' | 'timeline'>('tree')
  const timelineOrder = ref<'asc' | 'desc'>('asc')
  const searchKeyword = ref('')
  const selectedTreeId = ref('')
  const pagedTreeIndex = ref(0)
  const treeLoading = ref(false)

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

  function buildNodesFromTree(tree: TreeRoot) {
    if (!tree.tree) return
    const nodeList: Node[] = []
    convertTreeNodeToList(tree.tree, nodeList)
    nodes.value = nodeList
  }

  const filteredTrees = computed(() => {
    if (!searchKeyword.value) return allTrees.value
    return allTrees.value.filter((tree) =>
      tree.rootId.toLowerCase().includes(searchKeyword.value.toLowerCase())
    )
  })

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

  const hasPrevTree = computed(() => pagedTreeIndex.value > 0)
  const hasNextTree = computed(() => pagedTreeIndex.value < filteredTrees.value.length - 1)

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
    selectedTreeId,
    pagedTreeIndex,
    filteredTrees,
    hasPrevTree,
    hasNextTree,
    treeLoading,
    changeSelectedTree,
    goToPrevTree,
    goToNextTree,
    loadTreeData,
    refreshCurrentTree,
  }
}
