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
        const elements: ExcalidrawElement[] = [];

        result.elements.forEach((el: any, index: number) => {
            // 确保 ID 存在
            const id = el.id || `mermaid-${Date.now()}-${index}`;
            const now = Date.now();

            // 基础属性默认值
            const base: any = {
                id,
                x: typeof el.x === 'number' ? el.x : 0,
                y: typeof el.y === 'number' ? el.y : 0,
                strokeColor: el.strokeColor || "#1e1e1e",
                backgroundColor: el.backgroundColor || "transparent",
                fillStyle: el.fillStyle || "solid",
                strokeWidth: typeof el.strokeWidth === 'number' ? el.strokeWidth : 2,
                strokeStyle: el.strokeStyle || "solid",
                roughness: typeof el.roughness === 'number' ? el.roughness : 1,
                opacity: typeof el.opacity === 'number' ? el.opacity : 100,
                groupIds: Array.isArray(el.groupIds) ? el.groupIds : [],
                frameId: el.frameId || null,
                roundness: el.roundness || null,
                seed: typeof el.seed === 'number' ? el.seed : Math.floor(Math.random() * 2147483647),
                version: typeof el.version === 'number' ? el.version : 1,
                versionNonce: Math.floor(Math.random() * 1000000000),
                isDeleted: false,
                boundElements: Array.isArray(el.boundElements) ? el.boundElements : [], // 初始化为空数组
                updated: now,
                link: el.link || null,
                locked: el.locked || false,
            };

            // 处理类型和特有属性
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
                    base.textAlign = el.textAlign || "center";
                    base.verticalAlign = el.verticalAlign || "middle";
                    base.containerId = el.containerId || null;
                    base.originalText = el.originalText || base.text;
                    base.autoResize = true;
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
                        : [[0, 0], [100, 100]];
                    base.lastCommittedPoint = null;
                    base.startBinding = el.startBinding || null;
                    base.endBinding = el.endBinding || null;
                    base.startArrowhead = el.startArrowhead || null;
                    base.endArrowhead = el.endArrowhead || (el.type === "arrow" ? "arrow" : null);

                    // 处理连线上的标签 (label 属性)
                    if (el.label && el.label.text) {
                        const labelId = `${id}-label`;
                        const labelText = el.label.text;
                        // 计算连线中心简单估算
                        const midX = base.x + (base.points[0][0] + base.points[base.points.length - 1][0]) / 2;
                        const midY = base.y + (base.points[0][1] + base.points[base.points.length - 1][1]) / 2;

                        const textElement: any = {
                            id: labelId,
                            type: "text",
                            x: midX,
                            y: midY,
                            width: labelText.length * 8 + 10, // 估算宽度
                            height: 20,
                            angle: 0,
                            strokeColor: "#1e1e1e",
                            backgroundColor: "transparent",
                            fillStyle: "solid",
                            strokeWidth: 1,
                            strokeStyle: "solid",
                            roughness: 1,
                            opacity: 100,
                            groupIds: [],
                            frameId: null,
                            roundness: null,
                            seed: Math.floor(Math.random() * 2147483647),
                            version: 1,
                            versionNonce: Math.floor(Math.random() * 1000000000),
                            isDeleted: false,
                            boundElements: null,
                            updated: now,
                            link: null,
                            locked: false,
                            text: labelText,
                            fontSize: 16,
                            fontFamily: 1,
                            textAlign: "center",
                            verticalAlign: "middle",
                            containerId: null, // 连线标签通常不作为容器内容，而是独立元素
                            originalText: labelText,
                            autoResize: true,
                        };
                        elements.push(textElement);
                    }
                    break;

                default:
                    console.warn(`[Mermaid] Unknown element type: ${el.type}, falling back to rectangle`);
                    base.type = "rectangle";
                    base.width = typeof el.width === 'number' ? el.width : 50;
                    base.height = typeof el.height === 'number' ? el.height : 50;
                    base.angle = 0;
            }

            // 先添加基础元素 (容器/底座)
            elements.push(base as ExcalidrawElement);

            // 处理容器元素的 Label (嵌套对象) -> 转换为绑定的 Text 元素 (放在容器上方)
            if ((base.type === "rectangle" || base.type === "diamond" || base.type === "ellipse") && el.label && el.label.text) {
                const textId = `${id}-text`;
                const labelText = el.label.text;

                // 估算文本尺寸，避免 autoResize 冲突导致的无限递归
                const lines = labelText.split('\n');
                const lineCount = lines.length;
                const maxLineLength = Math.max(...lines.map((l: string) => l.length));
                // 粗略估算：每个字符宽 12px (留足余量)，高 25px
                const estimatedWidth = maxLineLength * 12 + 20;
                const estimatedHeight = lineCount * 25;

                // 创建绑定的文本元素
                const textElement: any = {
                    id: textId,
                    type: "text",
                    x: base.x + base.width / 2 - estimatedWidth / 2, // 居中
                    y: base.y + base.height / 2 - estimatedHeight / 2,
                    width: estimatedWidth,
                    height: estimatedHeight,
                    angle: 0,
                    strokeColor: el.label.strokeColor || "#1e1e1e",
                    backgroundColor: "transparent",
                    fillStyle: "solid",
                    strokeWidth: 1,
                    strokeStyle: "solid",
                    roughness: 1,
                    opacity: 100,
                    groupIds: base.groupIds,
                    frameId: null,
                    roundness: null,
                    seed: Math.floor(Math.random() * 2147483647),
                    version: 1,
                    versionNonce: Math.floor(Math.random() * 1000000000),
                    isDeleted: false,
                    boundElements: null,
                    updated: now,
                    link: null,
                    locked: false,
                    text: labelText,
                    fontSize: el.label.fontSize || 16,
                    fontFamily: 1,
                    textAlign: "center",
                    verticalAlign: "middle",
                    containerId: null, // 解除绑定，避免布局死循环
                    originalText: labelText,
                    autoResize: false, // 保持禁用自动调整
                };

                // 不再通过 boundElements 绑定，仅通过 groupIds 组合
                // 这样可以避免 Excalidraw 内部的布局更新死循环
                // if (!base.boundElements) {
                //     base.boundElements = [];
                // }
                // base.boundElements.push({ id: textId, type: "text" });

                // 将文本元素加入结果列表 (在容器之后)
                elements.push(textElement);

                // --- 4. 建立分组关系 (Group) ---
                // 生成一个新的 Group ID 将容器和文本组合在一起
                // 这样移动容器时，文本也会跟随 (且不需要 containerId 绑定)
                const newGroupId = `group-${id}-${now}`;

                // 确保 groupIds 数组存在
                if (!base.groupIds) base.groupIds = [];
                if (!textElement.groupIds) textElement.groupIds = [];

                // 添加 Group ID
                base.groupIds.push(newGroupId);
                textElement.groupIds.push(newGroupId);
            }

            // 处理 arrow/line 的绑定信息
            if (el.type === "arrow" || el.type === "line") {
                // (逻辑保持不变)
            }
        });

        // --- 5. 全局 Z-Index 排序 ---
        // 强制重排元素顺序，确保：
        // 1. 连线 (arrow/line) 在最底层
        // 2. 形状 (rectangle/diamond/ellipse) 在中间
        // 3. 文字 (text) 在最顶层
        elements.sort((a, b) => {
            const getScore = (el: ExcalidrawElement) => {
                if (el.type === "arrow" || el.type === "line") return 1;
                if (el.type === "text") return 3; // 文字永远在最上
                return 2; // 其他形状
            };
            return getScore(a) - getScore(b);
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
