# Picture-Tree Vue 3 → Angular NG12 移植计划

## 一、移植范围概述

| Vue 3 模块 | Angular NG12 对应 |
|------------|------------------|
| Vue 3 + TypeScript `<script setup>` | Angular 组件 + TypeScript |
| Pinia Store | Angular Service + RxJS BehaviorSubject |
| Vue Router | Angular Router |
| Element Plus | Angular Material / NgZorro |
| @antv/x6 图可视化 | @antv/x6（Angular 封装） |
| v-viewer 图片查看 | ngx-viewer / Angular Viewer |
| Axios HTTP | Angular HttpClient |
| Composables | Angular Services |

---

## 二、目录结构转换

```
Vue 3 目录                    Angular 12 目录
─────────────────────────────────────────────────
src/api/tree.ts            →  src/app/api/tree.service.ts
src/composables/           →  src/app/services/
  useTreeData.ts             →    tree-data.service.ts
  useCompareDialog.ts         →    compare-dialog.service.ts
src/components/            →  src/app/components/
  antv-x6-tree/              →    antv-x6-tree/
  compare-dialog/            →    compare-dialog/
  search-history-dialog/      →    search-history-dialog/
  context-menu/              →    context-menu/
  preview-panel/              →    preview-panel/
src/types/index.ts         →  src/app/models/
src/utils/                 →  src/app/utils/
  tree-utils.ts               →    tree-utils.ts
  gojs-utils.ts               →    line-style-utils.ts
  request.ts                  →    http-base.service.ts
src/stores/                →  (合并到 Services)
  treeStore.ts                →    tree-data.service.ts
  compareStore.ts             →    compare-dialog.service.ts
src/App.vue               →  src/app/app.component.ts
src/main.ts               →  src/main.ts
```

---

## 三、核心模块移植步骤

### Phase 1: 基础设施层

#### 1.1 依赖安装
```bash
# Angular NG12 项目添加依赖
npm install @antv/x6@2.18 @antv/layout@1.2.14-beta.8
npm install @angular/material @angular/cdk
npm install rxjs @types/rx --save
# 注意：Angular 12 使用的 RxJS 版本为 6.x
```

#### 1.2 类型定义转换
`src/types/index.ts` → `src/app/models/tree.model.ts`

```typescript
// TreeNode 保持相同结构
export interface TreeNode {
  id: string;
  selfId: string;
  selfUrl: string;
  parentId: string;
  parentUrl: string;
  rootId: string;
  rootUrl: string;
  matchDate: string;
  score: number;
  children: TreeNode[];
  manualReview: string;
  reviewResult: string;
  intelligentRecommend: string;
}

// Angular 使用 class 替代 interface 的场景
export class Node {
  constructor(
    public id: string,
    public parentId: string,
    public selfId: string,
    public score: number,
    public matchDate: string,
    public imageUrl: string,
    public selfUrl: string,
    public rootId: string,
    public isModified?: boolean,
    public reviewResult?: string
  ) {}
}
```

#### 1.3 HTTP 服务层
`src/api/tree.ts` → `src/app/api/tree-api.service.ts`

```typescript
// Vue Axios
import request from '@/utils/request'
export function getAllRootIds(): Promise<TreeResponse> {
  return request.get<TreeResponse, TreeResponse>('/get_all_root_ids')
}

// Angular HttpClient
@Injectable({ providedIn: 'root' })
export class TreeApiService {
  constructor(private http: HttpClient) {}

  getAllRootIds(): Observable<TreeResponse> {
    return this.http.get<TreeResponse>(`${environment.apiUrl}/get_all_root_ids`);
  }

  getTreeByRootId(rootId: string): Observable<NodeResponse> {
    return this.http.get<NodeResponse>(`${environment.apiUrl}/get_tree_by_root_id`,
      { params: { rootId } });
  }

  batchReview(records: ReviewRecord[]): Observable<any> {
    return this.http.post(`${environment.apiUrl}/batch_review`, { records });
  }

  searchHistory(selfId: string, top_k: number = 10): Observable<SearchHistoryResponse> {
    return this.http.post<SearchHistoryResponse>(`${environment.apiUrl}/search_history`,
      { selfId, top_k });
  }
}
```

---

### Phase 2: 状态管理层（Pinia → RxJS Services）

#### 2.1 TreeStore 转换
`src/stores/treeStore.ts` → `src/app/services/tree-data.service.ts`

