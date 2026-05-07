<template>
  <div ref="diagramRef" class="g6-diagram"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from "vue";
import G6, { type TreeGraph } from "@antv/g6";
import type { Node, LinkData } from "@/types";
import { getLineWidth, getLineColor } from "@/utils/gojs-utils";

const props = defineProps<{
  nodes: Node[];
}>();

const emit = defineEmits<{
  nodeSelect: [node: Node];
  nodeDoubleClick: [node: Node];
  scaleChange: [scale: number];
}>();

const diagramRef = ref<HTMLDivElement | null>(null);
let graph: TreeGraph | null = null;
const currentScale = ref(1);

// 注册自定义节点
G6.registerNode(
  "picture-card-node",
  {
    draw(cfg: any, group: any) {
      const { imageUrl, selfId } = cfg;
      // 外层圆角矩形
      const rect = group.addShape("rect", {
        attrs: {
          x: -40,
          y: -50,
          width: 80,
          height: 100,
          radius: 8,
          fill: "#fff",
          stroke: "#DCDFE6",
          lineWidth: 1,
        },
        name: "node-rect",
      });
      // 图片区域
      const imgShape = group.addShape("image", {
        attrs: {
          x: -36,
          y: -46,
          width: 72,
          height: 40.5,
          img: imageUrl || '',
          fill: "#F5F7FA",
          crossOrigin: "anonymous",
        },
        name: "node-image",
      });
      // 图片加载失败容错
      imgShape.on('error', () => {
        imgShape.attr('img', '');
      });
      // 文本
      group.addShape("text", {
        attrs: {
          x: 0,
          y: 10,
          text: selfId,
          fontSize: 12,
          textAlign: "center",
          textBaseline: "top",
          fill: "#333",
          wordWrap: true,
          wordWrapWidth: 70,
          maxLines: 2,
          ellipsis: true,
        },
        name: "node-text",
      });
      return rect;
    },
    getAnchorPoints() {
      return [
        [0.5, 0], // 上
        [1, 0.5], // 右
        [0.5, 1], // 下
        [0, 0.5], // 左
      ];
    },
    setState(name?: string, value?: string | boolean, item?: any) {
      if (!item || !name || typeof value !== 'boolean') return;
      const group = item.getContainer();
      const shape = group.get("children")[0];
      if (name === "selected" && value) {
        shape.attr("stroke", "#409EFF");
        shape.attr("lineWidth", 3);
      } else {
        shape.attr("stroke", "#DCDFE6");
        shape.attr("lineWidth", 1);
      }
    },
  },
  "single-node"
);

// 注册自定义边
G6.registerEdge(
  "score-edge",
  {
    draw(cfg: any, group: any) {
      const { score = 0, isModified = false } = cfg;
      const validScore = typeof score === 'number' ? score : 0;
      const lineWidth = getLineWidth(validScore);
      const lineColor = getLineColor(validScore, isModified);
      // 调用父类方法生成路径
      const path = (this as any).drawShape(cfg, group);
      path.attr({
        stroke: lineColor,
        lineWidth,
        startArrow: {
          path: G6.Arrow.triangle(8, 10, 8),
          fill: lineColor,
          stroke: lineColor,
        },
      });
      // 得分文本
      group.addShape("text", {
        attrs: {
          text: validScore.toFixed(2),
          fontSize: 12,
          fill: "#333",
          background: {
            fill: "#fff",
            padding: [2, 4, 2, 4],
          },
        },
        name: "edge-label",
        mode: "relative",
        refX: "100%",
        refY: -8,
      });
      return path;
    },
    update(cfg: any, item: any) {
      const group = item.getContainer();
      const pathShape = group.get("children")[0];
      const labelShape = group.get("children")[1];
      const { score = 0, isModified = false } = cfg;
      const validScore = typeof score === 'number' ? score : 0;
      const lineWidth = getLineWidth(validScore);
      const lineColor = getLineColor(validScore, isModified);
      pathShape.attr({
        stroke: lineColor,
        lineWidth,
        startArrow: {
          path: G6.Arrow.triangle(8, 10, 8),
          fill: lineColor,
          stroke: lineColor,
        },
      });
      labelShape.attr("text", validScore.toFixed(2));
    },
  },
  "polyline"
);

