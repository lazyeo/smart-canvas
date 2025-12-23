/**
 * 增量编辑服务
 * 负责处理 AI 增量编辑请求，构建局部更新 Prompt，应用增量变化
 */

import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";
import { ShadowNode, ShadowEdge } from "@/types";
import { SelectionContext } from "./selection-context";
import { chatStream, LLMMessage, StreamCallbacks } from "./llm-client";

/**
 * 编辑操作类型
 */
export type EditOperation =
    | "modify"      // 修改节点属性
    | "add"         // 添加新节点
    | "delete"      // 删除节点
    | "connect"     // 添加连线
    | "disconnect"  // 删除连线
    | "restyle"     // 修改样式
    | "relayout";   // 重新布局

/**
 * 增量编辑请求
 */
export interface IncrementalEditRequest {
    // 用户指令
    instruction: string;

    // 选中上下文
    context: SelectionContext;

    // 操作类型（可选，AI 可以自动推断）
    operation?: EditOperation;

    // 额外参数
    params?: Record<string, unknown>;
}

/**
 * 增量编辑结果
 */
export interface IncrementalEditResult {
    success: boolean;

    // 变化的节点
    nodesToAdd: Partial<ShadowNode>[];
    nodesToUpdate: { id: string; changes: Partial<ShadowNode> }[];
    nodesToDelete: string[];

    // 变化的连线
    edgesToAdd: Partial<ShadowEdge>[];
    edgesToUpdate: { id: string; changes: Partial<ShadowEdge> }[];
    edgesToDelete: string[];

    // AI 响应说明
    explanation: string;

    // 错误信息
    error?: string;
}

/**
 * 增量编辑系统提示词
 */
const INCREMENTAL_EDIT_SYSTEM_PROMPT = `你是一个专业的图表编辑助手。用户会提供当前选中的节点/连线信息，以及编辑指令。
你需要分析用户的意图，并返回增量更新的 JSON 数据。

## 返回格式
请返回以下 JSON 格式：
\`\`\`json
{
  "operation": "modify|add|delete|connect|disconnect|restyle|relayout",
  "explanation": "对操作的简短说明",
  "nodesToAdd": [
    {"id": "new-1", "type": "process", "label": "新节点", "row": 0, "column": 0}
  ],
  "nodesToUpdate": [
    {"id": "existing-id", "changes": {"label": "新标签"}}
  ],
  "nodesToDelete": ["node-id-1"],
  "edgesToAdd": [
    {"id": "edge-1", "source": "node-a", "target": "node-b", "label": "可选标签"}
  ],
  "edgesToUpdate": [
    {"id": "edge-id", "changes": {"label": "新标签"}}
  ],
  "edgesToDelete": ["edge-id-1"]
}
\`\`\`

## 规则
1. 只返回需要变化的部分，不要返回未改变的节点/连线
2. 新增节点需要指定 row/column 逻辑位置
3. 删除节点时，相关连线会自动删除
4. 始终用中文解释操作
5. 只返回 JSON，不要其他内容`;

/**
 * 构建增量编辑 Prompt
 */
export function buildIncrementalEditPrompt(request: IncrementalEditRequest): string {
    const parts: string[] = [];

    // 上下文信息
    parts.push("## 当前选中的内容");
    parts.push(request.context.description);

    // 节点详情
    if (request.context.nodes.length > 0) {
        parts.push("\n## 选中节点详情");
        for (const node of request.context.nodes) {
            parts.push(`- ID: ${node.id}`);
            parts.push(`  类型: ${node.type}`);
            parts.push(`  标签: ${node.label}`);
            parts.push(`  位置: 行${node.logicalPosition.row}, 列${node.logicalPosition.column}`);
        }
    }

    // 连线详情
    if (request.context.relatedEdges.length > 0) {
        parts.push("\n## 相关连线详情");
        for (const edge of request.context.relatedEdges) {
            const sourceNode = request.context.nodes.find((n) => n.id === edge.sourceNodeId);
            const targetNode = request.context.nodes.find((n) => n.id === edge.targetNodeId);
            parts.push(`- ID: ${edge.id}`);
            parts.push(`  从: ${sourceNode?.label || edge.sourceNodeId}`);
            parts.push(`  到: ${targetNode?.label || edge.targetNodeId}`);
            if (edge.label) {
                parts.push(`  标签: ${edge.label}`);
            }
        }
    }

    // 用户指令
    parts.push("\n## 用户编辑指令");
    parts.push(request.instruction);

    return parts.join("\n");
}

