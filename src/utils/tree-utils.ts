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
