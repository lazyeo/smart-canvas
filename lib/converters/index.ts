/**
 * 转换器模块导出
 */

export {
    generateDrawioXml,
    generateEmptyDrawioXml,
} from "./drawio-converter";

export {
    extractMermaidCode,
    convertMermaidToElements,
    containsMermaidCode,
    detectMermaidType,
    type MermaidDiagramType,
    type ConversionResult,
} from "./mermaid-converter";

// Mermaid 降级转换器
export {
    generateERFallback,
    generateArchitectureFallback,
    generateMindmapFallback,
    generateFlowchartFromJSON,
    autoFallback,
    FALLBACK_MESSAGES,
    type FallbackResult,
} from "./mermaid-fallback";

// 专业版 Draw.io 生成器
export {
    generateProfessionalDrawioXml,
    excalidrawToProfessionalData,
} from "./drawio-professional";
