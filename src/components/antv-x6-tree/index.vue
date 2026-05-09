<template>
  <div ref="containerRef" class="x6-diagram">
  </div>
   <div v-if="loading" class="tree-loading-overlay">
      <div class="tree-loading-spinner"></div>
      <span class="tree-loading-text">加载中...</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from "vue";
import { Graph, Selection } from "@antv/x6";
import { AntVDagreLayout } from "@antv/layout";
import type { Node, LinkData, TreeRoot } from "@/types";
import { getLineWidth, getLineColor, getEdgeLabel } from "@/utils/gojs-utils";

interface NodeData extends Node {
  _isLabel?: boolean;
}

const props = defineProps<{
  nodes: Node[];
  focusNodeId?: string;
  viewMode: "tree" | "timeline";
  trees: TreeRoot[];
  timelineOrder: "asc" | "desc";
  loading?: boolean;
}>();

const emit = defineEmits<{
  nodeSelect: [node: Node];
  nodeDoubleClick: [node: Node];
  scaleChange: [scale: number];
  edgeClick: [node: Node];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let graph: Graph | null = null;
const currentScale = ref(1);
let loadDataVersion = 0;
let loadedNodeIds = new Set<string>();
let contentBounds = { x: 0, y: 0, width: 0, height: 0 };
let isClamping = false;

const NODE_WIDTH = 80;
const NODE_HEIGHT = 100;
const ROOT_GAP_Y = 120;
const TIMELINE_GAP_X = 140;
const TIMELINE_ROW_GAP_Y = 180;
const LAZY_BUFFER = 30;

const PLACEHOLDER_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAoCAYAAABdGbwdAAAAkklEQVR4AezSQQqAMBAEwSX//7P+YPsiIlK5NoRQmXM5q8AZZxUAtPLMAAIUApEtCFAIRLYgQCEQ2YIAhUBkCwIUApEt6HGguPBv2YLiRwEBCoHIFgQoBCJbEKAQiGxBgEIgsgUBCoHIFgQoBCK/saB4wrczoPgfQIBCILIFAQqByBYEKAQiWxCgEIhsQYBCIPINAAD//0wL2+UAAAAGSURBVAMAnD4fQNSHsuYAAAAASUVORK5CYII=";

function createDagreLayout() {
  return new AntVDagreLayout({
    rankdir: "LR",
    ranker: "tight-tree",
    nodesep: 40,
    ranksep: 80,
    nodeSize: [NODE_WIDTH, NODE_HEIGHT],
  } as any);
}

function splitTrees(nodes: Node[]): Node[][] {
  const nodeMap = new Map<string, Node>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const childrenMap = new Map<string, string[]>();
  const rootIds: string[] = [];

  nodes.forEach((n) => {
    if (!n.parentId || !nodeMap.has(n.parentId)) {
      rootIds.push(n.id);
    } else {
      const list = childrenMap.get(n.parentId) || [];
      list.push(n.id);
      childrenMap.set(n.parentId, list);
    }
  });

  const visited = new Set<string>();
  const trees: Node[][] = [];

  rootIds.forEach((rootId) => {
    const list: Node[] = [];
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = nodeMap.get(id);
      if (node) list.push(node);
      const children = childrenMap.get(id) || [];
      children.forEach((cid) => {
        if (!visited.has(cid)) queue.push(cid);
      });
    }
    if (list.length > 0) trees.push(list);
  });

  return trees;
}

