# AntV X6 API 使用文档

> 本文档整理自 `src/components/antv-x6-tree/index.vue`，记录项目中使用的 AntV X6 v3.1.7 及 @antv/layout 相关 API。

---

## 一、Graph 构造函数

```ts
const graph = new Graph({
  container: HTMLElement,   // 画布容器 DOM
  grid: number,             // 网格大小
  autoResize: boolean,      // 自动跟随容器resize
  panning: {                // 画布平移
    enabled: boolean,
    eventTypes: ("leftMouseDown" | "mouseWheel")[],
  },
  mousewheel: {             // 鼠标滚轮缩放
    enabled: boolean,
    factor: number,         // 缩放因子
    minScale: number,       // 最小缩放
    maxScale: number,       // 最大缩放
    modifiers: string[],    // 修饰键
  },
  background: {             // 背景配置
    color: string,
  },
  interacting: {            // 交互控制
    nodeMovable: boolean,
    edgeMovable: boolean,
    edgeLabelMovable: boolean,
    arrowheadMovable: boolean,
    vertexMovable: boolean,
    vertexAddable: boolean,
    vertexDeletable: boolean,
    useEdgeTools: boolean,
  },
});
```

---

## 二、Graph 静态方法

### `Graph.registerNode(type, config, overwrite)`

注册自定义节点类型。

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | `string` | 节点类型名称，如 `"picture-card"` |
| `config.inherit` | `string` | 继承的基础形状，如 `"rect"` |
| `config.width` | `number` | 默认宽度 |
| `config.height` | `number` | 默认高度 |
| `config.attrs` | `object` | SVG 属性配置，key 为 selector |
| `config.markup` | `Array` | SVG 子元素定义，`{ tagName, selector }` |
| `config.ports` | `object` | 端口配置（用于边连接） |
| `overwrite` | `boolean` | 是否覆盖已注册的同名类型 |

**attrs 中常用属性**：

| Selector | 属性 | 说明 |
|----------|------|------|
| `body` | `fill`, `stroke`, `strokeWidth`, `rx`, `ry` | 矩形主体样式 |
| `image` | `xlink:href`, `width`, `height`, `x`, `y`, `preserveAspectRatio` | SVG image 元素 |
| `imageBg` | `fill`, `stroke`, `width`, `height`, `x`, `y`, `rx`, `ry` | 图片占位背景矩形 |
| `label` | `text`, `fontSize`, `fill`, `refX`, `refY`, `textAnchor`, `textVerticalAnchor`, `maxWidth`, `textOverflow` | 标签文字 |
| `timeLabel` | 同 label | 时间标签文字 |

**markup 结构**：

```ts
markup: [
  { tagName: "rect", selector: "body" },
  { tagName: "rect", selector: "imageBg" },
  { tagName: "image", selector: "image" },
  { tagName: "text", selector: "label" },
  { tagName: "text", selector: "timeLabel" },
]
```

**ports 配置**：

```ts
ports: {
  groups: {
    in: { position: "left", attrs: { circle: { r: 0, magnet: true, ... } } },
    out: { position: "right", attrs: { circle: { r: 0, magnet: true, ... } } },
  },
  items: [
    { group: "in", id: "in" },
    { group: "out", id: "out" },
  ],
}
```

---

## 三、Graph 实例方法

### 视口与缩放

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `graph.zoom()` | `number` | 获取当前缩放比例（1 = 100%） |
| `graph.scale(value)` | `void` | 设置绝对缩放比例 |
| `graph.translate()` | `{ tx: number, ty: number }` | 获取当前画布平移偏移（屏幕像素） |
| `graph.centerContent()` | `void` | 将画布内容居中显示在视口 |
| `graph.centerCell(cell)` | `void` | 将指定节点居中显示在视口 |

**坐标变换公式**：

```
screenX = canvasX * scale + tx
screenY = canvasY * scale + ty
```

**视口可见区域计算**（反推画布坐标）：

```ts
const scale = graph.zoom();
const { tx, ty } = graph.translate();
const viewLeft   = -tx / scale;
const viewRight  = (-tx + containerWidth) / scale;
const viewTop    = -ty / scale;
const viewBottom = (-ty + containerHeight) / scale;
```

### 数据操作

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `graph.fromJSON(data)` | `void` | 从 JSON 数据加载整个画布（清空后重建） |
| `graph.getCells()` | `Cell[]` | 获取画布上所有元素（节点+边） |
| `graph.getCellById(id)` | `Cell \| null` | 根据 ID 获取元素 |
| `graph.getConnectedEdges(node)` | `Edge[]` | 获取与节点相连的所有边 |

