import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { Node, TreeNode, TreeRoot } from '@/types'
import { findTreeNodeById, buildTreeCompareFrames, type CompareFrame } from '@/utils/tree-utils'

export type { CompareFrame }

export function useCompareDialog(
  allTrees: Ref<TreeRoot[]>,
  viewMode: Ref<'tree' | 'timeline'>
) {
  const compareVisible = ref(false)
  const compareRootImage = ref('')
  const compareRootLabel = ref('')
  const compareTimelineNodes = ref<Node[]>([])
  const comparePage = ref(0)
  const compareTreeIndex = ref(0)

  const compareTreeFrames = ref<CompareFrame[]>([])
  const compareFrameIndex = ref(0)
  const compareChildPage = ref(0)

  const gridMode = ref<'2' | '4'>('4')
  const childPageSize = computed(() => gridMode.value === '2' ? 1 : 3)

  watch(gridMode, () => {
    compareChildPage.value = 0
    comparePage.value = 0
  })

  function collectTreeNodesFlat(node: TreeNode, list: Node[]): void {
    list.push({
      id: node.selfId,
      parentId: node.parentId,
      selfId: node.selfId,
      score: node.score,
      matchDate: node.matchDate,
      imageUrl: node.selfUrl,
      selfUrl: node.selfUrl,
    })
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => collectTreeNodesFlat(child, list))
    }
  }

  function loadCompareTree(index: number) {
    const tree = allTrees.value[index]
    if (!tree) return
    compareTreeIndex.value = index
    compareRootImage.value = tree.tree.selfUrl
    compareRootLabel.value = `${tree.tree.selfId} ${tree.tree.matchDate}`
    const allNodes: Node[] = []
    collectTreeNodesFlat(tree.tree, allNodes)
    allNodes.sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    compareTimelineNodes.value = allNodes.filter((n) => n.selfId !== tree.tree.selfId)
    comparePage.value = 0
  }

  function prevCompareGroup() {
    if (compareTreeIndex.value > 0) {
      loadCompareTree(compareTreeIndex.value - 1)
    }
  }

  function nextCompareGroup() {
    if (compareTreeIndex.value < allTrees.value.length - 1) {
      loadCompareTree(compareTreeIndex.value + 1)
    }
  }

  const maxComparePage = computed(() => Math.max(1, Math.ceil(compareTimelineNodes.value.length / childPageSize.value)))
  const isCompareFirstPage = computed(() => comparePage.value === 0)
  const isCompareLastPage = computed(() => comparePage.value >= maxComparePage.value - 1)
  const hasPrevCompareTrees = computed(() => compareTreeIndex.value > 0)
  const hasMoreCompareTrees = computed(() => compareTreeIndex.value < allTrees.value.length - 1)

  const currentFrame = computed(() => compareTreeFrames.value[compareFrameIndex.value] || null)
  const maxChildPage = computed(() => {
    if (!currentFrame.value) return 1
    return Math.max(1, Math.ceil(currentFrame.value.children.length / childPageSize.value))
  })
  const isLastChildPage = computed(() => compareChildPage.value >= maxChildPage.value - 1)
  const isLastFrame = computed(() => compareFrameIndex.value >= compareTreeFrames.value.length - 1)
  const isFirstChildPage = computed(() => compareChildPage.value === 0)
  const isFirstFrame = computed(() => compareFrameIndex.value === 0)

  function treeNextPage() {
    if (!isLastChildPage.value) {
      compareChildPage.value++
    } else if (!isLastFrame.value) {
      goNextFrame()
    } else if (hasMoreCompareTrees.value) {
      nextCompareTree()
    }
  }

  function treePrevPage() {
    if (!isFirstChildPage.value) {
      compareChildPage.value--
    } else if (!isFirstFrame.value) {
      goPrevFrame()
    } else if (hasPrevCompareTrees.value) {
      prevCompareTree()
    }
  }

  function goNextFrame() {
    if (compareFrameIndex.value < compareTreeFrames.value.length - 1) {
      compareFrameIndex.value++
      compareChildPage.value = 0
    }
  }

  function goPrevFrame() {
    if (compareFrameIndex.value > 0) {
      compareFrameIndex.value--
      const prevFrame = compareTreeFrames.value[compareFrameIndex.value]!
      compareChildPage.value = Math.max(0, Math.ceil(prevFrame.children.length / childPageSize.value) - 1)
    }
  }

  function nextCompareTree() {
    if (compareTreeIndex.value < allTrees.value.length - 1) {
      const nextIdx = compareTreeIndex.value + 1
      compareTreeIndex.value = nextIdx
      const tree = allTrees.value[nextIdx]!
      compareTreeFrames.value = buildTreeCompareFrames(tree.tree, tree)
      compareFrameIndex.value = 0
      compareChildPage.value = 0
    }
  }

  function prevCompareTree() {
    if (compareTreeIndex.value > 0) {
      const prevIdx = compareTreeIndex.value - 1
      compareTreeIndex.value = prevIdx
      const tree = allTrees.value[prevIdx]!
      compareTreeFrames.value = buildTreeCompareFrames(tree.tree, tree)
      compareFrameIndex.value = compareTreeFrames.value.length - 1
      const lastFrame = compareTreeFrames.value[compareFrameIndex.value]!
      compareChildPage.value = Math.max(0, Math.ceil(lastFrame.children.length / childPageSize.value) - 1)
    }
  }

  function handleCompareKeydown(e: KeyboardEvent) {
    if (viewMode.value === 'timeline') {
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        if (comparePage.value > 0) {
          comparePage.value--
        } else if (hasPrevCompareTrees.value) {
          prevCompareGroup()
        }
      } else if (e.key === 'ArrowRight' || e.key === 'Right') {
        if (comparePage.value < maxComparePage.value - 1) {
          comparePage.value++
        } else if (hasMoreCompareTrees.value) {
          nextCompareGroup()
        }
      }
    } else {
      if (e.key === 'ArrowLeft' || e.key === 'Left') treePrevPage()
      else if (e.key === 'ArrowRight' || e.key === 'Right') treeNextPage()
    }
  }

  function onCompareClosed() {
    compareTimelineNodes.value = []
    compareTreeFrames.value = []
    compareFrameIndex.value = 0
    compareChildPage.value = 0
  }

  function openCompareForNode(node: Node) {
    const idx = allTrees.value.findIndex((t) => {
      let found = false
      function walk(n: TreeNode) {
        if (n.selfId === node.id) found = true
        if (n.children && n.children.length > 0) n.children.forEach((c) => walk(c))
      }
      walk(t.tree)
      return found
    })
    if (idx === -1) return
    compareTreeIndex.value = idx

    if (viewMode.value === 'timeline') {
      loadCompareTree(idx)
    } else {
      const tree = allTrees.value[idx]!
      const startNode = findTreeNodeById(tree.tree, node.id)
      if (!startNode) return
      compareTreeFrames.value = buildTreeCompareFrames(startNode, tree)
      compareFrameIndex.value = 0
      compareChildPage.value = 0
    }
    compareVisible.value = true
  }

  return {
    compareVisible,
    compareRootImage,
    compareRootLabel,
    compareTimelineNodes,
    comparePage,
    compareTreeIndex,
    compareTreeFrames,
    compareFrameIndex,
    compareChildPage,
    currentFrame,
    maxComparePage,
    maxChildPage,
    isCompareFirstPage,
    isCompareLastPage,
    hasPrevCompareTrees,
    hasMoreCompareTrees,
    isFirstChildPage,
    isFirstFrame,
    isLastChildPage,
    isLastFrame,
    prevCompareGroup,
    nextCompareGroup,
    goPrevFrame,
    goNextFrame,
    prevCompareTree,
    nextCompareTree,
    handleCompareKeydown,
    onCompareClosed,
    openCompareForNode,
    gridMode,
    childPageSize,
  }
}