async function layoutTree(treeNodes: Node[]): Promise<{ nodes: any[]; edges: any[]; minY: number; maxY: number }> {
  const nodeDataMap = new Map<string, Node>();
  treeNodes.forEach((n) => nodeDataMap.set(n.id, n));

  const linkDataArray: LinkData[] = treeNodes
    .filter((n) => n.parentId && nodeDataMap.has(n.parentId))
    .map((n) => ({
      from: n.parentId,
      to: n.id,
      score: n.score,
      isModified: n.isModified || false,
      reviewResult: n.reviewResult,
    }));

  const layoutNodes = treeNodes.map((n) => ({
    id: n.id,
    data: { ...n },
  }));

  const layoutEdges = linkDataArray.map((l) => ({
    id: `${l.from}-${l.to}`,
    source: l.from,
    target: l.to,
    data: { score: l.score, isModified: l.isModified },
  }));

  const layoutInput = {
    nodes: layoutNodes,
    edges: layoutEdges,
    getAllNodes() {
      return layoutNodes;
    },
    getAllEdges() {
      return layoutEdges;
    },
    mergeNodeData() {},
    mergeEdgeData() {},
  };

  const dagreLayout = createDagreLayout();
  const layoutResult = await dagreLayout.execute(layoutInput as any);
  let minY = Infinity;
  let maxY = -Infinity;

  const positionedNodes: any[] = [];
  layoutResult.nodes.forEach((ln: any) => {
    const layoutX = ln.data?.x ?? 0;
    const layoutY = ln.data?.y ?? 0;
    minY = Math.min(minY, layoutY - NODE_HEIGHT / 2);
    maxY = Math.max(maxY, layoutY + NODE_HEIGHT / 2);
    const nodeData = nodeDataMap.get(ln.id);
    positionedNodes.push({
      id: ln.id,
      shape: "picture-card",
      x: layoutX - NODE_WIDTH / 2,
      y: layoutY - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: nodeData ? { ...nodeData } : undefined,
      attrs: {
        image: {
          "xlink:href": PLACEHOLDER_IMAGE,
        },
        label: {
          text: nodeData?.selfId || "",
        },
      },
    });
  });

  const nodePositionMap = new Map<string, { x: number; y: number }>();
  positionedNodes.forEach((n: any) => {
    nodePositionMap.set(n.id, { x: n.x, y: n.y });
  });

  const positionedEdges: any[] = [];
  linkDataArray.forEach((l) => {
    const score = l.score ?? 0;
    const isModified = l.isModified ?? false;
    const reviewResult = l.reviewResult;
    const lineColor = getLineColor(score, isModified, reviewResult);
    const lineWidth = getLineWidth(score);
    const edgeLabel = getEdgeLabel(score, reviewResult);
    const edgeId = `${l.from}-${l.to}`;

    const parentPos = nodePositionMap.get(l.from);
    const childPos = nodePositionMap.get(l.to);

    let vertices: { x: number; y: number }[] | undefined;
    if (parentPos && childPos) {
      const startX = parentPos.x + NODE_WIDTH;
      const startY = parentPos.y + NODE_HEIGHT / 2;
      const endX = childPos.x;
      const endY = childPos.y + NODE_HEIGHT / 2;
      const midX = (startX + endX) / 2;
      vertices = [
        { x: midX, y: startY },
        { x: midX, y: endY },
      ];
    }

    const edgeConfig: any = {
      id: edgeId,
      source: { cell: l.from, port: "out" },
      target: { cell: l.to, port: "in" },
      vertices,
      connector: { name: "rounded", args: { radius: 6 } },
      attrs: {
        line: {
          stroke: lineColor,
          strokeWidth: lineWidth,
          sourceMarker: {
            name: "classic",
            size: 10,
            stroke: lineColor,
            fill: lineColor,
          },
          targetMarker: null,
        },
      },
      labels: [
        {
          position: {
            distance: 1,
            offset: {
              x: -14,
            },
          },
          attrs: {
            label: {
              text: edgeLabel,
              fill: reviewResult === '不一致' ? "#ff0000" : reviewResult === '一致' ? "#67c23a" : "#333",
              fontSize: 12,
            },
            rect: {
              fill: "#fff",
              stroke: "none",
              rx: 2,
              ry: 2,
            },
          },
        },
      ],
    };

    positionedEdges.push(edgeConfig);
  });

  return { nodes: positionedNodes, edges: positionedEdges, minY, maxY };
}

