<template>
  <!-- <div class="hide-watermark"></div> -->
  <div ref="diagramRef" class="gojs-diagram"></div>
</template>

<script setup lang="ts">
// gojs有水印；可以源码修改去除（违反商业协议）
import { ref, onMounted, watch } from "vue";
import * as go from "gojs";
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
let diagram: go.Diagram | null = null;
// 当前缩放比例
const currentScale = ref(1);

const initDiagram = () => {
  if (!diagramRef.value) return;

  const $ = go.GraphObject.make;
  diagram = $(go.Diagram, diagramRef.value, {
    allowZoom: true,
    allowMove: true,
    allowSelect: true,
    "undoManager.isEnabled": true,
    "panningTool.isEnabled": true,
    layout: $(go.TreeLayout, {
      angle: 0,
      layerSpacing: 80,
      nodeSpacing: 40,
    }),
    "toolManager.hoverDelay": 100,
  });

  // 2. 拦截滚动，禁止滚出边界（彻底消灭死区）
  
  // 监听缩放变化
  diagram.addDiagramListener("ViewportBoundsChanged", () => {
    if (diagram) {
      currentScale.value = diagram.scale;
      emit("scaleChange", diagram.scale);
    }
  });

  // 节点模板
  diagram.nodeTemplate = $(
    go.Node,
    "Auto",
    {
      selectionAdorned: true,
      selectionAdornmentTemplate: $(go.Adornment, "Auto", $(go.Shape, "RoundedRectangle", { fill: null, stroke: "#409EFF", strokeWidth: 3 }), $(go.Placeholder)),
    },
    new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
    $(go.Shape, "RoundedRectangle", {
      fill: "#fff",
      stroke: "#DCDFE6",
      strokeWidth: 1,
      desiredSize: new go.Size(80, 100),
    }),
    $(
      go.Panel,
      "Vertical",
      { margin: 4 },
      $(
        go.Picture,
        {
          desiredSize: new go.Size(72, 40.5),
          background: "#F5F7FA",
        },
        new go.Binding("source", "imageUrl"),
      ),
      $(
        go.TextBlock,
        {
          margin: new go.Margin(4, 0, 0, 0),
          font: "12px sans-serif",
          maxSize: new go.Size(70, NaN),
          textAlign: "center",
          overflow: go.TextOverflow.Ellipsis,
        },
        new go.Binding("text", "selfId"),
      ),
    ),
    {
      click: (e: go.InputEvent, obj: go.GraphObject) => {
        const node = obj.part as go.Node;
        const data = node.data as Node;
        emit("nodeSelect", data);
      },
      doubleClick: (e: go.InputEvent, obj: go.GraphObject) => {
        const node = obj.part as go.Node;
        const data = node.data as Node;
        emit("nodeDoubleClick", data);
      },
      mouseEnter: (e: go.InputEvent, obj: go.GraphObject) => {
        const node = obj.part as go.Node;
        node.findLinksConnected().each((link) => {
          link.layerName = "Foreground";
        });
      },
      mouseLeave: (e: go.InputEvent, obj: go.GraphObject) => {
        const node = obj.part as go.Node;
        node.findLinksConnected().each((link) => {
          link.layerName = "";
        });
      },
    },
  );

  // 连线模板
  diagram.linkTemplate = $(
    go.Link,
    {
      routing: go.Link.Orthogonal,
      corner: 5,
      fromEndSegmentLength: 25,
      fromShortLength: 8,
    },
    $(
      go.Shape,
      { strokeWidth: 2 },
      new go.Binding("strokeWidth", "score", getLineWidth),
      new go.Binding("stroke", "", (data: LinkData) => getLineColor(data.score, data.isModified)),
    ),
    $(
      go.Shape,
      { fromArrow: "Backward", scale: 1.2 },
      new go.Binding("fill", "", (data: LinkData) => getLineColor(data.score, data.isModified)),
      new go.Binding("stroke", "", (data: LinkData) => getLineColor(data.score, data.isModified)),
    ),
    $(
      go.TextBlock,
      {
        segmentIndex: -1,
        segmentFraction: 1,
        font: "12px sans-serif",
        background: "#fff",
      },
      new go.Binding("text", "score", (s: number) => s.toFixed(2)),
    ),
  );
};

const loadDiagram = () => {
  if (!diagram) return;

  const linkDataArray: LinkData[] = props.nodes
    .filter((node) => node.parentId)
    .map((node) => ({
      from: node.parentId,
      to: node.id,
      score: node.score,
      isModified: node.isModified || false,
    }));

  const model = new go.GraphLinksModel({
    nodeKeyProperty: "id",
    linkFromKeyProperty: "from",
    linkToKeyProperty: "to",
    nodeDataArray: props.nodes,
    linkDataArray: linkDataArray,
  });
  diagram.model = model;
};

onMounted(() => {
  initDiagram();
  loadDiagram();
});

watch(
  () => props.nodes,
  () => {
    loadDiagram();
  },
  { deep: true },
);

// 定位到指定节点
const locateNode = (nodeId: string) => {
  if (!diagram) return;
  const node = diagram.findNodeForKey(nodeId);
  if (node) {
    diagram.select(node);
    diagram.centerRect(node.actualBounds);
    diagram.scale = 1.5;
  }
};

defineExpose({
  getDiagram: () => diagram,
  locateNode,
  getCurrentScale: () => currentScale.value,
});
</script>

<style scoped>
.gojs-diagram {
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  position: relative;
}
.gojs-diagram :deep(div:last-child) {
  display: none !important;
}
.hide-watermark {
  position: absolute;
  background-color: #f5f7fa;
  z-index: 999;
  height: 100%;
  width: 200px;
  top: 0;
  left: 0;
}
</style>
