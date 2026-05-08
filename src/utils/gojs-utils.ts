/**
 * 将相似度分数转换为连线宽度，范围1px-4px
 * @param score 相似度分数，0-1
 */
export const getLineWidth = (score: number): number => {
  return Math.max(1, Math.min(4, Math.round(score * 3) + 1))
}

/**
 * 根据相似度和是否手动修改获取连线颜色
 * @param score 相似度分数
 * @param isModified 是否手动修改过关联
 * @param reviewResult 人工复核结果
 */
export const getLineColor = (score: number, isModified: boolean, reviewResult?: string): string => {
  if (reviewResult === '一致') return '#67C23A'
  if (reviewResult === '不一致') return '#ff0000'
  if (isModified) return '#E6A23C'
  if (score > 0.8) return '#b3e19d'
  return '#909399'
}

/**
 * 获取连线标签
 * @param score 相似度分数
 * @param reviewResult 人工复核结果
 */
export const getEdgeLabel = (score: number, reviewResult?: string): string => {
  if (reviewResult === '不一致') return '✘'
  return score.toFixed(2)
}