function layoutTimeline(nodes: Node[], trees: TreeRoot[], order: "asc" | "desc"): { nodes: any[]; edges: any[]; minY: number; maxY: number } {
  const nodeMap = new Map<string, Node>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const treeGroups: { rootId: string; nodes: Node[] }[] = [];
  trees.forEach((tree) => {
    const groupNodes: Node[] = [];
    function collectTreeNodes(n: any) {
      const flatNode = nodeMap.get(n.selfId);
      if (flatNode) groupNodes.push(flatNode);
      if (n.children && n.children.length > 0) {
        n.children.forEach((child: any) => collectTreeNodes(child));
      }
    }
    collectTreeNodes(tree.tree);
    if (groupNodes.length > 0) {
      groupNodes.sort((a, b) => a.matchDate.localeCompare(b.matchDate));
      if (order === "desc") groupNodes.reverse();
      treeGroups.push({ rootId: tree.rootId, nodes: groupNodes });
    }
  });

  const allCellNodes: any[] = [];
  let currentY = 0;
  let minY = Infinity;
  let maxY = -Infinity;

  treeGroups.forEach((group) => {
    const labelWidth = Math.max(60, group.rootId.length * 8 + 16);
    const labelHeight = 28;

    allCellNodes.push({
      id: `label-${group.rootId}`,
      shape: "rect",
      x: 0,
      y: currentY + (NODE_HEIGHT - labelHeight) / 2,
      width: labelWidth,
      height: labelHeight,
      attrs: {
        body: {
          fill: "#e8f4fd",
          stroke: "#b3d8fd",
          strokeWidth: 1,
          rx: 4,
          ry: 4,
        },
        label: {
          text: group.rootId,
          fill: "#409eff",
          fontSize: 11,
          textAnchor: "middle",
          textVerticalAnchor: "middle",
        },
      },
      data: { _isLabel: true },
    });

    group.nodes.forEach((nodeData, index) => {
      const x = labelWidth + 20 + index * TIMELINE_GAP_X;
      const y = currentY;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + NODE_HEIGHT);

      allCellNodes.push({
        id: nodeData.id,
        shape: "timeline-card",
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        data: { ...nodeData },
        attrs: {
          image: {
            "xlink:href": PLACEHOLDER_IMAGE,
          },
          label: {
            text: nodeData.selfId || "",
          },
          timeLabel: {
            text: nodeData.matchDate || "",
          },
        },
      });
    });

    currentY += NODE_HEIGHT + TIMELINE_ROW_GAP_Y - ROOT_GAP_Y;
  });

  if (minY === Infinity) minY = 0;
  if (maxY === -Infinity) maxY = 0;

  return { nodes: allCellNodes, edges: [], minY, maxY };
}

function updateVisibleImages() {
  if (!graph || !containerRef.value) return;
  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;
  const scale = graph.zoom();
  const translation = graph.translate();
  const tx = translation.tx;
  const ty = translation.ty;

  const buffer = LAZY_BUFFER / scale;
  const viewLeft = -tx / scale - buffer;
  const viewTop = -ty / scale - buffer;
  const viewRight = (-tx + containerWidth) / scale + buffer;
  const viewBottom = (-ty + containerHeight) / scale + buffer;
  const cells = graph.getCells();
  cells.forEach((cell) => {
    if (!cell.isNode()) return;
    const data = cell.getData() as NodeData | undefined;
    if (!data || data._isLabel) return;

    const nodeId = cell.id;
    if (loadedNodeIds.has(nodeId)) return;

    const bbox = cell.getBBox();
    if (
      bbox.x + bbox.width >= viewLeft &&
      bbox.x <= viewRight &&
      bbox.y + bbox.height >= viewTop &&
      bbox.y <= viewBottom
    ) {
      const imageUrl = data.imageUrl || "";
      if (imageUrl) {
        cell.attr("image/xlink:href", imageUrl);
        loadedNodeIds.add(nodeId);
      }
    }
  });
}

function updateContentBounds() {
  if (!graph) return;
  const area = graph.getContentArea();
  if (area && area.width > 0 && area.height > 0) {
    contentBounds = { x: area.x, y: area.y, width: area.width, height: area.height };
  }
}

function clampTranslation() {
  if (!graph || !containerRef.value || isClamping) return;
  if (contentBounds.width === 0 || contentBounds.height === 0) return;

  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;
  const scale = graph.zoom();
  const translation = graph.translate();

  const contentW = contentBounds.width * scale;
  const contentH = contentBounds.height * scale;

  const padding = 40;
  let tx = translation.tx;
  let ty = translation.ty;

  if (contentW + padding * 2 <= containerWidth) {
    const targetX = (containerWidth - contentW) / 2 - contentBounds.x * scale;
    tx = targetX;
  } else {
    const maxTx = padding - contentBounds.x * scale;
    const minTx = containerWidth - padding - (contentBounds.x + contentBounds.width) * scale;
    tx = Math.max(minTx, Math.min(maxTx, tx));
  }

  if (contentH + padding * 2 <= containerHeight) {
    const targetY = (containerHeight - contentH) / 2 - contentBounds.y * scale;
    ty = targetY;
  } else {
    const maxTy = padding - contentBounds.y * scale;
    const minTy = containerHeight - padding - (contentBounds.y + contentBounds.height) * scale;
    ty = Math.max(minTy, Math.min(maxTy, ty));
  }

  if (tx !== translation.tx || ty !== translation.ty) {
    isClamping = true;
    graph.translate(tx, ty);
    isClamping = false;
  }
}

