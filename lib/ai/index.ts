export { chat, chatStream, ask, type LLMMessage, type LLMResponse, type LLMOptions, type StreamCallbacks } from "./llm-client";
export {
    SYSTEM_PROMPT,
    getMermaidSystemPrompt,
    buildDiagramPrompt,
    buildMermaidPrompt,
    buildModifyPrompt,
    parseDiagramJSON,
    type DiagramType,
} from "./prompt-templates";
export { generateExcalidrawElements } from "./diagram-generator";

// 选中上下文服务
export {
    SelectionContextService,
    createSelectionContextService,
    getDefaultSelectionContextService,
    type SelectionContext,
    type SelectionListenerCallbacks,
} from "./selection-context";

// 增量编辑服务
export {
    IncrementalEditService,
    createIncrementalEditService,
    getDefaultIncrementalEditService,
    buildIncrementalEditPrompt,
    parseIncrementalEditResponse,
    executeIncrementalEdit,
    type EditOperation,
    type IncrementalEditRequest,
    type IncrementalEditResult,
} from "./incremental-edit";

// 对话历史管理
export {
    createConversationHistory,
    addMessage,
    historyToMessages,
    getMessageCount,
    hasSummary,
    clearHistory,
    type ConversationHistory,
    type ConversationMessage,
} from "./conversation-history";

// 上下文压缩
export {
    compressNodes,
    compressEdges,
    compressExcalidrawContext,
    generateCompressedPrompt,
    expandShortId,
    type CompressedContext,
} from "./context-compression";

// 专业版增强服务
export {
    enhance,
    quickEnhance,
    fullEnhance,
    analyzeDiagram,
    type EnhanceRequest,
    type EnhanceResult,
    type AnalyzeRequest,
} from "./enhancement-service";

// 增强提示词和类型
export {
    ANALYSIS_SYSTEM_PROMPT,
    buildAnalysisPrompt,
    parseAnalysisResult,
    suggestEnhancementOptions,
    COLOR_SCHEMES,
    type SwimlaneInfo,
    type ParallelBranchInfo,
    type NodeEnhancement,
    type EdgeEnhancement,
    type AnalysisResult,
} from "./enhancement-prompts";
