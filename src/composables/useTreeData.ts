import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Node, TreeRoot, TreeNode } from '@/types'
import { getAllTrees } from '@/api/tree'

export function useTreeData() {
  const allTrees = ref<TreeRoot[]>([])
  const nodes = ref<Node[]>([])
  const viewMode = ref<'tree' | 'timeline'>('tree')
  const timelineOrder = ref<'asc' | 'desc'>('asc')
  const searchKeyword = ref('')
  const selectedTreeId = ref('')
  const displayMode = ref<'global' | 'paged'>('global')
  const pagedTreeIndex = ref(0)

  function convertTreeNodeToList(node: TreeNode, list: Node[]) {
    const convertedNode: Node = {
      id: node.selfId,
      parentId: node.parentId,
      selfId: node.selfId,
      score: node.score,
      matchDate: node.matchDate,
      imageUrl: node.selfUrl,
      selfUrl: node.selfUrl,
      reviewResult: node.reviewResult,
    }
    list.push(convertedNode)

    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => convertTreeNodeToList(child, list))
    }
  }

  function convertTreeListToNodes(trees: TreeRoot[]) {
    const nodeList: Node[] = []
    if (selectedTreeId.value) {
      const targetTree = trees.find((t) => t.rootId === selectedTreeId.value)
      if (targetTree) {
        convertTreeNodeToList(targetTree.tree, nodeList)
      }
    } else {
      trees.forEach((root) => {
        convertTreeNodeToList(root.tree, nodeList)
      })
    }
    return nodeList
  }

  const filteredTrees = computed(() => {
    if (!searchKeyword.value) return allTrees.value
    return allTrees.value.filter((tree) =>
      tree.rootId.toLowerCase().includes(searchKeyword.value.toLowerCase())
    )
  })

  function refreshNodes() {
    nodes.value = convertTreeListToNodes(allTrees.value)
  }

  function changeSelectedTree(rootId: string) {
    if (displayMode.value === 'paged') {
      const idx = filteredTrees.value.findIndex((t) => t.rootId === rootId)
      if (idx !== -1) {
        pagedTreeIndex.value = idx
        selectedTreeId.value = rootId
      }
    } else {
      selectedTreeId.value = rootId === selectedTreeId.value ? '' : rootId
    }
    refreshNodes()
  }

  function switchToPagedMode() {
    displayMode.value = 'paged'
    if (!selectedTreeId.value && filteredTrees.value.length > 0) {
      pagedTreeIndex.value = 0
      selectedTreeId.value = filteredTrees.value[0].rootId
    } else if (selectedTreeId.value) {
      const idx = filteredTrees.value.findIndex((t) => t.rootId === selectedTreeId.value)
      if (idx !== -1) pagedTreeIndex.value = idx
    }
    refreshNodes()
  }

  function switchToGlobalMode() {
    displayMode.value = 'global'
    selectedTreeId.value = ''
    pagedTreeIndex.value = 0
    refreshNodes()
  }

  function onDisplayModeChange(val: 'global' | 'paged') {
    if (val === 'paged') switchToPagedMode()
    else switchToGlobalMode()
  }

  function goToPrevTree() {
    if (pagedTreeIndex.value > 0) {
      pagedTreeIndex.value--
      selectedTreeId.value = filteredTrees.value[pagedTreeIndex.value].rootId
      refreshNodes()
    }
  }

  function goToNextTree() {
    if (pagedTreeIndex.value < filteredTrees.value.length - 1) {
      pagedTreeIndex.value++
      selectedTreeId.value = filteredTrees.value[pagedTreeIndex.value].rootId
      refreshNodes()
    }
  }

  const hasPrevTree = computed(() => pagedTreeIndex.value > 0)
  const hasNextTree = computed(() => pagedTreeIndex.value < filteredTrees.value.length - 1)

  async function loadTreeData() {
    try {
      const res = await getAllTrees()
      allTrees.value = res.trees
      nodes.value = convertTreeListToNodes(res.trees)
    } catch (error) {
      console.error('获取树数据失败:', error)
      ElMessage.error('获取树数据失败，请检查接口是否正常')
    }
  }

  return {
    allTrees,
    nodes,
    viewMode,
    timelineOrder,
    searchKeyword,
    selectedTreeId,
    displayMode,
    pagedTreeIndex,
    filteredTrees,
    hasPrevTree,
    hasNextTree,
    changeSelectedTree,
    onDisplayModeChange,
    goToPrevTree,
    goToNextTree,
    loadTreeData,
    refreshNodes,
  }
}
