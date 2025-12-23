/**
 * Dagre 自动布局服务
 * 使用 Dagre 库对图表进行自动布局，优化节点位置和连线路径
 */

import dagre from "dagre";
import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";

/**
 * 布局方向
 */
export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

/**
 * 布局配置
 */
export interface LayoutOptions {
    direction: LayoutDirection;  // 布局方向
    nodeWidth: number;           // 节点宽度
    nodeHeight: number;          // 节点高度
    nodeSpacing: number;         // 节点水平间距
    rankSpacing: number;         // 层级垂直间距
}

/**
 * 默认布局配置
 */
export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
    direction: "TB",
    nodeWidth: 150,
    nodeHeight: 60,
    nodeSpacing: 50,
    rankSpacing: 80,
};

/**
 * 提取节点和边的图结构
 */
function extractGraph(
    elements: readonly ExcalidrawElement[]
): {
    nodes: Map<string, { element: ExcalidrawElement; width: number; height: number }>;
    edges: Array<{ source: string; target: string; arrowElement: ExcalidrawElement }>;
} {
    const nodes = new Map<string, { element: ExcalidrawElement; width: number; height: number }>();
    const edges: Array<{ source: string; target: string; arrowElement: ExcalidrawElement }> = [];

    // 识别节点（形状元素）
    for (const el of elements) {
        if (el.isDeleted) continue;

        if (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond") {
            nodes.set(el.id, {
                element: el,
                width: el.width || 150,
                height: el.height || 60,
            });
        }
    }

    // 识别边（箭头元素）
    for (const el of elements) {
        if (el.isDeleted) continue;

        if (el.type === "arrow") {
            // 通过 binding 获取连接关系
            if (el.startBinding && el.endBinding) {
                const sourceId = el.startBinding.elementId;
                const targetId = el.endBinding.elementId;

                if (nodes.has(sourceId) && nodes.has(targetId)) {
                    edges.push({
                        source: sourceId,
                        target: targetId,
                        arrowElement: el,
                    });
                }
            }
        }
    }

    return { nodes, edges };
}

/**
 * 使用 Dagre 计算布局
 */
export function layoutDiagram(
    elements: readonly ExcalidrawElement[],
    options: Partial<LayoutOptions> = {}
): ExcalidrawElement[] {
    const opts: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
    const { nodes, edges } = extractGraph(elements);

    // 如果没有节点或边，直接返回原样
    if (nodes.size === 0) {
        return [...elements];
    }

    // 创建 Dagre 图
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: opts.direction,
        nodesep: opts.nodeSpacing,
        ranksep: opts.rankSpacing,
        marginx: 50,
        marginy: 50,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // 添加节点
    for (const [id, node] of nodes) {
        g.setNode(id, {
            width: node.width,
            height: node.height,
        });
    }

    // 添加边
    for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
    }

    // 执行布局
    dagre.layout(g);

    // 计算位置偏移量（保持布局在合理位置）
    let minX = Infinity;
    let minY = Infinity;
    for (const nodeId of nodes.keys()) {
        const layoutNode = g.node(nodeId);
        if (layoutNode) {
            minX = Math.min(minX, layoutNode.x - layoutNode.width / 2);
            minY = Math.min(minY, layoutNode.y - layoutNode.height / 2);
        }
    }

    const offsetX = 100 - minX;
    const offsetY = 100 - minY;

    // 构建新元素数组
    const newElements: ExcalidrawElement[] = [];
    const positionMap = new Map<string, { x: number; y: number; width: number; height: number }>();

    // 更新节点位置
    for (const el of elements) {
        if (el.isDeleted) {
            newElements.push(el);
            continue;
        }

        if (nodes.has(el.id)) {
            const layoutNode = g.node(el.id);
            if (layoutNode) {
                const newX = layoutNode.x - layoutNode.width / 2 + offsetX;
                const newY = layoutNode.y - layoutNode.height / 2 + offsetY;

                positionMap.set(el.id, {
                    x: newX,
                    y: newY,
                    width: el.width || 150,
                    height: el.height || 60,
                });

                newElements.push({
                    ...el,
                    x: newX,
                    y: newY,
                    version: (el.version || 0) + 1,
                });
            } else {
                newElements.push(el);
            }
        } else if (el.type === "text" && el.containerId) {
            // 文本元素会跟随容器移动，暂时先添加
            newElements.push(el);
        } else if (el.type === "arrow") {
            // 箭头稍后处理
            continue;
        } else {
            newElements.push(el);
        }
    }

    // 更新文本元素位置（跟随容器）
    for (let i = 0; i < newElements.length; i++) {
        const el = newElements[i];
        if (el.type === "text" && el.containerId && positionMap.has(el.containerId)) {
            const containerPos = positionMap.get(el.containerId)!;
            // 文本居中于容器
            const textWidth = el.width || 100;
            const textHeight = el.height || 24;
            newElements[i] = {
                ...el,
                x: containerPos.x + (containerPos.width - textWidth) / 2,
                y: containerPos.y + (containerPos.height - textHeight) / 2,
                version: (el.version || 0) + 1,
            };
        }
    }

    // 更新箭头位置
    for (const el of elements) {
        if (el.isDeleted) continue;

        if (el.type === "arrow") {
            const edge = edges.find((e) => e.arrowElement.id === el.id);

            if (edge && positionMap.has(edge.source) && positionMap.has(edge.target)) {
                const sourcePos = positionMap.get(edge.source)!;
                const targetPos = positionMap.get(edge.target)!;

                // 计算新的起点和终点
                const startX = sourcePos.x + sourcePos.width;
                const startY = sourcePos.y + sourcePos.height / 2;
                const endX = targetPos.x;
                const endY = targetPos.y + targetPos.height / 2;

                // 根据方向调整连接点
                let newStartX = startX;
                let newStartY = startY;
                let newEndX = endX;
                let newEndY = endY;

                if (opts.direction === "TB" || opts.direction === "BT") {
                    // 上下布局：从底部到顶部连接
                    newStartX = sourcePos.x + sourcePos.width / 2;
                    newStartY = opts.direction === "TB"
                        ? sourcePos.y + sourcePos.height
                        : sourcePos.y;
                    newEndX = targetPos.x + targetPos.width / 2;
                    newEndY = opts.direction === "TB"
                        ? targetPos.y
                        : targetPos.y + targetPos.height;
                } else {
                    // 左右布局：从右边到左边连接
                    newStartX = opts.direction === "LR"
                        ? sourcePos.x + sourcePos.width
                        : sourcePos.x;
                    newStartY = sourcePos.y + sourcePos.height / 2;
                    newEndX = opts.direction === "LR"
                        ? targetPos.x
                        : targetPos.x + targetPos.width;
                    newEndY = targetPos.y + targetPos.height / 2;
                }

                newElements.push({
                    ...el,
                    x: newStartX,
                    y: newStartY,
                    width: newEndX - newStartX,
                    height: newEndY - newStartY,
                    points: [[0, 0], [newEndX - newStartX, newEndY - newStartY]] as [number, number][],
                    version: (el.version || 0) + 1,
                });
            } else {
                newElements.push(el);
            }
        }
    }

    return newElements;
}

/**
 * 布局方向配置
 */
export const LAYOUT_DIRECTIONS: { value: LayoutDirection; label: string }[] = [
    { value: "TB", label: "从上到下" },
    { value: "LR", label: "从左到右" },
    { value: "BT", label: "从下到上" },
    { value: "RL", label: "从右到左" },
];