```typescript
// Vue 3 (Pinia)
export const useTreeStore = defineStore('tree', () => {
  const allTrees = ref<TreeRoot[]>([])
  const nodes = ref<Node[]>([])
  const viewMode = ref<'tree' | 'timeline'>('tree')
  // ... computed, methods
  return { allTrees, nodes, viewMode, ... }
})

// Angular NG12 (RxJS)
@Injectable({ providedIn: 'root' })
export class TreeDataService {
  // State as BehaviorSubjects
  private allTreesSubject = new BehaviorSubject<TreeRoot[]>([]);
  private nodesSubject = new BehaviorSubject<Node[]>([]);
  private viewModeSubject = new BehaviorSubject<'tree' | 'timeline'>('tree');

  // Public observables
  allTrees$ = this.allTreesSubject.asObservable();
  nodes$ = this.nodesSubject.asObservable();
  viewMode$ = this.viewModeSubject.asObservable();

  // Computed
  filteredTrees$ = combineLatest([this.allTreesSubject, this.searchKeyword$, this.maxNodeCount$])
    .pipe(map(([trees, keyword, maxCount]) => /* filter logic */));

  // Methods
  async loadTreeData(): Promise<void> {
    // use switchMap with HttpClient
  }
}
```

#### 2.2 CompareStore 转换
`src/stores/compareStore.ts` → `src/app/services/compare-dialog.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class CompareDialogService {
  // State
  compareVisible = new BehaviorSubject<boolean>(false);
  compareRootImage = new BehaviorSubject<string>('');
  compareTreeFrames = new BehaviorSubject<CompareFrame[]>([]);
  // ...

  // Methods
  openCompareForNode(node: Node, childId?: string): void {
    // Implementation
    this.compareVisible.next(true);
  }

  prevCompareGroup(): void { /* ... */ }
  nextCompareGroup(): void { /* ... */ }
}
```

---

### Phase 3: 组件移植

#### 3.1 AntVX6 树形画布组件

`src/components/antv-x6-tree/index.vue` → `src/app/components/antv-x6-tree/`

**关键差异:**

| Vue 3 | Angular 12 |
|-------|------------|
| `<script setup>` | `@Component` + `ngOnInit` |
| `ref()` | `ViewChild` + ElementRef |
| `defineProps` | `@Input` |
| `defineEmits` | `@Output` + `EventEmitter` |
| `watch()` | `ngOnChanges` / subscription |
| `v-if/v-for` | `*ngIf/*ngFor` |

```typescript
// Angular component
@Component({
  selector: 'app-antv-x6-tree',
  templateUrl: './antv-x6-tree.component.html',
  styleUrls: ['./antv-x6-tree.component.scss']
})
export class AntvX6TreeComponent implements OnInit, OnChanges, OnDestroy {
  @Input() nodes: Node[] = [];
  @Input() focusNodeId?: string;
  @Input() viewMode: 'tree' | 'timeline' = 'tree';
  @Input() trees: TreeRoot[] = [];
  @Input() timelineOrder: 'asc' | 'desc' = 'asc';
  @Input() loading?: boolean;

  @Output() nodeSelect = new EventEmitter<Node>();
  @Output() nodeDoubleClick = new EventEmitter<Node>();
  @Output() nodeContextMenu = new EventEmitter<{node: Node, event: MouseEvent}>();
  @Output() edgeClick = new EventEmitter<Node>();

  @ViewChild('containerRef') containerRef!: ElementRef;

  private graph: Graph | null = null;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.initGraph();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes'] && !changes['nodes'].firstChange) {
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.graph?.dispose();
  }
}
```

```html
<!-- Angular template -->
<div #containerRef class="x6-diagram"></div>
<div *ngIf="loading" class="tree-loading-overlay">
  <div class="tree-loading-spinner"></div>
  <span class="tree-loading-text">加载中...</span>
</div>
```

#### 3.2 CompareDialog 比对对话框

`src/components/compare-dialog/index.vue` → `src/app/components/compare-dialog/`

**关键差异:**

| Vue 3 | Angular 12 |
|-------|------------|
| `v-model` | `[visible]` + `(visibleChange)` |
| `v-show` | `[class.hidden]` or `*ngIf` |
| `slot` | `ng-template` |
| `el-dialog` | `cdk-dialog` / MatDialog |

```typescript
// Angular 使用 MatDialog
@Component({
  selector: 'app-compare-dialog',
  template: `
    <div *ngIf="visible" class="compare-overlay">
      <!-- 对话框内容 -->
    </div>
  `
})
export class CompareDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() submitReview = new EventEmitter<ReviewRecord[]>();
  @Output() searchHistory = new EventEmitter<string>();
}
```

#### 3.3 其他组件

| Vue 组件 | Angular 组件 | 注意事项 |
|---------|-------------|---------|
| `preview-panel` | PreviewPanelComponent | 右侧面板，Input/Output |
| `search-history-dialog` | SearchHistoryDialogComponent | 独立 Dialog |
| `context-menu` | ContextMenuComponent | 需要 CDK Overlay |

