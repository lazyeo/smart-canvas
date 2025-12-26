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
/**
 * 将 Mermaid 代码转换为 Excalidraw 元素
 */
export async function convertMermaidToElements(
    mermaidCode: string
): Promise<{ elements: ExcalidrawElement[]; files: Record<string, unknown>; success: boolean; error?: string }> {
    try {
        console.log("[Mermaid] Starting conversion...");

        // 使用官方配置
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

        console.log("[Mermaid] Raw elements count:", result.elements.length);

        // 深度调试：打印第一个原始元素结构，以便分析缺失属性
        if (result.elements.length > 0) {
            console.log("[Mermaid] First raw element:", JSON.stringify(result.elements[0]));
        }

        // 转换为符合 ExcalidrawElement 接口的完整对象
        const elements = result.elements.map((el: any, index: number) => {
            // 确保 ID 存在
            const id = el.id || `mermaid-${Date.now()}-${index}`;

            // 基础属性默认值 (必须与 ExcalidrawElement 接口匹配)
            const base: any = {
                id,
                x: typeof el.x === 'number' ? el.x : 0,
                y: typeof el.y === 'number' ? el.y : 0,
                strokeColor: el.strokeColor || "#1e1e1e",
                backgroundColor: el.backgroundColor || "transparent",
                fillStyle: el.fillStyle || "solid",
                strokeWidth: typeof el.strokeWidth === 'number' ? el.strokeWidth : 2,
                strokeStyle: el.strokeStyle || "solid", // solid, dashed, dotted
                roughness: typeof el.roughness === 'number' ? el.roughness : 1,
                opacity: typeof el.opacity === 'number' ? el.opacity : 100,
                groupIds: Array.isArray(el.groupIds) ? el.groupIds : [],
                frameId: el.frameId || null,
                roundness: el.roundness || null,
                seed: typeof el.seed === 'number' ? el.seed : Math.floor(Math.random() * 2147483647),
                version: typeof el.version === 'number' ? el.version : 1,
                versionNonce: Math.floor(Math.random() * 1000000000),
                isDeleted: false,
                boundElements: Array.isArray(el.boundElements) ? el.boundElements : null,
                updated: Date.now(),
                link: el.link || null,
                locked: el.locked || false,
            };

            // 根据类型补充特定属性
            switch (el.type) {
                case "rectangle":
                case "diamond":
                case "ellipse":
                    base.type = el.type;
                    base.width = typeof el.width === 'number' ? el.width : 100;
                    base.height = typeof el.height === 'number' ? el.height : 100;
                    base.angle = typeof el.angle === 'number' ? el.angle : 0;
                    break;

                case "text":
                    base.type = "text";
                    base.text = el.text || "";
                    base.fontSize = typeof el.fontSize === 'number' ? el.fontSize : 16;
                    base.fontFamily = typeof el.fontFamily === 'number' ? el.fontFamily : 1;
                    base.textAlign = el.textAlign || "center"; // left, center, right
                    base.verticalAlign = el.verticalAlign || "middle"; // top, middle, bottom
                    base.containerId = el.containerId || null;
                    base.originalText = el.originalText || base.text;
                    base.autoResize = true;
                    // text 元素也需要 width/height/angle，通常库会返回，如果没有则给个默认值
                    base.width = typeof el.width === 'number' ? el.width : 10;
                    base.height = typeof el.height === 'number' ? el.height : 10;
                    base.angle = typeof el.angle === 'number' ? el.angle : 0;
                    break;

                case "arrow":
                case "line":
                    base.type = el.type;
                    base.width = typeof el.width === 'number' ? el.width : 100;
                    base.height = typeof el.height === 'number' ? el.height : 100;
                    base.angle = typeof el.angle === 'number' ? el.angle : 0;
                    base.points = Array.isArray(el.points) && el.points.length > 0
                        ? el.points
                        : [[0, 0], [100, 100]]; // 默认两点
                    base.lastCommittedPoint = null;
                    base.startBinding = el.startBinding || null;
                    base.endBinding = el.endBinding || null;
                    base.startArrowhead = el.startArrowhead || null;
                    base.endArrowhead = el.endArrowhead || (el.type === "arrow" ? "arrow" : null);
                    break;

                default:
                    // 对于未知类型，回退到矩形以防止崩溃
                    console.warn(`[Mermaid] Unknown element type: ${el.type}, falling back to rectangle`);
                    base.type = "rectangle";
                    base.width = typeof el.width === 'number' ? el.width : 50;
                    base.height = typeof el.height === 'number' ? el.height : 50;
                    base.angle = 0;
            }

            return base as ExcalidrawElement;
        });

        console.log("[Mermaid] Processed elements:", elements.length);

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