const initGraph = () => {
  if (!diagramRef.value) return;
  const width = diagramRef.value.offsetWidth;
  const height = diagramRef.value.offsetHeight;

  graph = new G6.TreeGraph({
    container: diagramRef.value,
    width,
    height,
    modes: {
      default: ["drag-canvas", "zoom-canvas", "drag-node", "undo-redo"],
    },
    layout: {
      type: "compactBox",
      direction: "LR",
      getHeight: () => 100,
      getWidth: () => 80,
      getVGap: () => 40,
      getHGap: () => 80,
    },
    defaultNode: {
      type: "picture-card-node",
    },
    defaultEdge: {
      type: "score-edge",
      style: {
        radius: 5,
        offset: 25,
      },
    },
    fitView: false,
    fitViewPadding: 200,
  });

  // 监听缩放变化
  graph.on("viewportchange", (e) => {
    if (e.action === "zoom" && graph) {
      currentScale.value = graph.getZoom();
      emit("scaleChange", currentScale.value);
    }
  });

  // 节点点击事件
  graph.on("node:click", (e) => {
    const node = e.item;
    if (!node || !graph) return;
    const model = node.getModel() as unknown as Node;
    // 清除之前选中的节点
    const selectedNodes = graph.findAllByState("node", "selected");
    selectedNodes.forEach((n) => graph!.setItemState(n, "selected", false));
    // 设置当前节点选中
    graph.setItemState(node, "selected", true);
    emit("nodeSelect", model);
  });

  // 节点双击事件
  graph.on("node:dblclick", (e) => {
    const node = e.item;
    if (!node) return;
    const model = node.getModel() as unknown as Node;
    emit("nodeDoubleClick", model);
  });

  // 节点hover事件
  graph.on("node:mouseenter", (e) => {
    const node = e.item;
    if (!node) return;
    const edges = (node as any).getEdges();
    edges.forEach((edge: any) => {
      edge.toFront();
    });
  });
};

const loadData = () => {
  if (!graph || !props.nodes.length) return;
  // 转换数据格式为G6树结构
  const nodeMap = new Map<string, Node & { children?: Node[], visible?: boolean }>();
  props.nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });
  const roots: (Node & { children?: Node[] })[] = [];
  props.nodes.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children?.push(nodeMap.get(node.id)!);
    } else {
      roots.push(nodeMap.get(node.id)!);
    }
  });
  // 处理多根节点情况，G6树图需要单根，使用虚拟根节点
  graph.data({
    id: "virtual-root",
    visible: false,
    style: {
      opacity: 0,
    },
    edgeStyle: {
      opacity: 0,
    },
    children: roots.length ? roots : props.nodes,
  });
  graph.render();
};

// 定位到指定节点
const locateNode = (nodeId: string) => {
  if (!graph) return;
  const node = graph.findById(nodeId);
  if (node) {
    // 清除其他选中
    const selectedNodes = graph.findAllByState("node", "selected");
    selectedNodes.forEach((n) => graph!.setItemState(n, "selected", false));
    // 选中当前节点
    graph.setItemState(node, "selected", true);
    // 居中并放大
    graph.focusItem(nodeId, true, {
      easing: "easeCubic",
      duration: 300,
    });
    graph.zoomTo(1.5);
  }
};

// 对外暴露方法
defineExpose({
  getDiagram: () => graph,
  locateNode,
  getCurrentScale: () => currentScale.value,
});

onMounted(() => {
  initGraph();
  loadData();
  // 监听窗口大小变化
  window.addEventListener("resize", () => {
    if (!graph || !diagramRef.value) return;
    graph.changeSize(diagramRef.value.offsetWidth, diagramRef.value.offsetHeight);
  });
});

watch(
  () => props.nodes,
  () => {
    loadData();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  graph?.destroy();
});
</script>

<style scoped>
.g6-diagram {
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  position: relative;
}
</style>