/**
 * 解析增量编辑响应
 */
export function parseIncrementalEditResponse(response: string): IncrementalEditResult | null {
    console.log("Parsing incremental edit response:", response.substring(0, 500));

    try {
        // 尝试多种 JSON 提取方式
        let jsonStr = "";

        // 方式1: ```json 代码块
        const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
            jsonStr = jsonBlockMatch[1];
            console.log("Found JSON in code block");
        }

        // 方式2: ``` 通用代码块
        if (!jsonStr) {
            const codeBlockMatch = response.match(/```\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1];
                console.log("Found JSON in generic code block");
            }
        }

        // 方式3: 直接查找 JSON 对象
        if (!jsonStr) {
            const jsonObjectMatch = response.match(/\{[\s\S]*"(?:operation|explanation|nodesToAdd|nodesToUpdate|nodesToDelete)"[\s\S]*\}/);
            if (jsonObjectMatch) {
                jsonStr = jsonObjectMatch[0];
                console.log("Found JSON object directly");
            }
        }

        // 方式4: 整个响应作为 JSON
        if (!jsonStr) {
            jsonStr = response.trim();
            console.log("Using entire response as JSON");
        }

        // 清理可能的问题
        jsonStr = jsonStr.trim();

        // 尝试修复常见问题
        // 移除 BOM
        if (jsonStr.charCodeAt(0) === 0xFEFF) {
            jsonStr = jsonStr.slice(1);
        }

        // 移除开头的 JSON 标记
        if (jsonStr.toLowerCase().startsWith("json")) {
            jsonStr = jsonStr.slice(4).trim();
        }

        console.log("Attempting to parse:", jsonStr.substring(0, 200));

        const data = JSON.parse(jsonStr);

        return {
            success: true,
            nodesToAdd: Array.isArray(data.nodesToAdd) ? data.nodesToAdd : [],
            nodesToUpdate: Array.isArray(data.nodesToUpdate) ? data.nodesToUpdate : [],
            nodesToDelete: Array.isArray(data.nodesToDelete) ? data.nodesToDelete : [],
            edgesToAdd: Array.isArray(data.edgesToAdd) ? data.edgesToAdd : [],
            edgesToUpdate: Array.isArray(data.edgesToUpdate) ? data.edgesToUpdate : [],
            edgesToDelete: Array.isArray(data.edgesToDelete) ? data.edgesToDelete : [],
            explanation: data.explanation || "操作完成",
        };
    } catch (error) {
        console.warn("JSON parse failed, trying fallback extraction:", error);

        // 尝试从错误中恢复 - 提取简单操作
        try {
            const result = extractSimpleOperation(response);
            if (result) {
                console.log("Fallback extraction successful:", result.explanation);
                return result;
            }
            console.warn("Fallback extraction returned null");
            return null;
        } catch {
            console.warn("Fallback extraction failed");
            return null;
        }
    }
}

/**
 * 尝试从自然语言响应中提取简单操作
 */
function extractSimpleOperation(response: string): IncrementalEditResult | null {
    const lowerResponse = response.toLowerCase();

    // 检测删除操作
    if (lowerResponse.includes("删除") || lowerResponse.includes("移除")) {
        return {
            success: true,
            nodesToAdd: [],
            nodesToUpdate: [],
            nodesToDelete: ["selected"],
            edgesToAdd: [],
            edgesToUpdate: [],
            edgesToDelete: [],
            explanation: "删除选中的元素",
        };
    }

    // 检测添加操作
    if (lowerResponse.includes("添加") || lowerResponse.includes("新增")) {
        // 尝试提取标签
        const labelMatch = response.match(/[「"']([^「」"']+)[」"']/);
        const label = labelMatch ? labelMatch[1] : "新节点";

        return {
            success: true,
            nodesToAdd: [{ id: `node-${Date.now()}`, type: "process", label }],
            nodesToUpdate: [],
            nodesToDelete: [],
            edgesToAdd: [],
            edgesToUpdate: [],
            edgesToDelete: [],
            explanation: `添加节点: ${label}`,
        };
    }

    // 检测修改操作
    if (lowerResponse.includes("修改") || lowerResponse.includes("改为")) {
        const labelMatch = response.match(/(?:改为|修改为|改成)[「"':]?\s*([^「」"'\n,，]+)/);
        if (labelMatch) {
            const newLabel = labelMatch[1].trim();
            return {
                success: true,
                nodesToAdd: [],
                nodesToUpdate: [{ id: "selected", changes: { label: newLabel } }],
                nodesToDelete: [],
                edgesToAdd: [],
                edgesToUpdate: [],
                edgesToDelete: [],
                explanation: `修改文字为: ${newLabel}`,
            };
        }
    }

    // 检测连线操作
    if (lowerResponse.includes("连接") || lowerResponse.includes("连线") ||
        lowerResponse.includes("指向") || lowerResponse.includes("箭头")) {
        return {
            success: true,
            nodesToAdd: [],
            nodesToUpdate: [],
            nodesToDelete: [],
            edgesToAdd: [{ id: `edge-${Date.now()}`, sourceNodeId: "selected-0", targetNodeId: "selected-1", label: "" }],
            edgesToUpdate: [],
            edgesToDelete: [],
            explanation: "在选中的两个节点之间添加连线",
        };
    }

    return null;
}

/**
 * 执行增量编辑（流式）
 */
export async function executeIncrementalEdit(
    request: IncrementalEditRequest,
    streamCallbacks: StreamCallbacks
): Promise<void> {
    const prompt = buildIncrementalEditPrompt(request);

    const messages: LLMMessage[] = [
        { role: "system", content: INCREMENTAL_EDIT_SYSTEM_PROMPT },
        { role: "user", content: prompt },
    ];

    await chatStream(messages, streamCallbacks);
}

/**
 * 增量编辑服务类
 */
export class IncrementalEditService {
    private editHistory: IncrementalEditResult[] = [];
    private maxHistorySize: number = 50;

    /**
     * 执行编辑
     */
    async edit(
        request: IncrementalEditRequest,
        onProgress?: (tokens: number) => void
    ): Promise<IncrementalEditResult> {
        return new Promise((resolve) => {
            let fullContent = "";

            executeIncrementalEdit(request, {
                onToken: (token, accumulated) => {
                    fullContent = accumulated;
                    if (onProgress) {
                        onProgress(Math.ceil(accumulated.length / 4));
                    }
                },
                onComplete: (content) => {
                    const result = parseIncrementalEditResponse(content);
                    if (result) {
                        this.addToHistory(result);
                        resolve(result);
                    } else {
                        resolve({
                            success: false,
                            nodesToAdd: [],
                            nodesToUpdate: [],
                            nodesToDelete: [],
                            edgesToAdd: [],
                            edgesToUpdate: [],
                            edgesToDelete: [],
                            explanation: "",
                            error: "无法解析 AI 响应",
                        });
                    }
                },
                onError: (error) => {
                    resolve({
                        success: false,
                        nodesToAdd: [],
                        nodesToUpdate: [],
                        nodesToDelete: [],
                        edgesToAdd: [],
                        edgesToUpdate: [],
                        edgesToDelete: [],
                        explanation: "",
                        error: error.message,
                    });
                },
            });
        });
    }

    /**
     * 添加到历史
     */
    private addToHistory(result: IncrementalEditResult): void {
        this.editHistory.push(result);
        if (this.editHistory.length > this.maxHistorySize) {
            this.editHistory.shift();
        }
    }

    /**
     * 获取编辑历史
     */
    getHistory(): IncrementalEditResult[] {
        return [...this.editHistory];
    }

    /**
     * 获取最后一次编辑
     */
    getLastEdit(): IncrementalEditResult | null {
        return this.editHistory.length > 0
            ? this.editHistory[this.editHistory.length - 1]
            : null;
    }

    /**
     * 清除历史
     */
    clearHistory(): void {
        this.editHistory = [];
    }
}

/**
 * 创建增量编辑服务实例
 */
export function createIncrementalEditService(): IncrementalEditService {
    return new IncrementalEditService();
}

/**
 * 全局默认服务
 */
let defaultService: IncrementalEditService | null = null;

export function getDefaultIncrementalEditService(): IncrementalEditService {
    if (defaultService === null) {
        defaultService = new IncrementalEditService();
    }
    return defaultService;
}
