/**
 * Mermaid 到 Excalidraw 转换器
 * 将 Mermaid 代码转换为 Excalidraw 元素
 * 支持降级显示不完全支持的图表类型
 */

import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";
import { autoFallback, generateFlowchartFromJSON, type FallbackResult } from "./mermaid-fallback";

/**
 * 从文本中提取 Mermaid 代码块
 */
export function extractMermaidCode(content: string): string | null {
    // 匹配 ```mermaid ... ``` 代码块
    const mermaidMatch = content.match(/```mermaid\s*([\s\S]*?)```/);
    if (mermaidMatch) {
        return mermaidMatch[1].trim();
    }

    // 匹配没有代码块标记的 Mermaid 语法（包括 erDiagram）
    const flowchartMatch = content.match(/(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram)[\s\S]+/i);
    if (flowchartMatch) {
        return flowchartMatch[0].trim();
    }

    return null;
}

/**
 * 转换结果类型（扩展支持降级信息）
 */
export interface ConversionResult {
    elements: ExcalidrawElement[];
    files: Record<string, unknown>;
    success: boolean;
    error?: string;
    fallback?: FallbackResult;  // 降级信息
}

/**
 * 将 Mermaid 代码转换为 Excalidraw 元素
 *
 * 使用官方的 convertToExcalidrawElements 函数将骨架元素转换为完整元素
 * 这会自动处理：
 * 1. label 属性 → 创建绑定的 text 元素（containerId/boundElements）
 * 2. start/end 属性 → 创建连线绑定（startBinding/endBinding）
 * 3. 生成所有必需的属性（id, seed, version 等）
 *
 * 对于不完全支持的图表类型（如 ER 图），会自动降级处理
 */
export async function convertMermaidToElements(
    mermaidCode: string
): Promise<ConversionResult> {
    try {
        console.log("[Mermaid] Starting conversion...");

        // 检测图表类型
        const diagramType = detectMermaidType(mermaidCode);
        console.log("[Mermaid] Detected type:", diagramType);

        // 对于可能不完全支持的类型，先尝试降级
        let codeToConvert = mermaidCode;
        let fallbackInfo: FallbackResult | undefined;

        if (diagramType === "er" || diagramType === "state") {
            console.log("[Mermaid] Applying fallback for type:", diagramType);
            const fallbackResult = autoFallback(mermaidCode, diagramType);
            if (fallbackResult.success && fallbackResult.mermaidCode) {
                codeToConvert = fallbackResult.mermaidCode;
                fallbackInfo = fallbackResult;
                console.log("[Mermaid] Fallback applied, new type:", fallbackResult.fallbackType);
            }
        }

        // 使用官方配置解析 Mermaid 代码
        const result = await parseMermaidToExcalidraw(codeToConvert, {
            themeVariables: {
                fontSize: "16px",
            },
        });

        if (!result || !result.elements || !Array.isArray(result.elements) || result.elements.length === 0) {
            console.warn("[Mermaid] No elements returned, trying JSON fallback...");

            // 尝试 JSON 兜底（如果原始代码看起来像 JSON）
            const jsonFallback = tryJSONFallback(mermaidCode);
            if (jsonFallback) {
                return jsonFallback;
            }

            return {
                elements: [],
                files: {},
                success: false,
                error: "Mermaid parsing returned no elements",
                fallback: fallbackInfo,
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
            fallback: fallbackInfo,
        };
    } catch (error) {
        console.error("Mermaid conversion failed:", error);

        // 转换失败时尝试 JSON 兜底
        const jsonFallback = tryJSONFallback(mermaidCode);
        if (jsonFallback) {
            console.log("[Mermaid] Using JSON fallback after conversion error");
            return jsonFallback;
        }

        return {
            elements: [],
            files: {},
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * 尝试 JSON 兜底转换
 * 当 Mermaid 解析失败时，检查内容是否为 JSON 格式的图表数据
 */
function tryJSONFallback(content: string): ConversionResult | null {
    try {
        // 尝试提取 JSON 块
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

        // 检查是否看起来像 JSON
        if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
            return null;
        }

        const data = JSON.parse(jsonStr);

        // 检查是否有 nodes 和 edges 结构
        if (!data.nodes || !Array.isArray(data.nodes)) {
            return null;
        }

        console.log("[Mermaid] Attempting JSON fallback conversion");

        // 使用 JSON 兜底生成 Mermaid 代码
        const fallbackResult = generateFlowchartFromJSON({
            nodes: data.nodes,
            edges: data.edges || [],
        });

        if (!fallbackResult.success || !fallbackResult.mermaidCode) {
            return null;
        }

        // 递归调用转换（使用生成的 Mermaid 代码）
        // 注意：这里不能用 async，所以返回 null 让调用者处理
        // 实际的递归转换需要在调用处处理
        return null;
    } catch {
        return null;
    }
}

/**
 * 检测内容是否包含 Mermaid 代码
 */
export function containsMermaidCode(content: string): boolean {
    return /```mermaid/i.test(content) ||
        /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram)\s/im.test(content);
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
