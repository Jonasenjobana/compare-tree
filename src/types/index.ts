export interface TreeNode {
  id: string
  selfId: string
  selfUrl: string
  parentId: string
  parentUrl: string
  rootId: string
  rootUrl: string
  matchDate: string
  score: number
  children: TreeNode[]

  manualReview: string
  reviewResult: string
  intelligentRecommend: string
}

export interface TreeRoot {
  rootId: string
  rootUrl: string
  tree?: TreeNode
  treeName: string
  maxMatchDate: string
  nodeCount: number
}

export interface TreeResponse {
  success: boolean
  count: number
  roots: TreeRoot[]
}

export interface NodeResponse {
  tree: TreeRoot
  success: boolean
}

export interface Node {
  id: string
  parentId: string
  selfId: string
  score: number
  matchDate: string
  imageUrl: string
  selfUrl: string
  rootId: string
  isModified?: boolean
  reviewResult?: string
}

export interface LinkData {
  from: string
  to: string
  score: number
  isModified: boolean
  reviewResult?: string
}

export interface SearchHistoryItem {
  name: string
  score: number
  url: string
}

export interface SearchHistoryResponse {
  success: boolean
  selfId: string
  history_size: number
  top_k: number
  results: SearchHistoryItem[]
}
