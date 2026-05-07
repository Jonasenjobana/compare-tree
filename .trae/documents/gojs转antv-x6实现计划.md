# GoJS树组件转AntV X6实现计划

## 目标
**新增独立的AntV X6版本树组件，路径为`src/components/antv-x6-tree/index.vue`，完全复刻现有gojs-tree组件的所有功能、UI交互、对外API完全一致，原有gojs-tree组件保持不变，不影响现有业务代码，新老组件可并行使用。

## 实现步骤
### 步骤1：功能梳理（已完成）
先梳理现有GoJS组件的所有功能点，确保重写后100%对齐：
- ✅ 画布基础能力：支持缩放、平移、节点选中、撤销重做、视口padding 200px
- ✅ 布局配置：横向树布局，层间距80px，节点间距40px
- ✅ 节点模板：
  - 80x100px圆角矩形，白色填充，灰色边框
  - 顶部72x40.5px图片区域，绑定imageUrl字段
  - 底部显示selfId文本，居中，超出省略
  - 选中时显示3px蓝色边框
  - 交互：点击触发nodeSelect事件、双击触发nodeDoubleClick事件、hover时关联连线置顶
- ✅ 连线模板：
  - 正交路由，圆角5px，起始端预留25px长度、8px短距
  - 线宽根据score值动态计算（使用现有getLineWidth工具方法）
  - 线色根据score和isModified动态计算（使用现有getLineColor工具方法）
  - 起始端带Backward箭头，颜色与线保持一致
  - 连线末端显示score值，保留两位小数
- ✅ 数据处理：根据传入的nodes数组自动生成节点和连线，parentId作为关联依据
- ✅ 事件抛出：nodeSelect（节点选中）、nodeDoubleClick（节点双击）、scaleChange（缩放变化）
- ✅ 暴露方法：
  - locateNode: 定位到指定节点并选中、放大到1.5倍居中
  - getDiagram: 获取画布实例
  - getCurrentScale: 获取当前缩放比例
- ✅ 响应式：nodes数据变化时自动重新加载画布

### 步骤2：依赖准备
- 检查项目是否已安装AntV X6相关依赖：`@antv/x6`、`@antv/x6-vue-shape`（如果需要vue节点）
- 确认工具方法`getLineWidth`、`getLineColor`和类型定义`Node`、`LinkData`可复用

### 步骤3：X6组件实现
1. **初始化画布**：
   - 替换go.Diagram为x6.Graph，配置相同的画布能力：允许缩放、平移、选中，开启撤销重做
   - 配置树布局，参数对齐现有TreeLayout配置（angle=0横向、layerSpacing=80、nodeSpacing=40）
   - 监听视口变化事件，抛出scaleChange事件，同步currentScale值

2. **注册节点模板**：
   - 自定义节点完全对齐现有UI：圆角矩形、图片、文本的尺寸和样式
   - 实现节点选中样式，蓝色3px边框
   - 绑定节点交互事件：click、dblclick、mouseenter、mouseleave，实现相同的交互逻辑

3. **注册连线模板**：
   - 配置正交路由、圆角、起始端长度参数对齐现有配置
   - 绑定strokeWidth、stroke属性，复用现有getLineWidth、getLineColor方法
   - 配置起始端箭头，样式和颜色对齐现有实现
   - 添加连线标签，显示score值保留两位小数

4. **数据加载逻辑**：
   - 实现loadDiagram方法，将输入的nodes数组转换为X6需要的nodes和edges数据格式
   - 保持数据更新的响应式，监听nodes变化自动重新渲染

5. **暴露方法实现**：
   - 实现locateNode方法，功能完全对齐现有实现：查找节点、选中、居中、缩放1.5倍
   - 实现getDiagram、getCurrentScale方法，保持接口不变

### 步骤4：兼容验证
- 保持组件props、emit定义完全不变，上层调用不需要修改任何代码
- 验证所有交互和功能与原GoJS版本完全一致
- 测试数据更新、节点定位、事件触发等所有场景

### 步骤5：清理冗余代码
- 移除gojs相关导入和依赖
- 保持组件代码结构清晰，遵循现有代码规范