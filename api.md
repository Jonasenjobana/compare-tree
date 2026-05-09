# 接口文档
URL: http://192.168.1.155:5889
## 搜索历史接口
描述：根据节点ID查询10个最相似的图片
API: /search_history
METHOD: post
Params:
```json
{
    "selfId": "DNS1833_1",
    "top_k": 10 // 返回10个最相似
}
```
JSON:
```json
{
    "success": true,
    "selfId": "DNS1833_1",
    "history_size": 12873,
    "top_k": 10,
    "results": [
        {
            "name": "DNS1001_3_v1.jpg",
            "score": 0.962341,
            "url": "http://192.168.1.30:9528/upload/original_snaps/DNS1001_3_v1.jpg"
        },
        {
            "name": "DNS0822_7_v2.jpg",
            "score": 0.948112,
            "url": "http://192.168.1.30:9528/upload/original_snaps/DNS0822_7_v2.jpg"
        },
        {
            "name": "DNS5511_2_v1.jpg",
            "score": 0.931552,
            "url": "http://192.168.1.30:9528/upload/original_snaps/DNS5511_2_v1.jpg"
        }
    ]
}
```
## 移动节点接口
描述： 移动节点到新的位置
API: /move_tree_node
METHOD: post
Params:
```json
{
    "selfId": "DNS1833_1",
    "parentId": "DNS1833_2", // 新的父节点ID
    "score": 80, // 搜索历史接口的score
    "selfId": "DNS1833_1",
    "rootId": "DNS1000_2"
}
```