import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { Node, TreeNode, TreeRoot } from '@/types'
import { findTreeNodeById, buildTreeCompareFrames, type CompareFrame } from '@/utils/tree-utils'
import { getTreeByRootId, updateRootName } from '@/api/tree'
import { ElMessage } from 'element-plus'

export type { CompareFrame }

export function useCompareDialog(
  allTrees: Ref<TreeRoot[]>,
  viewMode: Ref<'tree' | 'timeline'>,
  loadTreeByRootId: (rootId: string) => Promise<TreeRoot | null>
) {
  const compareVisible = ref(false)
  const compareRootImage = ref('')
  const compareRootLabel = ref('')
  const compareTimelineNodes = ref<Node[]>([])
  const comparePage = ref(0)
  const compareTreeIndex = ref(0)
  // 扁平化后的树节点 保证遍历顺序
  const compareTreeFrames = ref<CompareFrame[]>([])
  // 帧
  const compareFrameIndex = ref(0)
  // 页
  const compareChildPage = ref(0)

  const gridMode = ref<'2' | '4'>('2')
  const childPageSize = computed(() => gridMode.value === '2' ? 1 : 3)
  const singlePreviewImage = ref('')
  const singlePreviewLabel = ref('')
  const isSingleNodePreview = computed(() => viewMode.value === 'tree' && !currentFrame.value)

  const compareTreeName = ref('')
  const compareTreeRootId = computed(() => {
    const tree = allTrees.value[compareTreeIndex.value]
    return tree?.rootId || ''
  })

  async function updateTreeName(newName: string) {
    const rootId = compareTreeRootId.value
    if (!rootId) return
    try {
      await updateRootName({ rootId, name: newName })
      const tree = allTrees.value.find((t) => t.rootId === rootId)
      if (tree) {
        tree.treeName = newName
      }
      compareTreeName.value = newName
      ElMessage.success('树名称修改成功')
    } catch (error) {
      console.error('修改树名称失败:', error)
      ElMessage.error('修改树名称失败')
    }
  }

  watch(gridMode, () => {
    compareChildPage.value = 0
    comparePage.value = 0
  })

  function collectTreeNodesFlat(node: TreeNode, list: Node[]): void {
    list.push({
      id: node.selfId,
      rootId: node.rootId,
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

  function loadCompareTreeFromData(tree: TreeRoot, index: number) {
    if (!tree.tree) return
    compareTreeIndex.value = index
    compareTreeName.value = tree.treeName || ''
    compareRootImage.value = tree.tree.selfUrl
    compareRootLabel.value = `${tree.tree.selfId} ${tree.tree.matchDate}`
    const allNodes: Node[] = []
    collectTreeNodesFlat(tree.tree, allNodes)
    allNodes.sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    compareTimelineNodes.value = allNodes.filter((n) => n.selfId !== tree.tree!.selfId)
    comparePage.value = 0
  }

  async function loadCompareTreeByIndex(index: number) {
    const rootInfo = allTrees.value[index]
    if (!rootInfo) return
    try {
      const res = await loadTreeByRootId(rootInfo.rootId)
      loadCompareTreeFromData(res!, index)
    } catch (error) {
      console.error('获取比对树详情失败:', error)
    }
  }

  function prevCompareGroup() {
    if (compareTreeIndex.value > 0) {
      loadCompareTreeByIndex(compareTreeIndex.value - 1)
    }
  }

  function nextCompareGroup() {
    if (compareTreeIndex.value < allTrees.value.length - 1) {
      loadCompareTreeByIndex(compareTreeIndex.value + 1)
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
  /**
   * 切换到下一棵树
   * 调取接口
   * TODO 同步到画布antx6
   */
  async function nextCompareTree() {
    if (compareTreeIndex.value < allTrees.value.length - 1) {
      const nextIdx = compareTreeIndex.value + 1
      const rootInfo = allTrees.value[nextIdx]
      if (!rootInfo) return
      try {
        const res = await loadTreeByRootId(rootInfo.rootId)
        const tree = res!
        if (!tree.tree || tree.tree.children.length === 0) {
          compareTreeIndex.value = nextIdx
          compareTreeFrames.value = []
          compareFrameIndex.value = 0
          compareChildPage.value = 0
          singlePreviewImage.value = tree.rootUrl
          singlePreviewLabel.value = tree.rootId
          return
        }
        const frames = buildTreeCompareFrames(tree.tree, tree)
        if (frames.length > 0) {
          compareTreeIndex.value = nextIdx
          compareTreeFrames.value = frames
          compareFrameIndex.value = 0
          compareChildPage.value = 0
        }
      } catch (error) {
        console.error('获取下一棵树详情失败:', error)
      }
    }
  }

  async function prevCompareTree() {
    if (compareTreeIndex.value > 0) {
      const prevIdx = compareTreeIndex.value - 1
      const rootInfo = allTrees.value[prevIdx]
      if (!rootInfo) return
      try {
        const res = await loadTreeByRootId(rootInfo.rootId)
        const tree = res!
        if (!tree.tree || tree.tree.children.length === 0) {
          compareTreeIndex.value = prevIdx
          compareTreeFrames.value = []
          compareFrameIndex.value = 0
          compareChildPage.value = 0
          singlePreviewImage.value = tree.rootUrl
          singlePreviewLabel.value = tree.rootId
          return
        }
        const frames = buildTreeCompareFrames(tree.tree, tree)
        if (frames.length > 0) {
          compareTreeIndex.value = prevIdx
          compareTreeFrames.value = frames
          compareFrameIndex.value = frames.length - 1
          const lastFrame = frames[frames.length - 1]!
          compareChildPage.value = Math.max(0, Math.ceil(lastFrame.children.length / childPageSize.value) - 1)
        }
      } catch (error) {
        console.error('获取上一棵树详情失败:', error)
      }
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
    singlePreviewImage.value = ''
    singlePreviewLabel.value = ''
    compareTreeName.value = ''
  }

  async function openCompareForNode(node: Node, childId?: string) {
    const idx = allTrees.value.findIndex((t) => t.rootId == node.rootId)
    if (idx === -1) return

    try {
      const rootInfo = allTrees.value[idx]!
      const res = await loadTreeByRootId(rootInfo.rootId)
      const tree = res!
      compareTreeName.value = tree.treeName || ''
      if (!tree.tree) {
        compareTreeFrames.value = []
        compareFrameIndex.value = 0
        compareChildPage.value = 0
        singlePreviewImage.value = node.selfUrl || node.imageUrl
        singlePreviewLabel.value = node.selfId
        compareVisible.value = true
        return
      }

      if (viewMode.value === 'timeline') {
        loadCompareTreeFromData(tree, idx)
      } else {
        const startNode = findTreeNodeById(tree.tree, node.id)
        if (!startNode) return
        compareTreeFrames.value = buildTreeCompareFrames(startNode, tree)
        compareFrameIndex.value = compareTreeFrames.value.findIndex((f) => f.parent.selfId === node.selfId);
        compareChildPage.value = 0;
        if (!currentFrame.value) {
          // 没有子节点 直接预览
          compareFrameIndex.value = -1
          compareChildPage.value = 0
          singlePreviewImage.value = node.selfUrl || node.imageUrl
          singlePreviewLabel.value = node.selfId
        }
      }
      compareVisible.value = true
      if (childId) {
        const prevFrame = compareTreeFrames.value[compareFrameIndex.value]!
        compareChildPage.value = Math.min(maxChildPage.value - 1, Math.ceil(prevFrame.children.findIndex((c) => c.selfId === childId) / childPageSize.value));
      }
    } catch (error) {
      console.error('打开比对失败:', error)
    }
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
    isSingleNodePreview,
    singlePreviewImage,
    singlePreviewLabel,
    compareTreeName,
    compareTreeRootId,
    updateTreeName,
  }
}
