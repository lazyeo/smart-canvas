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
): Promise<{ elements: ExcalidrawElement[]; success: boolean; error?: string }> {
    try {
        const result = await parseMermaidToExcalidraw(mermaidCode);

        if (!result || !result.elements || !Array.isArray(result.elements) || result.elements.length === 0) {
            return {
                elements: [],
                success: false,
                error: "Mermaid parsing returned no elements",
            };
        }

        // 转换为 Excalidraw 元素格式，确保所有必要属性存在
        const processedElements = result.elements.map((el, index) => {
            // 基础属性
            const baseElement = {
                id: el.id || `mermaid-${Date.now()}-${index}`,
                type: el.type || "rectangle",
                x: el.x || 0,
                y: el.y || 0,
                width: el.width || 100,
                height: el.height || 50,
                angle: el.angle || 0,
                strokeColor: el.strokeColor || "#1e1e1e",
                backgroundColor: el.backgroundColor || "transparent",
                fillStyle: el.fillStyle || "solid",
                strokeWidth: el.strokeWidth || 2,
                strokeStyle: el.strokeStyle || "solid",
                roughness: el.roughness || 1,
                opacity: el.opacity || 100,
                groupIds: el.groupIds || [],
                frameId: el.frameId || null,
                roundness: el.roundness || null,
                seed: el.seed || Math.floor(Math.random() * 2147483647),
                version: el.version || 1,
                versionNonce: Math.floor(Math.random() * 1000000000),
                isDeleted: false,
                updated: Date.now(),
                boundElements: el.boundElements || null,
                link: el.link || null,
                locked: el.locked || false,
            };

            // 根据类型添加特定属性
            if (el.type === "text") {
                return {
                    ...baseElement,
                    text: el.text || "",
                    fontSize: el.fontSize || 16,
                    fontFamily: el.fontFamily || 1,
                    textAlign: el.textAlign || "center",
                    verticalAlign: el.verticalAlign || "middle",
                    baseline: el.baseline || 0,
                    containerId: el.containerId || null,
                    originalText: el.originalText || el.text || "",
                    autoResize: el.autoResize !== undefined ? el.autoResize : true,
                    lineHeight: el.lineHeight || 1.25,
                };
            }

            if (el.type === "arrow" || el.type === "line") {
                return {
                    ...baseElement,
                    points: el.points || [[0, 0], [100, 0]],
                    lastCommittedPoint: el.lastCommittedPoint || null,
                    startBinding: el.startBinding || null,
                    endBinding: el.endBinding || null,
                    startArrowhead: el.startArrowhead || null,
                    endArrowhead: el.type === "arrow" ? (el.endArrowhead || "arrow") : null,
                };
            }

            return baseElement;
        });

        return {
            elements: processedElements as ExcalidrawElement[],
            success: true,
        };
    } catch (error) {
        console.error("Mermaid conversion failed:", error);
        return {
            elements: [],
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
