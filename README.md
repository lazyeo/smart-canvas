# SmartCanvas AI

基于 LLM 驱动的下一代可视化绘图助手，支持 Excalidraw 与 Draw.io 双引擎渲染。

## 核心特性

### AI 生成
- **自然语言转图表** - 描述需求，AI 自动生成流程图、架构图、时序图等
- **智能布局** - Dagre 算法自动优化节点位置和连线路径
- **分块生成** - 复杂图表模块化并行生成

### 增量编辑
- **选中编辑** - 选中元素后用自然语言修改、删除或添加
- **智能连线** - 选中两个节点，说"连接"即可创建箭头
- **降级处理** - AI 响应格式不标准时自动提取操作意图

### 双引擎
| 引擎 | 风格 | 适用场景 |
|------|------|---------|
| **Excalidraw** | 手绘草图风 | 头脑风暴、快速原型 |
| **Draw.io** | 专业矢量风 | 正式文档、技术规范 |

一键切换，同一图表两种风格。

## 快速开始

```bash
npm install
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 首次使用
1. 点击设置图标配置 API Key（OpenAI / Anthropic / Gemini）
2. 在右侧对话框描述需求
3. AI 自动生成图表

### 操作指南

| 功能 | 操作 |
|------|------|
| 生成图表 | 输入"画一个用户登录流程图" |
| 编辑节点 | 选中节点 → 输入"把文字改成XXX" |
| 删除节点 | 选中节点 → 输入"删除" |
| 添加节点 | 选中节点 → 输入"在下方添加一个处理节点" |
| 添加连线 | 选中两个节点 → 输入"连接" |
| 自动布局 | 点击 Header 的"布局"按钮 |
| 切换引擎 | 点击 Header 的 Excalidraw/Draw.io Tab |

### 快捷键
| 快捷键 | 功能 |
|--------|------|
| Ctrl+Z | 撤销 |
| Ctrl+Shift+Z | 重做 |
| Ctrl+C / V | 复制/粘贴 |

## 技术栈

- **框架**: Next.js 15 + TypeScript + TailwindCSS
- **画布**: @excalidraw/excalidraw + react-drawio
- **布局**: Dagre
- **存储**: LocalStorage (API Keys) + IndexedDB (画布状态)
- **LLM**: OpenAI / Anthropic / Gemini API

## 项目结构

```
├── app/                # Next.js App Router
├── components/
│   ├── canvas/         # 画布组件 (Excalidraw, Draw.io)
│   ├── layout/         # 布局组件 (Header, ChatPanel)
│   ├── guide/          # 引导组件
│   └── settings/       # 设置组件
├── contexts/           # React Context (Canvas, Engine)
├── lib/
│   ├── ai/             # AI 服务 (LLM, 增量编辑)
│   ├── layout/         # 布局算法 (Dagre)
│   ├── converters/     # 格式转换 (Draw.io XML)
│   └── storage/        # 存储管理
└── docs/               # 开发文档 (本地，不纳入版本控制)
```

## 开发命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run start    # 启动生产服务器
npm run lint     # 运行 ESLint
```

## License

MIT
