/**
 * 专业版增强服务
 * 协调 AI 分析和专业版 Draw.io 生成
 */

import { chat } from "./llm-client";
import {
    ANALYSIS_SYSTEM_PROMPT,
    buildAnalysisPrompt,
    parseAnalysisResult,
    suggestEnhancementOptions,
    AnalysisResult,
    SwimlaneInfo,
} from "./enhancement-prompts";
import {
    generateProfessionalDrawioXml,
    excalidrawToProfessionalData,
} from "@/lib/converters/drawio-professional";
import {
    EnhancementOptions,
    DEFAULT_ENHANCEMENT_OPTIONS,
} from "@/types/diagram-file";

// ============= 类型定义 =============

/**
 * 增强请求参数
 */
export interface EnhanceRequest {
    // Excalidraw 元素
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[];
    // 图表类型
    diagramType?: string;
    // 增强选项（可选，不传则使用智能推荐）
    options?: Partial<EnhancementOptions>;
    // 是否使用 AI 分析（默认 true）
    useAIAnalysis?: boolean;
}

/**
 * 增强结果
 */
export interface EnhanceResult {
    success: boolean;
    // 专业版 Draw.io XML
    drawioXml?: string;
    // 使用的增强选项
    options?: EnhancementOptions;
    // AI 分析结果
    analysisResult?: AnalysisResult;
    // 错误信息
    error?: string;
}

/**
 * 分析请求参数
 */
export interface AnalyzeRequest {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[];
    diagramType?: string;
}

// ============= 辅助函数 =============

/**
 * 从 Excalidraw 元素提取节点和连线信息
 */
