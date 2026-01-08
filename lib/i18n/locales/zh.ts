/**
 * 中文语言包
 */
export const zh = {
    // 通用
    common: {
        loading: "加载中...",
        loadingCanvas: "加载画布中...",
        export: "导出",
        import: "导入",
        save: "保存",
        cancel: "取消",
        confirm: "确认",
        delete: "删除",
        edit: "编辑",
        add: "添加",
        close: "关闭",
        settings: "设置",
        help: "帮助",
    },

    // 欢迎引导
    welcome: {
        title: "欢迎使用 SmartCanvas AI",
        subtitle: "AI 驱动的智能图表绘制工具",
        features: {
            aiGenerate: {
                title: "AI 生成图表",
                description: "在右侧对话框描述需求，AI 自动生成流程图、架构图等",
            },
            selectEdit: {
                title: "选中编辑",
                description: "选中节点后，使用 AI 进行修改、删除或添加操作",
            },
            autoLayout: {
                title: "自动布局",
                description: "点击顶部「布局」按钮，自动整理节点位置",
            },
        },
        shortcuts: "快捷键",
        undo: "撤销",
        redo: "重做",
        copy: "复制",
        paste: "粘贴",
        dontShowAgain: "不再显示",
        getStarted: "开始使用",
        freeTrial: "免费试用：每天 {limit} 次 AI 请求。配置您自己的 API Key 可无限使用。",
    },

    // 头部
    header: {
        autoLayout: "布局",
        engineExcalidraw: "Excalidraw",
        engineDrawio: "Draw.io",
    },

    // 聊天面板
    chat: {
        placeholder: "描述你想要的图表，或选中元素后编辑...",
        placeholderSelected: "已选中 {count} 个元素，输入编辑指令...",
        thinking: "正在思考...",
        generating: "正在生成... (~{tokens} tokens)",
        success: {
            generated: "已生成 {nodes} 个节点和 {edges} 条连线",
            modified: "已修改",
            deleted: "已删除选中的元素",
            connected: "已添加连线",
        },
        error: {
            noApiKey: "请先在设置中配置 API Key",
            parseFailed: "无法解析 AI 返回的图表数据",
            editFailed: "编辑失败",
            networkError: "网络错误，请重试",
        },
        selectedElements: "已选中 {count} 个元素",
    },

    // 导出导入
    exportImport: {
        exportJson: "导出 JSON",
        exportPng: "导出 PNG",
        exportSvg: "导出 SVG",
        importFailed: "导入失败：文件格式不正确",
    },

    // 模块面板
    module: {
        title: "模块",
        ungrouped: "未分组",
        modulePrefix: "模块",
        noModules: "暂无模块",
        selectAll: "选中全部",
        regenerate: "重新生成",
        nodeCount: "节点",
    },

    // API Key 管理
    apiKey: {
        title: "API Key 设置",
        description: "配置您的 LLM API Key，支持自定义 Base URL 和模型名称。",
        provider: "服务商",
        apiKey: "API Key",
        apiKeyPlaceholder: "输入 {provider} API Key",
        baseUrl: "Base URL（可选，留空使用官方地址）",
        baseUrlPlaceholder: "可选，留空使用默认",
        baseUrlHint: "支持第三方 API 代理或本地部署的兼容服务",
        model: "模型名称",
        modelPlaceholder: "可选，留空使用默认",
        advancedSettings: "高级设置",
        save: "保存",
        cancel: "取消",
        close: "关闭",
        modify: "修改",
        delete: "删除",
        addApiKey: "+ 添加 API Key",
        saveFailed: "保存失败",
        saveSuccess: "保存成功",
        deleteFailed: "删除失败",
        deleteSuccess: "删除成功",
        setDefault: "设为默认",
        currentlyUsing: "当前使用",
        switchedTo: "已切换到 {provider}",
        apiKeyEmpty: "API Key 不能为空",
    },

    // AI 提示词
    ai: {
        systemPrompt: `你是一个专业的图表生成助手。根据用户的描述生成结构化的图表数据。

## 输出格式
请返回 JSON 格式的图表数据：
\`\`\`json
{
  "nodes": [
    {"id": "1", "type": "process", "label": "节点名称", "row": 0, "column": 0}
  ],
  "edges": [
    {"id": "e1", "source": "1", "target": "2", "label": "可选标签"}
  ]
}
\`\`\`

## 节点类型
- start: 开始节点（椭圆）
- end: 结束节点（椭圆）
- process: 处理步骤（矩形）
- decision: 判断分支（菱形）
- data: 数据（平行四边形）

## 规则
1. 使用 row/column 表示逻辑位置
2. 确保所有节点都有有意义的标签
3. 连线的 source/target 必须引用有效的节点 id
4. 只返回 JSON，不要其他内容`,

        incrementalEditPrompt: `你是一个专业的图表编辑助手。用户会提供当前选中的节点/连线信息，以及编辑指令。
你需要分析用户的意图，并返回增量更新的 JSON 数据。

## 返回格式
请返回以下 JSON 格式：
\`\`\`json
{
  "operation": "modify|add|delete|connect|disconnect|restyle",
  "explanation": "对操作的简短说明",
  "nodesToAdd": [],
  "nodesToUpdate": [],
  "nodesToDelete": [],
  "edgesToAdd": [],
  "edgesToUpdate": [],
  "edgesToDelete": []
}
\`\`\`

## 规则
1. 只返回需要变化的部分
2. 始终用中文解释操作
3. 只返回 JSON，不要其他内容`,

        mermaidSystemPrompt: `你是一个专业的图表生成助手。使用 Mermaid 语法输出图表。

## 支持的图表类型
- flowchart TD（流程图，从上到下）
- flowchart LR（流程图，从左到右）
- sequenceDiagram（时序图）
- classDiagram（类图）
- stateDiagram-v2（状态图）

## 节点形状
- [文字] 矩形
- (文字) 圆角矩形
- {文字} 菱形
- ((文字)) 圆形
- [[文字]] 子流程

## 示例
\`\`\`mermaid
flowchart TD
    A[开始] --> B{判断条件}
    B -->|是| C[处理步骤]
    B -->|否| D[其他处理]
    C --> E[结束]
    D --> E
\`\`\`

## 规则
1. 只输出 Mermaid 代码块
2. 使用中文标签
3. 流程图默认用 TD（从上到下）
4. 不要添加任何解释`,
    },
};

export type TranslationKeys = typeof zh;
