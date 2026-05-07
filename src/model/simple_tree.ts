/**相似度组 */
export interface SimpleGroup {
    rootId: string
    rootUrl: string
    tree: SimpleNode
}
/**相似度组节点节点 */
export interface SimpleNode {
    id: string
    matchDate: string
    parentId: string
    parentUrl: string
    rootId: string
    rootUrl: string
    score: number
    selfId: string
    selfUrl: string
    children: SimpleNode[]
}