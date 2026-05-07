# GoJsTree 组件 GoJS 使用方式说明文档
对应文件路径：`g:\project26\picture-tree\src\components\gojs-tree\index.vue`

---
## 1. 基础初始化部分（对应代码行23-41）
### 1.1 Diagram 实例化
```typescript
diagram = $(go.Diagram, diagramRef.value, {
  allowZoom: true,
  allowMove: true,
  allowSelect: true,
  'undoManager.isEnabled': true,
  'panningTool.isEnabled': true,
  layout: $(go.TreeLayout, { /* 布局配置 */ }),
  'toolManager.hoverDelay': 100,
  'toolManager.mouseWheelBehavior': go.ToolManager.WheelZoom
})
```
| 配置项 | 作用说明 |
|--------|----------|
| `allowZoom: true` | 允许画布缩放 |
| `allowMove: true` | 允许节点被移动 |
| `allowSelect: true` | 允许节点被选中 |
| `undoManager.isEnabled: true` | 启用撤销/重做功能（支持Ctrl+Z/Ctrl+Y操作） |
| `panningTool.isEnabled: true` | 启用画布拖拽平移功能（按住鼠标左键可拖动整个画布） |
| `toolManager.hoverDelay: 100` | 鼠标悬停触发事件的延迟时间（单位ms） |
| `toolManager.mouseWheelBehavior: go.ToolManager.WheelZoom` | 设置鼠标滚轮行为为直接缩放画布，无需按Ctrl键 |

---
## 2. 树布局配置（对应代码行34-38）
```typescript
layout: $(go.TreeLayout, {
  angle: 90,
  layerSpacing: 80,
  nodeSpacing: 40
})
```
| 配置项 | 作用说明 |
|--------|----------|
| `angle: 90` | 树的生长方向：90度表示垂直向下生长（父节点在上，子节点在下），0度表示水平向右生长 |
| `layerSpacing: 80` | 不同层级节点之间的垂直间距（单位px） |
| `nodeSpacing: 40` | 同一层级相邻节点之间的水平间距（单位px） |

---
## 3. 节点模板配置（对应代码行43-84）
```typescript
diagram.nodeTemplate = $(go.Node, 'Auto',
  { selectionAdorned: true, selectionAdornmentTemplate: /* 选中样式模板 */ },
  new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
  $(go.Shape, 'RoundedRectangle', { /* 节点外框配置 */ }),
  $(go.Panel, 'Vertical',
    $(go.Picture, { /* 缩略图配置 */ }, new go.Binding('source', 'imageUrl')),
    $(go.TextBlock, { /* 节点文本配置 */ }, new go.Binding('text', 'selfId'))
  ),
  { click: () => {}, doubleClick: () => {} }
)
```
### 3.1 选中样式配置
```typescript
selectionAdornmentTemplate: $(go.Adornment, 'Auto',
  $(go.Shape, 'RoundedRectangle', { fill: null, stroke: '#409EFF', strokeWidth: 3 }),
  $(go.Placeholder)
)
```
- 作用：自定义节点被选中时的高亮样式，这里是3px的蓝色圆角边框
- `Placeholder` 表示占位符，会自动适配节点的大小

### 3.2 位置绑定
```typescript
new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify)
```
- 作用：将节点的位置信息和数据的`loc`字段双向绑定，`go.Point.parse/stringify`用于坐标格式转换
- `makeTwoWay`表示双向绑定，节点位置改变会同步更新到数据

### 3.3 节点外框
```typescript
$(go.Shape, 'RoundedRectangle', {
  fill: '#fff',
  stroke: '#DCDFE6',
  strokeWidth: 1,
  desiredSize: new go.Size(80, 100)
})
```
- 作用：定义节点的外框样式，圆角矩形，固定大小80×100px，白色填充，灰色边框

### 3.4 内容面板
```typescript
$(go.Panel, 'Vertical',
  $(go.Picture, { desiredSize: new go.Size(72, 40.5), background: '#F5F7FA' }, new go.Binding('source', 'imageUrl')),
  $(go.TextBlock, { margin: 4, font: '12px sans-serif', textAlign: 'center' }, new go.Binding('text', 'selfId'))
)
```
- `Vertical` 面板：表示内部元素垂直排列
- `Picture`：展示节点缩略图，固定16:9比例72×40.5px，绑定`imageUrl`字段
- `TextBlock`：展示节点ID，居中显示，文本超出自动省略

### 3.5 交互事件
```typescript
click: (e: go.InputEvent, obj: go.GraphObject) => {
  const node = obj.part as go.Node
  emit('nodeSelect', node.data as Node)
},
doubleClick: (e: go.InputEvent, obj: go.GraphObject) => {
  const node = obj.part as go.Node
  emit('nodeDoubleClick', node.data as Node)
}
```
- 单击事件：抛出`nodeSelect`事件，传递当前选中节点数据
- 双击事件：抛出`nodeDoubleClick`事件，传递当前双击节点数据

---
## 4. 连线模板配置（对应代码行86-106）
```typescript
diagram.linkTemplate = $(go.Link,
  { routing: go.Link.Orthogonal, corner: 5 },
  $(go.Shape, { strokeWidth: 2 }, 
    new go.Binding('strokeWidth', 'score', getLineWidth),
    new go.Binding('stroke', '', (data) => getLineColor(data.score, data.isModified))
  ),
  $(go.Shape, { fromArrow: 'Standard', scale: 0.8 }, 
    new go.Binding('fill', '', (data) => getLineColor(data.score, data.isModified))
  ),
  $(go.TextBlock, { segmentFraction: 0.03, segmentOffset: new go.Point(0, -6) },
    new go.Binding('text', 'score', (s) => s.toFixed(2))
  )
)
```
| 配置项 | 作用说明 |
|--------|----------|
| `routing: go.Link.Orthogonal` | 连线样式为直角折线（不是直线） |
| `corner: 5` | 直角拐角的圆角半径为5px |
| `strokeWidth`绑定 | 根据`score`分数动态计算连线粗细，范围1px~4px |
| `stroke`绑定 | 根据`score`和`isModified`动态计算连线颜色：默认灰色/ >0.8绿色/ 手动修改黄色 |
| `fromArrow: 'Standard'` | 箭头显示在连线的`from`端（父节点方向），符合子节点指向父节点的需求 |
| `segmentFraction: 0.03` | 分数文本显示在连线的3%位置（靠近子节点的起始处） |
| `segmentOffset: new go.Point(0, -6)` | 分数文本向上偏移6px，避免遮挡连线 |

---
## 5. 数据加载和模型配置（对应代码行109-129）
```typescript
const model = new go.GraphLinksModel({
  nodeKeyProperty: 'id',
  linkFromKeyProperty: 'from',
  linkToKeyProperty: 'to',
  nodeDataArray: props.nodes,
  linkDataArray: linkDataArray
})
diagram.model = model
```
| 配置项 | 作用说明 |
|--------|----------|
| `nodeKeyProperty: 'id'` | 指定节点数据的唯一标识字段为`id`（默认是`key`） |
| `linkFromKeyProperty: 'from'` | 指定连线数据的起始节点ID字段为`from` |
| `linkToKeyProperty: 'to'` | 指定连线数据的目标节点ID字段为`to` |
| `nodeDataArray` | 节点数据数组 |
| `linkDataArray` | 连线数据数组，通过过滤有父节点的节点生成，每个节点对应一条连线 |

---
## 6. 暴露API（对应代码行140-142）
```typescript
defineExpose({
  getDiagram: () => diagram
})
```
- 作用：向父组件暴露原始Diagram实例，方便父组件进行自定义操作（比如重置视图、导出图片等）