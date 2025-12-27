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
 *
 * 使用官方的 convertToExcalidrawElements 函数将骨架元素转换为完整元素
 * 这会自动处理：
 * 1. label 属性 → 创建绑定的 text 元素（containerId/boundElements）
 * 2. start/end 属性 → 创建连线绑定（startBinding/endBinding）
 * 3. 生成所有必需的属性（id, seed, version 等）
 */
export async function convertMermaidToElements(
    mermaidCode: string
): Promise<{ elements: ExcalidrawElement[]; files: Record<string, unknown>; success: boolean; error?: string }> {
    try {
        console.log("[Mermaid] Starting conversion...");

        // 使用官方配置解析 Mermaid 代码
        const result = await parseMermaidToExcalidraw(mermaidCode, {
            themeVariables: {
                fontSize: "16px",
            },
        });

        if (!result || !result.elements || !Array.isArray(result.elements) || result.elements.length === 0) {
            console.warn("[Mermaid] No elements returned");
            return {
                elements: [],
                files: {},
                success: false,
                error: "Mermaid parsing returned no elements",
            };
        }

        console.log("[Mermaid] Skeleton elements count:", result.elements.length);

        // 动态导入以避免 SSR 构建时的 "window is not defined" 错误
        const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");

        // 使用官方的 convertToExcalidrawElements 函数将骨架元素转换为完整元素
        // 这会自动处理：
        // - label 嵌套对象 → 创建绑定的 text 元素
        // - start/end 属性 → 创建 startBinding/endBinding
        // - 生成完整的元素属性（id, seed, version, boundElements 等）
        const rawElements = convertToExcalidrawElements(result.elements, {
            regenerateIds: false, // 保留原始 ID 以维持绑定关系
        }) as ExcalidrawElement[];

        // 后处理：normalize 箭头元素的 points，确保第一个点是 [0, 0]
        // 这可以避免 "Linear element is not normalized" 错误
        const elements = rawElements.map(el => {
            if ((el.type === "arrow" || el.type === "line") && el.points && el.points.length > 0) {
                const firstPoint = el.points[0];
                // 如果第一个点不是 [0, 0]，需要 normalize
                if (firstPoint[0] !== 0 || firstPoint[1] !== 0) {
                    const offsetX = firstPoint[0];
                    const offsetY = firstPoint[1];
                    const normalizedPoints = el.points.map((p: [number, number]) => [
                        p[0] - offsetX,
                        p[1] - offsetY,
                    ] as [number, number]);
                    return {
                        ...el,
                        x: el.x + offsetX,
                        y: el.y + offsetY,
                        points: normalizedPoints,
                    };
                }
            }
            return el;
        });

        console.log("[Mermaid] Converted elements count:", elements.length);
        console.log("[Mermaid] Element types:", elements.map(el => el.type));

        // 调试：打印第一个容器元素和其绑定的文本
        const container = elements.find(el => el.type === "rectangle" || el.type === "diamond" || el.type === "ellipse");
        if (container) {
            console.log("[Mermaid] First container:", {
                id: container.id,
                type: container.type,
                boundElements: container.boundElements,
            });
            const boundText = elements.find(el => el.type === "text" && el.containerId === container.id);
            if (boundText) {
                console.log("[Mermaid] Bound text:", {
                    id: boundText.id,
                    text: boundText.text,
                    containerId: boundText.containerId,
                });
            }
        }

        // 调试：打印第一个箭头元素的绑定信息
        const arrow = elements.find(el => el.type === "arrow");
        if (arrow) {
            console.log("[Mermaid] First arrow:", {
                id: arrow.id,
                startBinding: arrow.startBinding,
                endBinding: arrow.endBinding,
            });
        }

        return {
            elements,
            files: result.files || {},
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
