import request from '@/utils/request'
import type { TreeResponse } from '@/types'
import { getMockAllTrees } from '@/mock/tree-mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export interface ReviewRecord {
  selfId: string
  reviewResult: '一致' | '不一致'
}

export interface BatchReviewRequest {
  records: ReviewRecord[]
}

export function getAllTrees(): Promise<TreeResponse> {
  if (USE_MOCK) {
    return getMockAllTrees()
  }
  return request.get<TreeResponse, TreeResponse>('/get_all_trees')
}

export function batchReview(data: BatchReviewRequest): Promise<any> {
  return request.post('/batch_review', data)
}
