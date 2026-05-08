# 图片查看器库集成计划

## 需求分析

在比对弹窗中的每张图片，双击后可以额外打开全屏图片查看器，支持缩放、旋转、下载等操作。

## 库选型对比

| 库                           | 特点                                                                                     | 适合度   |
| --------------------------- | -------------------------------------------------------------------------------------- | ----- |
| **v-viewer** (基于 Viewer.js) | 最成熟，53个配置项，23个方法，17个事件。支持缩放/旋转/翻转/下载/全屏/键盘快捷键。Vue3 版 <v-viewer@2.x> + viewerjs@^11.0.0 | ⭐⭐⭐⭐⭐ |
| images-viewer-vue3          | Vue3 专用，功能类似但生态较新，维护时间较短                                                               | ⭐⭐⭐   |
| simple-img-viewer           | 轻量但功能较少                                                                                | ⭐⭐    |
| medium-zoom                 | 仅缩放动画，无旋转/下载                                                                           | ⭐     |

**推荐选择：v-viewer** — 最成熟稳定，功能最全，社区活跃，API 模式完美适配需求。

## 涉及文件

* `package.json` — 安装依赖

* `src/main.ts` — 全局注册 v-viewer

* `src/components/compare-dialog/index.vue` — 双击图片触发查看器

## 实施步骤

### 步骤1：安装依赖

```bash
npm install v-viewer viewerjs
```

### 步骤2：main.ts 全局注册

```typescript
import { createApp } from 'vue'
import App from './App.vue'
import Viewer from 'v-viewer'
import 'viewerjs/dist/viewer.css'

const app = createApp(App)
app.use(Viewer, {
  defaultOptions: {
    zIndex: 9999,
    toolbar: {
      zoomIn: 1,
      zoomOut: 1,
      oneToOne: 1,
      reset: 1,
      rotateLeft: 1,
      rotateRight: 1,
      flipHorizontal: 1,
      flipVertical: 1,
      download: 1,
    },
    keyboard: true,
    title: false,
    navbar: false,
  },
})
```

### 步骤3：CompareDialog 中双击图片触发查看器

在 compare-dialog/index.vue 中，给每个 `el-image` 的 `@dblclick` 事件添加处理函数，使用 `viewerApi` 编程式打开图片查看器：

```typescript
import { api as viewerApi } from 'v-viewer'

function openImageViewer(url: string) {
  viewerApi({
    images: [url],
  })
}
```

模板中：

```html
<el-image @dblclick="openImageViewer(currentFrame.parent.selfUrl)" ...>
```

需要添加 `@dblclick` 的位置：

1. 树形模式 - 父节点图片（左上角/左侧固定图）
2. 树形模式 - 子节点图片（其余格子）
3. 时间轴模式 - 根节点图片
4. 时间轴模式 - 子节点图片
5. 单图预览模式 - 图片

### 步骤4：防止双击穿透到 dialog 的键盘事件

v-viewer 打开后有自己的键盘事件处理（ESC 关闭等），需要确保不会和 CompareDialog 的键盘事件冲突。由于 v-viewer 的 zIndex 设置为 9999，且 dialog 也是 fullscreen，查看器会叠加在 dialog 上方，ESC 先由 v-viewer 处理关闭查看器，不会误关闭 dialog。

## 关键设计决策

1. **使用 API 模式**（`viewerApi`）：不需要在模板中添加额外组件，直接编程式调用，最灵活
2. **单图查看**：每次只传入当前双击的那张图片的 URL，不传列表（避免和比对弹窗的翻页逻辑混淆）
3. **zIndex 9999**：确保查看器在 dialog 之上
4. **navbar 关闭**：单图模式不需要导航栏
5. **保留完整工具栏**：缩放、旋转、翻转、1:1、重置、下载全部开启

