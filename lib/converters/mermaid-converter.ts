/**
 * Mermaid 到 Excalidraw 转换器
 * 将 Mermaid 代码转换为 Excalidraw 元素
 */

import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";

/**
 * 从文本中提取 Mermaid 代码块
 */
export function extractMermaidCode(content: string): string | null {
    // 匹配 ```mermaid ... ``` 代码块
    const mermaidMatch = content.match(/```mermaid\s*([\s\S]*?)```/);
    if (mermaidMatch) {
        return mermaidMatch[1].trim();
    }

    // 匹配没有代码块标记的 Mermaid 语法
    const flowchartMatch = content.match(/(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram)[\s\S]+/i);
    if (flowchartMatch) {
        return flowchartMatch[0].trim();
    }

    return null;
}

/**
 * 将 Mermaid 代码转换为 Excalidraw 元素
 */
export async function convertMermaidToElements(
    mermaidCode: string
): Promise<{ elements: ExcalidrawElement[]; files: Record<string, unknown>; success: boolean; error?: string }> {
    try {
        // 使用官方配置
        const result = await parseMermaidToExcalidraw(mermaidCode, {
            themeVariables: {
                fontSize: "16px",
            },
        });

        if (!result || !result.elements || !Array.isArray(result.elements) || result.elements.length === 0) {
            return {
                elements: [],
                files: {},
                success: false,
                error: "Mermaid parsing returned no elements",
            };
        }

        // 直接使用库返回的元素，不做过多处理
        // 库返回的元素应该已经是完整的 Excalidraw 格式
        const elements = result.elements as ExcalidrawElement[];
        const files = result.files || {};

        console.log("[Mermaid] Parsed elements:", elements.length);
        console.log("[Mermaid] Element types:", elements.map(el => el.type));

        return {
            elements,
            files,
            success: true,
        };
    } catch (error) {
        console.error("Mermaid conversion failed:", error);
        return {
            elements: [],
            files: {},
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * 检测内容是否包含 Mermaid 代码
 */
export function containsMermaidCode(content: string): boolean {
    return /```mermaid/i.test(content) ||
        /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram)\s/im.test(content);
}

/**
 * Mermaid 图表类型
 */
export type MermaidDiagramType =
    | "flowchart"
    | "sequence"
    | "class"
    | "state"
    | "er"
    | "unknown";

/**
 * 检测 Mermaid 代码的图表类型
 */
export function detectMermaidType(code: string): MermaidDiagramType {
    const lowerCode = code.toLowerCase();
    if (lowerCode.startsWith("flowchart") || lowerCode.startsWith("graph")) {
        return "flowchart";
    }
    if (lowerCode.startsWith("sequencediagram")) {
        return "sequence";
    }
    if (lowerCode.startsWith("classdiagram")) {
        return "class";
    }
    if (lowerCode.startsWith("statediagram")) {
        return "state";
    }
    if (lowerCode.startsWith("erdiagram")) {
        return "er";
    }
    return "unknown";
}
