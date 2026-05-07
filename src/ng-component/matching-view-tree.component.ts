import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { Graph, Selection } from '@antv/x6';
import { AntVDagreLayout } from '@antv/layout';

interface TreeNode {
  id: string;
  parentId: string;
  selfId: string;
  score: number;
  matchDate: string;
  imageUrl: string;
  selfUrl: string;
  isModified?: boolean;
}

interface LinkData {
  from: string;
  to: string;
  score: number;
  isModified: boolean;
}

function getLineWidth(score: number): number {
  return Math.max(1, Math.min(4, Math.round(score * 3) + 1));
}

function getLineColor(score: number, isModified: boolean): string {
  if (isModified) return '#E6A23C';
  if (score > 0.8) return '#67C23A';
  return '#909399';
}

const NODE_WIDTH = 80;
const NODE_HEIGHT = 100;
const ROOT_GAP_Y = 120;

let graphNodeRegistered = false;

@Component({
  selector: 'app-matching-view-tree',
  template: '<div #containerRef class="x6-diagram"></div>',
  styles: [
    '.x6-diagram { width: 100%; height: 100%; background: #f5f7fa; position: relative; }',
  ],
})
export class MatchingViewTreeComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('containerRef', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  @Input() nodes: TreeNode[] = [];
  @Output() nodeSelect = new EventEmitter<TreeNode>();
  @Output() nodeDoubleClick = new EventEmitter<TreeNode>();
  @Output() scaleChange = new EventEmitter<number>();

  private graph: Graph | null = null;
  private currentScale = 1;
  private loadDataVersion = 0;

  ngAfterViewInit(): void {
    this.initGraph();
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes'] && !changes['nodes'].firstChange) {
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.graph?.dispose();
    this.graph = null;
  }

  getDiagram(): Graph | null {
    return this.graph;
  }

  getCurrentScale(): number {
    return this.currentScale;
  }

  locateNode(nodeId: string): void {
    if (!this.graph) return;
    const cell = this.graph.getCellById(nodeId);
    if (cell && cell.isNode()) {
      const selection = this.graph.getPlugin('selection') as Selection;
      if (selection) {
        selection.reset(cell);
      }
      this.graph.centerCell(cell);
      this.graph.scale(1.5);
    }
  }

  private initGraph(): void {
    if (!this.containerRef?.nativeElement) return;

    if (!graphNodeRegistered) {
      Graph.registerNode(
        'picture-card',
        {
          inherit: 'rect',
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          attrs: {
            body: {
              fill: '#fff',
              stroke: '#DCDFE6',
              strokeWidth: 1,
              rx: 8,
              ry: 8,
            },
            image: {
              'xlink:href': '',
              width: 72,
              height: 40.5,
              refX: 4,
              refY: 4,
              preserveAspectRatio: 'xMidYMid meet',
            },
            label: {
              text: '',
              fontSize: 12,
              fill: '#333',
              refX: '50%',
              refY: 52,
              x: 0,
              y: 0,
              textAnchor: 'middle',
              textVerticalAnchor: 'top',
              maxWidth: 70,
              textOverflow: 'ellipsis',
            },
          },
          markup: [
            { tagName: 'rect', selector: 'body' },
            { tagName: 'image', selector: 'image' },
            { tagName: 'text', selector: 'label' },
          ],
          ports: {
            groups: {
              in: {
                position: 'left',
                attrs: {
                  circle: {
                    r: 0,
                    magnet: true,
                    stroke: 'transparent',
                    fill: 'transparent',
                  },
                },
              },
              out: {
                position: 'right',
                attrs: {
                  circle: {
                    r: 0,
                    magnet: true,
                    stroke: 'transparent',
                    fill: 'transparent',
                  },
                },
              },
            },
            items: [
              { group: 'in', id: 'in' },
              { group: 'out', id: 'out' },
            ],
          },
        },
        true,
      );
      graphNodeRegistered = true;
    }

    const selection = new Selection({
      enabled: true,
      multiple: false,
      rubberband: false,
      showNodeSelectionBox: true,
      pointerEvents: 'none',
      movable: false,
    });

    this.graph = new Graph({
      grid: 10,
      container: this.containerRef.nativeElement,
      autoResize: true,
      panning: {
        enabled: true,
        eventTypes: ['leftMouseDown', 'mouseWheel'],
      },
      mousewheel: {
        enabled: true,
        factor: 1.1,
        minScale: 0.2,
        maxScale: 4,
        modifiers: ['ctrl', 'meta'],
      },
      background: {
        color: '#F2F7FA',
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
    this.graph.use(selection);

    this.graph.on('node:click', ({ node }) => {
      const data = node.getData() as TreeNode;
      if (data) this.nodeSelect.emit(data);
    });

    this.graph.on('node:dblclick', ({ node }) => {
      const data = node.getData() as TreeNode;
      if (data) this.nodeDoubleClick.emit(data);
    });

    this.graph.on('node:mouseenter', ({ node }) => {
      const edges = this.graph!.getConnectedEdges(node);
      edges.forEach((edge) => {
        edge.toFront();
      });
    });

    this.graph.on('scale', ({ sx }) => {
      this.currentScale = sx;
      this.scaleChange.emit(sx);
    });
  }

  private async loadData(): Promise<void> {
    if (!this.graph || !this.nodes.length) return;

    const version = ++this.loadDataVersion;

    const trees = this.splitTrees(this.nodes);
    const treeResults: any[] = await new Promise((resolve) => {
      setTimeout(async () => {
        const res = await Promise.all(trees.map((treeNodes) => this.layoutTree(treeNodes)));
        resolve(res);
      }, 500);
    });

    if (version !== this.loadDataVersion) return;

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

    this.graph.fromJSON({ nodes: allCellNodes, edges: allCellEdges });
    this.graph.centerContent();
  }

  private splitTrees(nodes: TreeNode[]): TreeNode[][] {
    const nodeMap = new Map<string, TreeNode>();
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
    const trees: TreeNode[][] = [];

    rootIds.forEach((rootId) => {
      const list: TreeNode[] = [];
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

  private createDagreLayout(): AntVDagreLayout {
    return new AntVDagreLayout({
      rankdir: 'LR',
      ranker: 'tight-tree',
      nodesep: 40,
      ranksep: 80,
      nodeSize: [NODE_WIDTH, NODE_HEIGHT],
    } as any);
  }

  private async layoutTree(
    treeNodes: TreeNode[],
  ): Promise<{ nodes: any[]; edges: any[]; minY: number; maxY: number }> {
    const nodeDataMap = new Map<string, TreeNode>();
    treeNodes.forEach((n) => nodeDataMap.set(n.id, n));

    const linkDataArray: LinkData[] = treeNodes
      .filter((n) => n.parentId && nodeDataMap.has(n.parentId))
      .map((n) => ({
        from: n.parentId,
        to: n.id,
        score: n.score,
        isModified: n.isModified || false,
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

    const dagreLayout = this.createDagreLayout();
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
        shape: 'picture-card',
        x: layoutX - NODE_WIDTH / 2,
        y: layoutY - NODE_HEIGHT / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        data: nodeData ? { ...nodeData } : undefined,
        attrs: {
          image: {
            'xlink:href': nodeData?.imageUrl || '',
          },
          label: {
            text: nodeData?.selfId || '',
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
      const lineColor = getLineColor(score, isModified);
      const lineWidth = getLineWidth(score);
      const edgeId = `${l.from}-${l.to}`;

      const parentPos = nodePositionMap.get(l.from);
      const childPos = nodePositionMap.get(l.to);

      let vertices: Array<{ x: number; y: number }> | undefined;
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
        source: { cell: l.from, port: 'out' },
        target: { cell: l.to, port: 'in' },
        vertices,
        connector: { name: 'normal' },
        attrs: {
          line: {
            stroke: lineColor,
            strokeWidth: lineWidth,
            sourceMarker: {
              name: 'classic',
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
                text: score.toFixed(2),
                fill: '#333',
                fontSize: 12,
              },
              rect: {
                fill: '#fff',
                stroke: 'none',
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
}
