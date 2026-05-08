import type { TreeNode, TreeRoot } from '@/types'

function findNodeInTree(node: TreeNode, targetId: string): TreeNode | null {
  if (node.selfId === targetId || node.id === targetId) {
    return node
  }
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const found = findNodeInTree(child, targetId)
      if (found) {
        return found
      }
    }
  }
  return null
}

export { findNodeInTree as findTreeNodeById }

export function findNodeById(trees: TreeRoot[], targetId: string): TreeNode | null {
  for (const root of trees) {
    const found = findNodeInTree(root.tree, targetId)
    if (found) {
      return found
    }
  }
  return null
}

export function getNodeImageUrl(trees: TreeRoot[], targetId: string): string {
  const node = findNodeById(trees, targetId)
  return node ? node.selfUrl : ''
}

export interface CompareFrame {
  parent: TreeNode
  children: TreeNode[]
  position: string
}

export function buildPositionMap(root: TreeNode): Map<TreeNode, string> {
  const map = new Map<TreeNode, string>()
  const queue: { node: TreeNode; depth: number }[] = []
  let levelCounter = new Map<number, number>()
  queue.push({ node: root, depth: 1 })
  while (queue.length > 0) {
    const { node, depth } = queue.shift()!
    const count = (levelCounter.get(depth) || 0) + 1
    levelCounter.set(depth, count)
    map.set(node, `${depth}.${count}`)
    if (node.children) {
      node.children.forEach((child) => {
        queue.push({ node: child, depth: depth + 1 })
      })
    }
  }
  return map
}

export function buildTreeCompareFrames(startNode: TreeNode, treeRoot: TreeRoot): CompareFrame[] {
  const positionMap = buildPositionMap(treeRoot.tree)
  const frames: CompareFrame[] = []
  const queue: TreeNode[] = [startNode]
  while (queue.length > 0) {
    const node = queue.shift()!
    frames.push({
      parent: node,
      children: node.children ? [...node.children] : [],
      position: positionMap.get(node) || '?',
    })
    if (node.children) {
      node.children.forEach((child) => queue.push(child))
    }
  }
  return frames
}