function extractNodesAndEdges(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[]
): {
    nodes: Array<{ id: string; label: string; type?: string }>;
    edges: Array<{ id: string; source: string; target: string; label?: string }>;
} {
    const nodes: Array<{ id: string; label: string; type?: string }> = [];
    const edges: Array<{ id: string; source: string; target: string; label?: string }> = [];

    // 提取形状元素
    const shapes = elements.filter(el =>
        !el.isDeleted &&
        (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond")
    );

    // 提取文本元素
    const texts = elements.filter(el => !el.isDeleted && el.type === "text");

    // 提取箭头元素
    const arrows = elements.filter(el => !el.isDeleted && el.type === "arrow");

    // 映射形状到节点
    for (const shape of shapes) {
        // 查找绑定的文本
        let label = "";
        const boundText = texts.find(t => t.containerId === shape.id);
        if (boundText) {
            label = boundText.text || "";
        }

        // 确定类型
        let type = "process";
        if (shape.type === "ellipse") type = "start";
        if (shape.type === "diamond") type = "decision";

        nodes.push({ id: shape.id, label: label || "未命名", type });
    }

    // 映射箭头到连线
    for (const arrow of arrows) {
        const sourceId = arrow.startBinding?.elementId;
        const targetId = arrow.endBinding?.elementId;

        if (sourceId && targetId) {
            let label = "";
            const boundText = texts.find(t => t.containerId === arrow.id);
            if (boundText) label = boundText.text || "";

            edges.push({ id: arrow.id, source: sourceId, target: targetId, label });
        }
    }

    return { nodes, edges };
}

/**
 * 智能检测泳道（不使用 AI 时的本地算法）
 */
function detectSwimlanesLocally(
    nodes: Array<{ id: string; label: string; type?: string }>
): SwimlaneInfo[] {
    // 简单的关键词检测
    const swimlaneKeywords: Record<string, string[]> = {
        "用户": ["用户", "客户", "顾客", "User", "Customer"],
        "系统": ["系统", "服务", "后端", "System", "Service", "Backend"],
        "管理员": ["管理", "审核", "Admin", "Manager"],
        "数据库": ["数据", "存储", "DB", "Database", "Storage"],
    };

    const swimlanes: Map<string, string[]> = new Map();

    for (const node of nodes) {
        let assigned = false;
        const labelLower = node.label.toLowerCase();

        for (const [swimlaneName, keywords] of Object.entries(swimlaneKeywords)) {
            if (keywords.some(kw => labelLower.includes(kw.toLowerCase()))) {
                const existing = swimlanes.get(swimlaneName) || [];
                existing.push(node.id);
                swimlanes.set(swimlaneName, existing);
                assigned = true;
                break;
            }
        }

        // 未分配的放入"流程"泳道
        if (!assigned) {
            const existing = swimlanes.get("流程") || [];
            existing.push(node.id);
            swimlanes.set("流程", existing);
        }
    }

    // 转换为数组
    const result: SwimlaneInfo[] = [];
    for (const [name, nodeIds] of swimlanes) {
        if (nodeIds.length > 0) {
            result.push({ name, nodeIds });
        }
    }

    return result;
}

// ============= 核心服务函数 =============

/**
 * 分析图表（使用 AI）
 */
export async function analyzeDiagram(request: AnalyzeRequest): Promise<AnalysisResult | null> {
    try {
        const { nodes, edges } = extractNodesAndEdges(request.elements);

        if (nodes.length === 0) {
            console.warn("[Enhancement] No nodes found in elements");
            return null;
        }

        const prompt = buildAnalysisPrompt(nodes, edges, request.diagramType);

        const response = await chat([
            { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
            { role: "user", content: prompt },
        ]);

        if (!response || !response.content) {
            console.warn("[Enhancement] Empty AI response");
            return null;
        }

        return parseAnalysisResult(response.content);
    } catch (error) {
        console.error("[Enhancement] Analysis failed:", error);
        return null;
    }
}

/**
 * 合并增强选项
 */
function mergeOptions(
    userOptions: Partial<EnhancementOptions> | undefined,
    suggestedOptions: Partial<EnhancementOptions>
): EnhancementOptions {
    const base = { ...DEFAULT_ENHANCEMENT_OPTIONS };

    // 先应用智能建议
    if (suggestedOptions.level) base.level = suggestedOptions.level;
    if (suggestedOptions.structure) {
        base.structure = { ...base.structure, ...suggestedOptions.structure };
    }
    if (suggestedOptions.nodes) {
        base.nodes = { ...base.nodes, ...suggestedOptions.nodes };
    }
    if (suggestedOptions.edges) {
        base.edges = { ...base.edges, ...suggestedOptions.edges };
    }
    if (suggestedOptions.style) {
        base.style = { ...base.style, ...suggestedOptions.style };
    }

    // 再应用用户选项
    if (userOptions) {
        if (userOptions.level) base.level = userOptions.level;
        if (userOptions.structure) {
            base.structure = { ...base.structure, ...userOptions.structure };
        }
        if (userOptions.nodes) {
            base.nodes = { ...base.nodes, ...userOptions.nodes };
        }
        if (userOptions.edges) {
            base.edges = { ...base.edges, ...userOptions.edges };
        }
        if (userOptions.style) {
            base.style = { ...base.style, ...userOptions.style };
        }
    }

    return base;
}

/**
 * 主增强入口
 */
export async function enhance(request: EnhanceRequest): Promise<EnhanceResult> {
    try {
        console.log("[Enhancement] Starting enhancement...");

        const { elements, diagramType, options: userOptions, useAIAnalysis = true } = request;

        if (!elements || elements.length === 0) {
            return { success: false, error: "没有可增强的元素" };
        }

        // 1. 提取节点和连线信息
        const { nodes, edges } = extractNodesAndEdges(elements);
        console.log(`[Enhancement] Found ${nodes.length} nodes and ${edges.length} edges`);

        if (nodes.length === 0) {
            return { success: false, error: "未找到图表节点" };
        }

        // 2. 智能推荐选项
        const hasDecisions = nodes.some(n => n.type === "decision");
        const suggestedOptions = suggestEnhancementOptions(
            nodes.length,
            edges.length,
            hasDecisions,
            diagramType
        );

        // 3. 合并选项
        const finalOptions = mergeOptions(userOptions, suggestedOptions);
        console.log("[Enhancement] Options:", finalOptions);

        // 4. AI 分析（可选）
        let analysisResult: AnalysisResult | null = null;

        if (useAIAnalysis && finalOptions.structure.addSwimlanes) {
            console.log("[Enhancement] Running AI analysis...");
            analysisResult = await analyzeDiagram({ elements, diagramType });

            if (analysisResult) {
                console.log("[Enhancement] AI analysis complete:", {
                    swimlanes: analysisResult.swimlanes.length,
                    nodeEnhancements: analysisResult.nodeEnhancements.length,
                });
            }
        }

        // 5. 如果没有 AI 分析但需要泳道，使用本地检测
        if (!analysisResult && finalOptions.structure.addSwimlanes) {
            console.log("[Enhancement] Using local swimlane detection...");
            const localSwimlanes = detectSwimlanesLocally(nodes);
            analysisResult = {
                swimlanes: localSwimlanes,
                parallelBranches: [],
                nodeEnhancements: [],
                edgeEnhancements: [],
            };
        }

        // 6. 转换为专业版数据
        const professionalData = excalidrawToProfessionalData(elements, analysisResult || undefined);

        // 7. 生成专业版 XML
        console.log("[Enhancement] Generating professional XML...");
        const drawioXml = generateProfessionalDrawioXml(
            professionalData,
            finalOptions,
            analysisResult || undefined
        );

        console.log("[Enhancement] Enhancement complete");

        return {
            success: true,
            drawioXml,
            options: finalOptions,
            analysisResult: analysisResult || undefined,
        };
    } catch (error) {
        console.error("[Enhancement] Enhancement failed:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "增强过程出错",
        };
    }
}

/**
 * 快速增强（不使用 AI 分析）
 */
export async function quickEnhance(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[],
    options?: Partial<EnhancementOptions>
): Promise<EnhanceResult> {
    return enhance({
        elements,
        options,
        useAIAnalysis: false,
    });
}

/**
 * 完整增强（使用 AI 分析）
 */
export async function fullEnhance(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[],
    diagramType?: string,
    options?: Partial<EnhancementOptions>
): Promise<EnhanceResult> {
    return enhance({
        elements,
        diagramType,
        options,
        useAIAnalysis: true,
    });
}