### 插件

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `graph.use(plugin)` | `void` | 注册插件（如 Selection） |
| `graph.getPlugin(name)` | `Plugin \| null` | 获取已注册的插件实例 |

### 生命周期

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `graph.dispose()` | `void` | 销毁画布，释放资源 |

---

## 四、Cell / Node 实例方法

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `cell.isNode()` | `boolean` | 判断是否为节点 |
| `cell.getData()` | `T` | 获取节点绑定的数据 |
| `cell.getBBox()` | `Rectangle` | 获取节点包围盒（`{ x, y, width, height }`） |
| `cell.attr(path, value?)` | `any` | 获取或设置 SVG 属性，如 `cell.attr("image/xlink:href", url)` |
| `cell.toFront()` | `void` | 将元素置顶（z-index 最高） |

---

## 五、Selection 插件

```ts
import { Selection } from "@antv/x6";

const selection = new Selection({
  enabled: true,
  multiple: false,
  rubberband: false,
  showNodeSelectionBox: true,
  pointerEvents: "none",
  movable: false,
});

graph.use(selection);
```

| 方法 | 说明 |
|------|------|
| `selection.reset(cell)` | 重置选区，选中指定节点 |

| 属性 | 说明 |
|------|------|
| `enabled` | 是否启用 |
| `multiple` | 是否多选 |
| `rubberband` | 是否启用框选 |
| `showNodeSelectionBox` | 是否显示选中框 |
| `pointerEvents` | 选中框的 pointer-events |
| `movable` | 选中后是否可拖动 |

---

## 六、事件监听

### 绑定方式

```ts
graph.on(eventName, callback);
```

### 使用的事件

| 事件名 | 回调参数 | 说明 |
|--------|----------|------|
| `node:click` | `{ node }` | 节点单击 |
| `node:dblclick` | `{ node }` | 节点双击 |
| `node:mouseenter` | `{ node }` | 鼠标进入节点 |
| `scale` | `{ sx, sy }` | 画布缩放变化 |
| `translate` | — | 画布平移变化 |
| `blank:mousewheel` | — | 空白区域滚轮 |
| `blank:mouseup` | — | 空白区域鼠标松开 |

---

## 七、边（Edge）配置

```ts
{
  id: string,
  source: { cell: string, port: string },   // 源节点ID和端口
  target: { cell: string, port: string },   // 目标节点ID和端口
  vertices: { x: number; y: number }[],     // 路径拐点
  connector: { name: "rounded", args: { radius: number } },  // 连线样式
  attrs: {
    line: {
      stroke: string,           // 线条颜色
      strokeWidth: number,      // 线条宽度
      sourceMarker: {           // 起始箭头
        name: "classic",
        size: number,
        stroke: string,
        fill: string,
      },
      targetMarker: null,       // 无终止箭头
    },
  },
  labels: [{                    // 边标签（如分数）
    position: {
      distance: number,
      offset: { x: number },
    },
    attrs: {
      label: { text, fill, fontSize },
      rect: { fill, stroke, rx, ry },
    },
  }],
}
```

---

## 八、@antv/layout - AntVDagreLayout

```ts
import { AntVDagreLayout } from "@antv/layout";

const layout = new AntVDagreLayout({
  rankdir: "LR",            // 布局方向：LR=左到右
  ranker: "tight-tree",     // 排序算法
  nodesep: 40,              // 同层节点间距
  ranksep: 80,              // 层间间距
  nodeSize: [width, height],// 节点尺寸
});

const result = await layout.execute({
  nodes: [{ id, data }],
  edges: [{ id, source, target, data }],
  getAllNodes() { return nodes; },
  getAllEdges() { return edges; },
  mergeNodeData() {},
  mergeEdgeData() {},
});
```

**返回值**：`result.nodes` 中每个节点的 `data.x` / `data.y` 为布局后的中心坐标。

---

## 九、图片懒加载机制

利用视口计算实现图片按需加载：

1. 初始化时所有节点的 `image/xlink:href` 设置为 `PLACEHOLDER_IMAGE`（1x1 透明 GIF data URI）
2. 通过 `graph.zoom()` + `graph.translate()` + 容器尺寸计算当前可见区域（画布坐标）
3. 缓冲区 `LAZY_BUFFER / scale` 保证缩放无关的屏幕空间缓冲
4. 遍历 `graph.getCells()`，对进入可见区域的节点设置真实图片 URL
5. 已加载节点记录在 `loadedNodeIds` Set 中避免重复处理
6. 监听 `scale`、`translate`、`blank:mousewheel`、`blank:mouseup` 事件触发检测
7. 初始化后延迟 500ms 执行，确保节点 bbox 稳定后再替换图片
