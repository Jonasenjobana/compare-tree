# 替换GoJS为AntV G6实现树形图组件计划
## 功能需求梳理（原GoJS组件现有功能）
1. 基础渲染能力
   - 横向树形布局，layerSpacing:80, nodeSpacing:40
   - 节点样式：80x100圆角矩形卡片，包含72x40.5图片+节点ID文本
   - 连线样式：正交路由，圆角5px，带反向箭头，宽度和颜色根据score、isModified动态变化，连线末端显示score数值
2. 交互能力
   - 支持缩放、平移、节点选中
   - 节点点击触发nodeSelect事件，双击触发nodeDoubleClick事件
   - 节点hover时关联连线前置到前景层
   - 缩放变化时触发scaleChange事件
   - 支持撤销/重做操作
3. 对外API
   - locateNode(nodeId): 定位到指定节点并选中、放大到1.5倍
   - getDiagram(): 获取画布实例
   - getCurrentScale(): 获取当前缩放比例
   - 响应nodes属性变化，自动更新图表
## 实现步骤
1. 检查AntV G6依赖安装情况，未安装则添加依赖
2. 创建新组件文件`src/components/g6-tree/index.vue`
3. 实现G6画布初始化配置
   - 配置画布大小、允许缩放平移、padding 200
   - 配置树布局参数和原GoJS一致：横向、层间距80、节点间距40
   - 开启撤销/重做功能
4. 实现自定义节点模板
   - 复刻原有节点样式：圆角矩形背景、图片、文本居中
   - 实现选中高亮效果（蓝色边框）
   - 绑定节点点击、双击、hover事件
5. 实现自定义连线模板
   - 正交路由、圆角配置
   - 动态绑定连线宽度（复用现有`getLineWidth`工具方法）
   - 动态绑定连线/箭头颜色（复用现有`getLineColor`工具方法）
   - 连线末端显示score数值（保留两位小数）
6. 实现数据转换与加载逻辑
   - 将传入的nodes数组转换为G6兼容的节点/边数据格式
   - 监听nodes属性变化，自动更新图表数据
7. 实现事件监听与对外emit
   - 监听视口变化，触发scaleChange事件
   - 节点点击/双击事件转发emit
   - 节点hover时处理关联连线层级
8. 实现对外暴露的API方法
   - locateNode: 定位节点、选中、居中、缩放到1.5倍
   - getDiagram: 返回G6实例
   - getCurrentScale: 返回当前缩放比例
9. 组件兼容性验证
   - 保持原有props定义和emit事件不变，确保可以无缝替换原有gojs-tree组件
   - 测试所有功能和原有组件行为一致
10. （可选）替换项目中原有gojs-tree组件引用，移除GoJS依赖