const initGraph = () => {
  if (!containerRef.value) return;

  Graph.registerNode(
    "picture-card",
    {
      inherit: "rect",
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      attrs: {
        body: {
          fill: "#fff",
          stroke: "#DCDFE6",
          strokeWidth: 1,
          rx: 8,
          ry: 8,
        },
        imageBg: {
          fill: "#e0e0e0",
          stroke: "#ccc",
          strokeWidth: 1,
          width: 72,
          height: 40.5,
          x: 4,
          y: 4,
          rx: 4,
          ry: 4,
        },
        image: {
          "xlink:href": PLACEHOLDER_IMAGE,
          width: 72,
          height: 40.5,
          x: 4,
          y: 4,
          preserveAspectRatio: "xMidYMid meet",
        },
        label: {
          text: "",
          fontSize: 12,
          fill: "#333",
          refX: "50%",
          refY: 52,
          x: 0,
          y: 0,
          textAnchor: "middle",
          textVerticalAnchor: "top",
          maxWidth: 70,
          textOverflow: "ellipsis",
        },
      },
      markup: [
        { tagName: "rect", selector: "body" },
        { tagName: "rect", selector: "imageBg" },
        { tagName: "image", selector: "image" },
        { tagName: "text", selector: "label" },
      ],
      ports: {
        groups: {
          in: {
            position: "left",
            attrs: {
              circle: {
                r: 0,
                magnet: true,
                stroke: "transparent",
                fill: "transparent",
              },
            },
          },
          out: {
            position: "right",
            attrs: {
              circle: {
                r: 0,
                magnet: true,
                stroke: "transparent",
                fill: "transparent",
              },
            },
          },
        },
        items: [
          { group: "in", id: "in" },
          { group: "out", id: "out" },
        ],
      },
    },
    true,
  );

  Graph.registerNode(
    "timeline-card",
    {
      inherit: "rect",
      width: NODE_WIDTH,
      height: NODE_HEIGHT + 20,
      attrs: {
        body: {
          fill: "#fff",
          stroke: "#DCDFE6",
          strokeWidth: 1,
          rx: 8,
          ry: 8,
        },
        imageBg: {
          fill: "#e0e0e0",
          stroke: "#ccc",
          strokeWidth: 1,
          width: 72,
          height: 40.5,
          x: 4,
          y: 4,
          rx: 4,
          ry: 4,
        },
        image: {
          "xlink:href": PLACEHOLDER_IMAGE,
          width: 72,
          height: 40.5,
          x: 4,
          y: 4,
          preserveAspectRatio: "xMidYMid meet",
        },
        label: {
          text: "",
          fontSize: 12,
          fill: "#333",
          refX: "50%",
          refY: 52,
          x: 0,
          y: 0,
          textAnchor: "middle",
          textVerticalAnchor: "top",
          maxWidth: 70,
          textOverflow: "ellipsis",
        },
        timeLabel: {
          text: "",
          fontSize: 10,
          fill: "#999",
          refX: "50%",
          refY: NODE_HEIGHT + 8,
          x: 0,
          y: 0,
          textAnchor: "middle",
          textVerticalAnchor: "top",
        },
      },
      markup: [
        { tagName: "rect", selector: "body" },
        { tagName: "rect", selector: "imageBg" },
        { tagName: "image", selector: "image" },
        { tagName: "text", selector: "label" },
        { tagName: "text", selector: "timeLabel" },
      ],
    },
    true,
  );

  const selection = new Selection({
    enabled: true,
    multiple: false,
    rubberband: false,
    showNodeSelectionBox: true,
    pointerEvents: "none",
    movable: false,
  });

  graph = new Graph({
    grid: 10,
    container: containerRef.value,
    autoResize: true,
    panning: {
      enabled: true,
      eventTypes: ["leftMouseDown", "mouseWheel"],
    },
    mousewheel: {
      enabled: true,
      factor: 1.1,
      minScale: 0.2,
      maxScale: 4,
      modifiers: ["ctrl", "meta"],
    },
    background: {
      color: "#F2F7FA",
    },
    interacting: {
      nodeMovable: false,
      edgeMovable: false,
      edgeLabelMovable: false,
      arrowheadMovable: false,
      vertexMovable: false,
      vertexAddable: false,
      vertexDeletable: false,
      useEdgeTools: false,
    },
  });
  graph.use(selection);

  graph.on("node:click", ({ node }) => {
    const data = node.getData() as NodeData;
    if (data && !data._isLabel) emit("nodeSelect", data);
  });

  graph.on("node:dblclick", ({ node }) => {
    const data = node.getData() as NodeData;
    if (data && !data._isLabel) emit("nodeDoubleClick", data);
  });

  graph.on("edge:click", ({ edge }) => {
    const targetNode = edge.getTargetNode();
    if (targetNode) {
      const data = targetNode.getData() as NodeData;
      if (data && !data._isLabel) emit("edgeClick", data);
    }
  });

  graph.on("node:mouseenter", ({ node }) => {
    const edges = graph!.getConnectedEdges(node);
    edges.forEach((edge) => {
      edge.toFront();
    });
  });

  graph.on("scale", ({ sx }) => {
    currentScale.value = sx;
    emit("scaleChange", sx);
    updateVisibleImages();
    clampTranslation();
  });

  graph.on("translate", () => {
    if (isLoadInit.value) {
      updateVisibleImages();
    }
    clampTranslation();
  });

  graph.on("blank:mousewheel", () => {
    updateVisibleImages();
  });

  graph.on("blank:mouseup", () => {
    updateVisibleImages();
  });
};
const isLoadInit = ref(false)
const loadData = async () => {
  if (!graph || !props.nodes.length) return;
  isLoadInit.value = false;
  const version = ++loadDataVersion;
  loadedNodeIds.clear();

  if (props.viewMode === "timeline") {
    const result = layoutTimeline(props.nodes, props.trees, props.timelineOrder);

    if (version !== loadDataVersion) return;
    graph.fromJSON({ nodes: result.nodes, edges: result.edges });
    updateContentBounds();
    graph.centerContent();
    const focusNode = props.focusNodeId
      ? props.nodes.find((n) => n.id === props.focusNodeId)
      : null;
    const treeRoot = focusNode
      ? props.trees.find((t) => {
          let found = false;
          function walk(node: any) {
            if (node.selfId === focusNode!.id) found = true;
            if (node.children) node.children.forEach((c: any) => walk(c));
          }
          walk(t.tree);
          return found;
        })
      : props.trees[0];
    if (treeRoot) {
      locateNode(`label-${treeRoot.rootId}`);
    }
    isLoadInit.value = true;
    updateVisibleImages();
    return;
  }

  const trees = splitTrees(props.nodes);
  const treeResults = await Promise.all(trees.map((treeNodes) => layoutTree(treeNodes)));

  if (version !== loadDataVersion) return;
  const allCellNodes: any[] = [];
  const allCellEdges: any[] = [];
  let currentOffsetY = 0;

  treeResults.forEach((result) => {
    const shiftY = currentOffsetY - result.minY;

    result.nodes.forEach((node: any) => {
      allCellNodes.push({ ...node, y: node.y + shiftY });
    });

    result.edges.forEach((edge: any) => {
      const newEdge = { ...edge };
      if (newEdge.vertices) {
        newEdge.vertices = newEdge.vertices.map((v: any) => ({
          x: v.x,
          y: v.y + shiftY,
        }));
      }
      allCellEdges.push(newEdge);
    });

    currentOffsetY = result.maxY + shiftY + ROOT_GAP_Y;
  });
  graph.fromJSON({ nodes: allCellNodes, edges: allCellEdges });
  updateContentBounds();
  const targetNodeId = props.focusNodeId || trees[0]?.[0]?.id;
  if (targetNodeId && props.focusNodeId) {
    locateNode(targetNodeId);
  } else if (targetNodeId) {
    graph.centerContent();
    const cell = graph.getCellById(targetNodeId);
    if (cell && cell.isNode()) {
      graph.centerCell(cell);
    }
  }
  setTimeout(() => updateVisibleImages(), 200);
};

onMounted(() => {
  initGraph();
  loadData();
});

watch(
  () => props.nodes,
  () => {
    loadData();
  },
  { deep: true },
);

watch(
  () => props.viewMode,
  () => {
    loadData();
  },
);

watch(
  () => props.timelineOrder,
  () => {
    if (props.viewMode === "timeline") loadData();
  },
);

onBeforeUnmount(() => {
  graph?.dispose();
});

const locateNode = (nodeId: string) => {
  if (!graph) return;
  const cell = graph.getCellById(nodeId);
  if (cell && cell.isNode()) {
    const selection = graph.getPlugin("selection") as Selection;
    if (selection) {
      selection.reset(cell);
    }
    graph.centerCell(cell);
  }
};

defineExpose({
  getDiagram: () => graph,
  locateNode,
  getCurrentScale: () => currentScale.value,
});
</script>

<style scoped>
.x6-diagram {
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  position: relative;
}

.tree-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.5);
  z-index: 100;
  user-select: none;
}

.tree-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e4e7ed;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: tree-loading-spin 0.8s linear infinite;
}

@keyframes tree-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

.tree-loading-text {
  margin-top: 12px;
  font-size: 14px;
  color: #606266;
}
</style>
