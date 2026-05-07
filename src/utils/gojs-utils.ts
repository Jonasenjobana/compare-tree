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
 */
export const getLineColor = (score: number, isModified: boolean): string => {
  if (isModified) return '#E6A23C'
  if (score > 0.8) return '#67C23A'
  return '#909399'
}
