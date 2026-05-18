# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vue 3 SPA for visualizing and comparing tree-structured image data. Uses AntV X6 for graph rendering with Dagre layout, Element Plus for UI components, and Pinia for state management.

## Commands

```bash
npm run dev          # Dev server on 192.168.1.159:5173 (proxies /api → 192.168.1.155:5889)
npm run dev:mock     # Dev server with mock data (VITE_USE_MOCK=true)
npm run build        # Type-check + build (parallel)
npm run build-only   # Vite build without type-check
npm run type-check   # vue-tsc --build (incremental)
```

No test runner is configured.

## Architecture

**Single-page app with no routing** — all navigation happens through Pinia stores and modal dialogs.

### Key Libraries

- **@antv/x6** — Graph canvas (tree + timeline rendering)
- **@antv/layout** (Dagre) — Tree layout algorithm
- **element-plus** — UI components (registered globally in main.ts along with icons)
- **pinia** — State management (setup store pattern with `defineStore`)

### Data Flow

1. `App.vue onMounted` → `treeStore.loadTreeData()` → fetches all root IDs → loads first tree
2. API layer (`src/api/tree.ts`) → Axios wrapper (`src/utils/request.ts`) → backend at `/api`
3. `treeStore` holds `allTrees`, `currentTree`, and flattened `nodes[]`
4. `AntVX6` component renders from `treeStore.nodes`, emits events back to App.vue
5. `compareStore` manages comparison modal state, watches `treeStore.selectedTreeId` for sync

### Type Hierarchy

```
TreeRoot { rootId, rootUrl, treeName, tree: TreeNode }
  └── TreeNode { selfId, parentId, selfUrl, score, matchDate, children[] }
  └── Node (flattened) { id, parentId, selfId, imageUrl, score, ... }
```

`CompareFrame` groups a parent node with its children for side-by-side comparison.

### Component Structure

- **App.vue** — Smart coordinator: owns keyboard events, cross-component communication, passes store data via props
- **AntVX6** — Self-contained graph canvas; registers custom X6 nodes (`picture-card`, `timeline-card`); lazy-loads images by viewport visibility; two modes: `tree` (Dagre) and `timeline` (horizontal)
- **CompareDialog** — Fullscreen modal for tree/timeline comparison with review voting; grid modes 2 (1+1) or 4 (2x2)
- **SearchHistoryDialog** — Similar image matching with pagination and node move/remove
- **PreviewPanel** — Selected node detail sidebar
- **ContextMenu** — Teleported right-click menu

### Stores (Pinia Setup pattern)

- **treeStore** — Tree data, selection, filtering, pagination, loading state
- **compareStore** — Comparison dialog navigation, frame/page state, review submission

### Known Duplication

`src/composables/useTreeData.ts` and `src/composables/useCompareDialog.ts` duplicate logic from the Pinia stores. The stores are what's actually used — these composables appear to be legacy code from before the Pinia refactor.

## API Endpoints

All proxied through Vite dev server to `http://192.168.1.155:5889`:

- `GET /get_all_root_ids` → all tree root IDs
- `GET /get_tree_by_root_id?rootId=` → tree data for a root
- `POST /batch_review` → submit review records
- `POST /update_root_name` → rename a tree
- `POST /search_history` → find similar images
- `POST /move_tree_node` → move node to different parent