---

### Phase 4: 主应用组件

`src/App.vue` → `src/app/app.component.ts`

```typescript
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  constructor(
    public treeStore: TreeDataService,
    public compareStore: CompareDialogService,
    private destroy$: Subject<void>
  ) {}

  // 组件引用
  @ViewChild('goJsTreeRef') goJsTreeRef!: AntvX6TreeComponent;

  // 本地状态 (refs)
  searchHistoryVisible = false;
  searchHistoryResults: SearchHistoryItem[] = [];
  searchHistoryLoading = false;

  // 方法转换
  handleNodeSelect(node: Node): void {
    this.treeStore.setSelectedNode(node);
  }

  handleNodeDoubleClick(node: Node): void {
    this.compareStore.openCompareForNode(node);
  }

  handleSubmitReview(records: ReviewRecord[]): void {
    // API call
  }

  // 键盘事件
  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (this.compareStore.compareVisible) return;
    if (event.key === 'ArrowLeft') this.treeStore.goToPrevTree();
    else if (event.key === 'ArrowRight') this.treeStore.goToNextTree();
  }

  ngOnInit(): void {
    this.treeStore.loadTreeData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

---

## 四、路由配置

```typescript
// app-routing.module.ts
const routes: Routes = [
  { path: '', redirectTo: '/tree', pathMatch: 'full' },
  { path: 'tree', component: MainTreeComponent },
  // 其他路由
];

// Angular Router vs Vue Router
// navigation:
// Vue: router.push('/tree')
// Angular: router.navigate(['/tree'])
```

---

## 五、依赖差异处理

### 5.1 Element Plus → Angular Material

| Element Plus | Angular Material |
|-------------|-----------------|
| `ElButton` | `MatButton` |
| `ElInput` | `MatInput` |
| `ElRadioGroup` | `MatRadioGroup` |
| `ElDialog` | `MatDialog` |
| `ElMessage` | `MatSnackBar` |
| `ElPopover` | `MatMenu` / CDK Overlay |
| `ElIcon` | `MatIcon` |

### 5.2 v-viewer → Angular 方案

```typescript
// Option 1: ngx-viewer
import { ViewerOptions } from 'ngx-viewer';

// Option 2: 直接集成 viewer.js
import Viewer from 'viewerjs';

@Component({...})
export class ImagePreviewComponent {
  @ViewChild('imageElement') imageElement!: ElementRef;

  showViewer(): void {
    const viewer = new Viewer(this.imageElement.nativeElement, {
      navbar: true,
      title: true,
    });
    viewer.show();
  }
}
```

---

## 六、移植检查清单

### 数据层
- [ ] 移植所有 TypeScript 类型/接口
- [ ] 创建 Angular HttpClient 服务替代 Axios
- [ ] 创建 TreeApiService

### 状态管理层
- [ ] TreeDataService (替代 treeStore)
- [ ] CompareDialogService (替代 compareStore)
- [ ] 验证 RxJS 订阅管理

### 组件层
- [ ] AntvX6TreeComponent - 树形画布
- [ ] CompareDialogComponent - 比对对话框
- [ ] SearchHistoryDialogComponent - 搜索结果
- [ ] PreviewPanelComponent - 右侧预览
- [ ] ContextMenuComponent - 右键菜单

### 主应用
- [ ] AppComponent 整合所有组件
- [ ] 键盘事件处理 (HostListener)
- [ ] 路由配置

### 样式
- [ ] SCSS 样式迁移
- [ ] 响应式布局适配

---

## 七、关键技术差异备忘

| Vue 3 | Angular 12 |
|-------|------------|
| `ref.value` | `ViewChild` + `.nativeElement` |
| `reactive` | `BehaviorSubject` |
| `computed` | `combineLatest` + `map` |
| `watch` | `ngOnChanges` / subscription |
| `provide/inject` | `@Inject` + `InjectionToken` |
| `emit` | `@Output` + `EventEmitter` |
| `v-model` | `[prop]` + `(propChange)` |
| `slot` | `ng-template` + `TemplateRef` |
| `nextTick` | `cdr.detectChanges()` / `setTimeout` |
| `defineExpose` | `@ViewChild` |

---

## 八、建议的移植顺序

1. **类型定义** - 建立共享模型
2. **API服务** - HTTP层隔离
3. **树数据服务** - 核心状态管理
4. **比对服务** - 对话框状态
5. **AntVX6组件** - 最复杂的可视化组件
6. **其他UI组件** - 对话框、面板
7. **App主组件** - 整合测试
8. **样式调整** - UI优化
