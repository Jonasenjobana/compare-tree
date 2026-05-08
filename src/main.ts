import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import Viewer from 'v-viewer'
import 'viewerjs/dist/viewer.css'

import App from './App.vue'
import router from './router'
import './styles/index.css'
const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
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

app.mount('#app')
