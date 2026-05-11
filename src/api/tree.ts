import request from '@/utils/request'
import type { NodeResponse, TreeResponse, SearchHistoryResponse } from '@/types'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export interface ReviewRecord {
  selfId: string
  reviewResult: '一致' | '不一致'
}

export interface BatchReviewRequest {
  records: ReviewRecord[]
}

export function getAllRootIds(): Promise<TreeResponse> {
  return request.get<TreeResponse, TreeResponse>('/get_all_root_ids')
}

export function getTreeByRootId(rootId: string): Promise<NodeResponse> {
  return request.get<NodeResponse, NodeResponse>('/get_tree_by_root_id', { params: { rootId } })
}

export function batchReview(data: BatchReviewRequest): Promise<any> {
  return request.post('/batch_review', data)
}

export interface UpdateRootNameRequest {
  rootId: string
  name: string
}

export function updateRootName(data: UpdateRootNameRequest): Promise<any> {
  return request.post('/update_root_name', data)
}

export interface SearchHistoryRequest {
  selfId: string
  top_k?: number
}

export function searchHistory(data: SearchHistoryRequest): Promise<SearchHistoryResponse> {
  return request.post<SearchHistoryResponse, SearchHistoryResponse>('/search_history', data)
}

export interface MoveTreeNodeRequest {
  selfId: string
  parentId: string | null
  score: number
}


export function moveTreeNode(data: MoveTreeNodeRequest): Promise<void> {
  return request.post<void, void>('/move_tree_node', data)
}
