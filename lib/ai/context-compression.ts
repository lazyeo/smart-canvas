/**
 * 上下文压缩工具
 * 将图表状态压缩为简洁格式，减少 Token 消耗
 * 
 * 压缩格式：
 * 节点: A[用户输入] B<验证通过?> C(开始)
 * 连线: A→B B→C
 * 选中: B
 */

interface CompressedNode {
    id: string;          // 短 ID (A, B, C...)
    originalId: string;  // 原始 ID
    type: string;
    label: string;
}

interface CompressedEdge {
    source: string;      // 短 ID
    target: string;      // 短 ID
    label?: string;
}

export interface CompressedContext {
    nodes: string;       // 压缩的节点字符串
    edges: string;       // 压缩的连线字符串
    selected: string;    // 选中的短 ID
    idMap: Map<string, string>;  // 原始 ID → 短 ID
    reverseMap: Map<string, string>;  // 短 ID → 原始 ID
}

// 短 ID 生成器
const SHORT_IDS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function getShortId(index: number): string {
    if (index < 26) {
        return SHORT_IDS[index];
    }
    // 超过 26 个节点使用 A1, A2... 格式
    const prefix = SHORT_IDS[Math.floor(index / 26) - 1];
    const suffix = index % 26;
    return `${prefix}${suffix}`;
}

// 节点类型符号
const TYPE_SYMBOLS: Record<string, [string, string]> = {
    process: ["[", "]"],
    decision: ["<", ">"],
    start: ["(", ")"],
    end: ["(", ")"],
    data: ["{", "}"],
    default: ["[", "]"],
};

/**
 * 压缩节点列表
 */
export function compressNodes(
    nodes: Array<{ id: string; type: string; label: string }>,
    selectedIds: string[] = []
): CompressedContext {
    const idMap = new Map<string, string>();
    const reverseMap = new Map<string, string>();
    const nodeStrings: string[] = [];
    const selectedShortIds: string[] = [];

    nodes.forEach((node, index) => {
        const shortId = getShortId(index);
        idMap.set(node.id, shortId);
        reverseMap.set(shortId, node.id);

        const [open, close] = TYPE_SYMBOLS[node.type] || TYPE_SYMBOLS.default;
        const label = node.label.length > 15 ? node.label.substring(0, 15) + "..." : node.label;
        nodeStrings.push(`${shortId}${open}${label}${close}`);

        if (selectedIds.includes(node.id)) {
            selectedShortIds.push(shortId);
        }
    });

    return {
        nodes: nodeStrings.join(" "),
        edges: "",
        selected: selectedShortIds.join(","),
        idMap,
        reverseMap,
    };
}

/**
 * 压缩连线列表
 */
export function compressEdges(
    edges: Array<{ source: string; target: string; label?: string }>,
    idMap: Map<string, string>
): string {
    const edgeStrings: string[] = [];

    for (const edge of edges) {
        const sourceShort = idMap.get(edge.source);
        const targetShort = idMap.get(edge.target);

        if (sourceShort && targetShort) {
            if (edge.label) {
                edgeStrings.push(`${sourceShort}→[${edge.label}]→${targetShort}`);
            } else {
                edgeStrings.push(`${sourceShort}→${targetShort}`);
            }
        }
    }

    return edgeStrings.join(" ");
}

/**
 * 从 Excalidraw 元素提取并压缩上下文
 */
export function compressExcalidrawContext(
    elements: Array<{
        id: string;
        type: string;
        isDeleted?: boolean;
        text?: string;
        groupIds?: string[];
        startBinding?: { elementId: string };
        endBinding?: { elementId: string };
    }>,
    selectedIds: string[] = []
): CompressedContext {
    // 提取形状节点
    const shapeElements = elements.filter(
        (el) => !el.isDeleted && (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond")
    );

    // 构建节点列表
    const nodes: Array<{ id: string; type: string; label: string }> = [];

    for (const shape of shapeElements) {
        // 尝试找到关联的文本
        let label = "节点";
        const groupId = shape.groupIds?.[0];
        if (groupId) {
            const textEl = elements.find(
                (e) => e.type === "text" && e.groupIds?.includes(groupId) && !e.isDeleted
            );
            if (textEl && textEl.text) {
                label = textEl.text;
            }
        }

        let nodeType = "process";
        if (shape.type === "ellipse") nodeType = "start";
        if (shape.type === "diamond") nodeType = "decision";

        nodes.push({ id: shape.id, type: nodeType, label });
    }

    // 压缩节点
    const context = compressNodes(nodes, selectedIds);

    // 提取并压缩连线
    const arrows = elements.filter(
        (el) => !el.isDeleted && el.type === "arrow" && el.startBinding && el.endBinding
    );

    const edges: Array<{ source: string; target: string; label?: string }> = arrows.map((arrow) => ({
        source: arrow.startBinding!.elementId,
        target: arrow.endBinding!.elementId,
    }));

    context.edges = compressEdges(edges, context.idMap);

    return context;
}

/**
 * 生成压缩的 Prompt
 */
export function generateCompressedPrompt(context: CompressedContext, userRequest: string): string {
    const parts: string[] = [];

    if (context.nodes) {
        parts.push(`当前图表节点: ${context.nodes}`);
    }
    if (context.edges) {
        parts.push(`连线: ${context.edges}`);
    }
    if (context.selected) {
        parts.push(`选中: ${context.selected}`);
    }

    parts.push("");
    parts.push(`用户请求: ${userRequest}`);

    return parts.join("\n");
}

/**
 * 解压短 ID 到原始 ID
 */
export function expandShortId(shortId: string, reverseMap: Map<string, string>): string | undefined {
    return reverseMap.get(shortId);
}
