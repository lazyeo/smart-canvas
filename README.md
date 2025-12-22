# SmartCanvas AI

基于 LLM 驱动的下一代可视化绘图助手，支持 Excalidraw 与 draw.io 双引擎渲染。

## 核心特性

- **智能生成**: 自然语言转图表，支持流程图、架构图、时序图等
- **增量编辑**: 选中元素对话式修改，无需重新生成
- **双引擎**: Excalidraw (手绘风) + Draw.io (工业级)
- **分块生成**: 复杂图表模块化并行生成

## 技术栈

- Next.js 15 + TailwindCSS
- @excalidraw/excalidraw + react-drawio
- IndexedDB + LocalStorage
- OpenAI / Anthropic API

## 开发文档

详细文档位于 `docs/` 目录（本地开发参考，不纳入版本控制）。

## 快速开始

```bash
npm install
npm run dev
```

## License

MIT
