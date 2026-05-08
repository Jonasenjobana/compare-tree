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

  function changeSelectedTree(rootId: string) {
    selectedTreeId.value = rootId === selectedTreeId.value ? '' : rootId
    const convertedNodes = convertTreeListToNodes(allTrees.value)
    nodes.value = convertedNodes
  }

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
    filteredTrees,
    changeSelectedTree,
    loadTreeData,
  }
}
