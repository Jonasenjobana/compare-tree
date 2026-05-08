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
  tree: TreeNode
}

export interface TreeResponse {
  success: boolean
  count: number
  trees: TreeRoot[]
}

export interface Node {
  id: string
  parentId: string
  selfId: string
  score: number
  matchDate: string
  imageUrl: string
  selfUrl: string
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
