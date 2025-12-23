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
 * 生成随机种子
 */
function generateSeed(): number {
    return Math.floor(Math.random() * 2147483647);
}

/**
 * 创建基础元素属性（Excalidraw 必需的字段）
 */
function createBaseElementProps() {
    return {
        version: 1,
        versionNonce: generateSeed(),
        seed: generateSeed(),
        isDeleted: false,
        updated: Date.now(),
        angle: 0,
        frameId: null,
        link: null,
    };
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
 * 节点信息（用于生成过程中的数据传递）
 */
interface NodeInfo {
    elementId: string;
    labelId: string;
    groupId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    boundElements: Array<{ id: string; type: string }>;
}

/**
 * 创建节点和标签元素（成组）
 */
function createNodeWithLabel(
    node: {
        id: string;
        type: string;
        label: string;
        row: number;
        column: number;
    },
    moduleId: string
): {
    nodeElement: ExcalidrawElement;
    labelElement: ExcalidrawElement;
    shadowNode: ShadowNode;
    nodeInfo: NodeInfo;
} {
    const pos = calculatePosition(node.row, node.column);
    const shape = NODE_SHAPE_MAP[node.type] || "rectangle";
    const colors = NODE_COLOR_MAP[node.type] || NODE_COLOR_MAP.generic;

    const nodeElementId = generateId();
    const labelElementId = generateId();
    const groupId = generateId();
    const now = Date.now();

    // 文本尺寸计算
    const textWidth = Math.max(node.label.length * 14, 50);
    const textHeight = 25;

    // 创建节点元素
    const nodeElement: ExcalidrawElement = {
        ...createBaseElementProps(),
        id: nodeElementId,
        type: shape,
        x: pos.x,
        y: pos.y,
        width: LAYOUT_CONFIG.nodeWidth,
        height: LAYOUT_CONFIG.nodeHeight,
        strokeColor: colors.stroke,
        backgroundColor: colors.background,
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [groupId],
        boundElements: [],  // 将在后面更新
        locked: false,
        roundness: { type: 3 },
        customData: {
            nodeId: node.id,
            moduleId: moduleId,
            label: node.label,
        },
    };

    // 创建标签元素（与节点成组）
    const labelElement: ExcalidrawElement = {
        ...createBaseElementProps(),
        id: labelElementId,
        type: "text",
        x: pos.x + (LAYOUT_CONFIG.nodeWidth - textWidth) / 2,
        y: pos.y + (LAYOUT_CONFIG.nodeHeight - textHeight) / 2,
        width: textWidth,
        height: textHeight,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [groupId],
        boundElements: null,
        locked: false,
        roundness: null,
        text: node.label,
        fontSize: 16,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        originalText: node.label,
        autoResize: true,
        lineHeight: 1.25,
        customData: {
            isLabel: true,
            parentId: nodeElementId,
        },
    };

    // 创建影子节点
    const shadowNode: ShadowNode = {
        id: node.id,
        type: node.type as NodeType,
        label: node.label,
        elementIds: [nodeElementId, labelElementId],
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

    const nodeInfo: NodeInfo = {
        elementId: nodeElementId,
        labelId: labelElementId,
        groupId: groupId,
        x: pos.x,
        y: pos.y,
        width: LAYOUT_CONFIG.nodeWidth,
        height: LAYOUT_CONFIG.nodeHeight,
        boundElements: [],
    };

    return { nodeElement, labelElement, shadowNode, nodeInfo };
}

/**
 * 创建连线元素（带绑定）
 */
function createEdgeElement(
    edge: { id: string; source: string; target: string; label?: string },
    nodeInfoMap: Map<string, NodeInfo>,
    moduleId: string
): { element: ExcalidrawElement; shadowEdge: ShadowEdge } | null {
    const sourceInfo = nodeInfoMap.get(edge.source);
    const targetInfo = nodeInfoMap.get(edge.target);

    if (!sourceInfo || !targetInfo) {
        console.warn(`Edge ${edge.id} references non-existent nodes`);
        return null;
    }

    const elementId = generateId();
    const now = Date.now();

    // 计算起点和终点（从节点底部中心到目标节点顶部中心）
    const startX = sourceInfo.x + sourceInfo.width / 2;
    const startY = sourceInfo.y + sourceInfo.height;
    const endX = targetInfo.x + targetInfo.width / 2;
    const endY = targetInfo.y;

    // 记录绑定关系
    sourceInfo.boundElements.push({ id: elementId, type: "arrow" });
    targetInfo.boundElements.push({ id: elementId, type: "arrow" });

    // 创建箭头元素（带绑定）
    const element: ExcalidrawElement = {
        ...createBaseElementProps(),
        id: elementId,
        type: "arrow",
        x: startX,
        y: startY,
        width: endX - startX,
        height: endY - startY,
        strokeColor: "#1e1e1e",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        boundElements: null,
        locked: false,
        roundness: { type: 2 },
        points: [
            [0, 0],
            [endX - startX, endY - startY],
        ],
        // 绑定到源节点和目标节点
        startBinding: {
            elementId: sourceInfo.elementId,
            focus: 0,
            gap: 1,
            fixedPoint: null,
        },
        endBinding: {
            elementId: targetInfo.elementId,
            focus: 0,
            gap: 1,
            fixedPoint: null,
        },
        lastCommittedPoint: null,
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
    const nodeElements: ExcalidrawElement[] = [];
    const labelElements: ExcalidrawElement[] = [];
    const edgeElements: ExcalidrawElement[] = [];
    const shadowNodes: ShadowNode[] = [];
    const shadowEdges: ShadowEdge[] = [];
    const nodeInfoMap = new Map<string, NodeInfo>();

    // 第一步：创建所有节点和标签
    for (const node of diagramData.nodes) {
        const { nodeElement, labelElement, shadowNode, nodeInfo } = createNodeWithLabel(node, moduleId);
        nodeElements.push(nodeElement);
        labelElements.push(labelElement);
        shadowNodes.push(shadowNode);
        nodeInfoMap.set(node.id, nodeInfo);
    }

    // 第二步：创建所有连线（会更新 nodeInfo.boundElements）
    for (const edge of diagramData.edges) {
        const result = createEdgeElement(edge, nodeInfoMap, moduleId);
        if (result) {
            edgeElements.push(result.element);
            shadowEdges.push(result.shadowEdge);
        }
    }

    // 第三步：更新节点的 boundElements 属性
    for (const nodeElement of nodeElements) {
        const nodeData = nodeElement.customData;
        if (nodeData && nodeData.nodeId) {
            const nodeInfo = nodeInfoMap.get(nodeData.nodeId as string);
            if (nodeInfo && nodeInfo.boundElements.length > 0) {
                nodeElement.boundElements = nodeInfo.boundElements;
            }
        }
    }

    // 合并所有元素：先节点，再标签，最后连线
    const elements = [...nodeElements, ...labelElements, ...edgeElements];

    return { elements, shadowNodes, shadowEdges };
}
