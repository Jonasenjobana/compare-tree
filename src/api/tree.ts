import request from '@/utils/request'
import type { NodeResponse, TreeResponse } from '@/types'
import { getMockAllRootIds, getMockTreeByRootId } from '@/mock/tree-mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export interface ReviewRecord {
  selfId: string
  reviewResult: '一致' | '不一致'
}

export interface BatchReviewRequest {
  records: ReviewRecord[]
}

export function getAllRootIds(): Promise<TreeResponse> {
  if (USE_MOCK) {
    return getMockAllRootIds()
  }
  return request.get<TreeResponse, TreeResponse>('/get_all_root_ids')
}

export function getTreeByRootId(rootId: string): Promise<NodeResponse> {
  if (USE_MOCK) {
    return getMockTreeByRootId(rootId)
  }
  return request.get<NodeResponse, NodeResponse>('/get_tree_by_root_id', { params: { rootId } })
}

export function batchReview(data: BatchReviewRequest): Promise<any> {
  return request.post('/batch_review', data)
}
