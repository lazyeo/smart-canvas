/**
 * 图表生成器
 * 将 AI 生成的逻辑图表数据转换为 Excalidraw 元素
 */

import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";
import { ShadowNode, ShadowEdge, NodeType, EdgeType } from "@/types";

// 布局配置
const LAYOUT_CONFIG = {
    nodeWidth: 150,
    nodeHeight: 60,
    horizontalSpacing: 80,
    verticalSpacing: 100,
    startX: 100,
    startY: 100,
};

// 节点形状映射
const NODE_SHAPE_MAP: Record<string, string> = {
    process: "rectangle",
    decision: "diamond",
    start: "ellipse",
    end: "ellipse",
    data: "rectangle",
    entity: "rectangle",
    actor: "rectangle",
    component: "rectangle",
    container: "rectangle",
    annotation: "rectangle",
    generic: "rectangle",
};

// 节点颜色映射
const NODE_COLOR_MAP: Record<string, { stroke: string; background: string }> = {
    start: { stroke: "#2f9e44", background: "#b2f2bb" },
    end: { stroke: "#e03131", background: "#ffc9c9" },
    decision: { stroke: "#f08c00", background: "#ffe066" },
    process: { stroke: "#1971c2", background: "#a5d8ff" },
    data: { stroke: "#6741d9", background: "#d0bfff" },
    entity: { stroke: "#0c8599", background: "#99e9f2" },
    actor: { stroke: "#5f3dc4", background: "#d0bfff" },
    component: { stroke: "#1971c2", background: "#a5d8ff" },
    container: { stroke: "#495057", background: "#e9ecef" },
    annotation: { stroke: "#868e96", background: "#f8f9fa" },
    generic: { stroke: "#495057", background: "#f8f9fa" },
};

/**
 * 生成唯一 ID
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 计算节点位置
 */
function calculatePosition(
    row: number,
    column: number
): { x: number; y: number } {
    return {
        x: LAYOUT_CONFIG.startX + column * (LAYOUT_CONFIG.nodeWidth + LAYOUT_CONFIG.horizontalSpacing),
        y: LAYOUT_CONFIG.startY + row * (LAYOUT_CONFIG.nodeHeight + LAYOUT_CONFIG.verticalSpacing),
    };
}

/**
 * 创建节点元素
 */
function createNodeElement(
    node: {
        id: string;
        type: string;
        label: string;
        row: number;
        column: number;
    },
    moduleId: string
): { element: ExcalidrawElement; shadowNode: ShadowNode } {
    const pos = calculatePosition(node.row, node.column);
    const shape = NODE_SHAPE_MAP[node.type] || "rectangle";
    const colors = NODE_COLOR_MAP[node.type] || NODE_COLOR_MAP.generic;

    const elementId = generateId();
    const now = Date.now();

    // 创建 Excalidraw 元素
    const element: ExcalidrawElement = {
        id: elementId,
        type: shape,
        x: pos.x,
        y: pos.y,
        width: LAYOUT_CONFIG.nodeWidth,
        height: LAYOUT_CONFIG.nodeHeight,
        strokeColor: colors.stroke,
        backgroundColor: colors.background,
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 1,
        opacity: 100,
        groupIds: [],
        boundElements: [],
        locked: false,
        customData: {
            nodeId: node.id,
            moduleId: moduleId,
            label: node.label,
        },
    };

    // 创建影子节点
    const shadowNode: ShadowNode = {
        id: node.id,
        type: node.type as NodeType,
        label: node.label,
        elementIds: [elementId],
        logicalPosition: { row: node.row, column: node.column },
        position: {
            x: pos.x,
            y: pos.y,
            width: LAYOUT_CONFIG.nodeWidth,
            height: LAYOUT_CONFIG.nodeHeight,
        },
        properties: {},
        createdAt: now,
        updatedAt: now,
    };

    return { element, shadowNode };
}

/**
 * 创建文本标签元素
 */
function createLabelElement(
    nodeElement: ExcalidrawElement,
    label: string
): ExcalidrawElement {
    const textId = generateId();

    return {
        id: textId,
        type: "text",
        x: nodeElement.x + nodeElement.width / 2 - label.length * 6,
        y: nodeElement.y + nodeElement.height / 2 - 10,
        width: label.length * 12,
        height: 20,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        text: label,
        fontSize: 16,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        customData: {
            isLabel: true,
            parentId: nodeElement.id,
        },
    };
}

/**
 * 创建连线元素
 */
function createEdgeElement(
    edge: { id: string; source: string; target: string; label?: string },
    nodePositions: Map<string, { x: number; y: number; width: number; height: number }>,
    moduleId: string
): { element: ExcalidrawElement; shadowEdge: ShadowEdge } | null {
    const sourcePos = nodePositions.get(edge.source);
    const targetPos = nodePositions.get(edge.target);

    if (!sourcePos || !targetPos) {
        console.warn(`Edge ${edge.id} references non-existent nodes`);
        return null;
    }

    const elementId = generateId();
    const now = Date.now();

    // 计算起点和终点
    const startX = sourcePos.x + sourcePos.width / 2;
    const startY = sourcePos.y + sourcePos.height;
    const endX = targetPos.x + targetPos.width / 2;
    const endY = targetPos.y;

    // 创建箭头元素
    const element: ExcalidrawElement = {
        id: elementId,
        type: "arrow",
        x: startX,
        y: startY,
        width: endX - startX,
        height: endY - startY,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        strokeWidth: 2,
        roughness: 1,
        opacity: 100,
        points: [
            [0, 0],
            [endX - startX, endY - startY],
        ],
        startArrowhead: null,
        endArrowhead: "arrow",
        customData: {
            edgeId: edge.id,
            moduleId: moduleId,
            label: edge.label,
        },
    };

    // 创建影子连线
    const shadowEdge: ShadowEdge = {
        id: edge.id,
        type: "flow" as EdgeType,
        label: edge.label,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        elementId: elementId,
        properties: {},
        createdAt: now,
        updatedAt: now,
    };

    return { element, shadowEdge };
}

/**
 * 将图表数据转换为 Excalidraw 元素
 */
export function generateExcalidrawElements(
    diagramData: {
        nodes: Array<{
            id: string;
            type: string;
            label: string;
            row: number;
            column: number;
        }>;
        edges: Array<{
            id: string;
            source: string;
            target: string;
            label?: string;
        }>;
    },
    moduleId: string = "default"
): {
    elements: ExcalidrawElement[];
    shadowNodes: ShadowNode[];
    shadowEdges: ShadowEdge[];
} {
    const elements: ExcalidrawElement[] = [];
    const shadowNodes: ShadowNode[] = [];
    const shadowEdges: ShadowEdge[] = [];
    const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();

    // 创建节点
    for (const node of diagramData.nodes) {
        const { element, shadowNode } = createNodeElement(node, moduleId);
        elements.push(element);
        shadowNodes.push(shadowNode);

        // 创建标签
        const labelElement = createLabelElement(element, node.label);
        elements.push(labelElement);

        // 记录位置
        nodePositions.set(node.id, {
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
        });
    }

    // 创建连线
    for (const edge of diagramData.edges) {
        const result = createEdgeElement(edge, nodePositions, moduleId);
        if (result) {
            elements.push(result.element);
            shadowEdges.push(result.shadowEdge);
        }
    }

    return { elements, shadowNodes, shadowEdges };
}
