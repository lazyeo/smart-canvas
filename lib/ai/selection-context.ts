/**
 * 选中上下文服务
 * 负责提取和管理选中元素的上下文信息，用于 AI 增量编辑
 */

import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";
import { ShadowNode, ShadowEdge, ShadowModule } from "@/types";
import { getNodeByElementId, findNodesForSelectedElements } from "@/lib/shadow-model/element-mapping";

/**
 * 选中上下文
 */
export interface SelectionContext {
    // 选中的元素 ID 列表
    elementIds: string[];

    // 选中的节点
    nodes: ShadowNode[];

    // 相关的连线（连接选中节点的）
    relatedEdges: ShadowEdge[];

    // 所属模块
    modules: ShadowModule[];

    // 选中区域边界
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;

    // 上下文描述（用于 AI）
    description: string;

    // 时间戳
    timestamp: number;
}

/**
 * 选中监听器回调
 */
export interface SelectionListenerCallbacks {
    onSelectionChange?: (context: SelectionContext) => void;
    onNodeSelected?: (nodes: ShadowNode[]) => void;
    onEdgeSelected?: (edges: ShadowEdge[]) => void;
    onSelectionClear?: () => void;
}

/**
 * 选中上下文服务类
 */
export class SelectionContextService {
    private currentContext: SelectionContext | null = null;
    private callbacks: SelectionListenerCallbacks = {};
    private allNodes: ShadowNode[] = [];
    private allEdges: ShadowEdge[] = [];
    private allModules: ShadowModule[] = [];

    constructor(callbacks?: SelectionListenerCallbacks) {
        if (callbacks) {
            this.callbacks = callbacks;
        }
    }

    /**
     * 设置回调
     */
    setCallbacks(callbacks: SelectionListenerCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * 更新影子模型数据
     */
    updateShadowData(
        nodes: ShadowNode[],
        edges: ShadowEdge[],
        modules: ShadowModule[]
    ): void {
        this.allNodes = nodes;
        this.allEdges = edges;
        this.allModules = modules;
    }

    /**
     * 处理选中变化
     */
    handleSelectionChange(
        selectedElementIds: string[],
        elements: readonly ExcalidrawElement[]
    ): SelectionContext {
        // 如果没有选中任何元素
        if (selectedElementIds.length === 0) {
            this.currentContext = null;
            if (this.callbacks.onSelectionClear) {
                this.callbacks.onSelectionClear();
            }
            return this.createEmptyContext();
        }

        // 查找选中元素对应的节点
        const nodeInfoList = findNodesForSelectedElements(selectedElementIds);
        const selectedNodeIds = [...new Set(nodeInfoList.map((info) => info.nodeId))];
        const selectedNodes = this.allNodes.filter((n) => selectedNodeIds.includes(n.id));

        // 查找相关的连线（连接选中节点的）
        const relatedEdges = this.allEdges.filter(
            (edge) =>
                selectedNodeIds.includes(edge.sourceNodeId) ||
                selectedNodeIds.includes(edge.targetNodeId)
        );

        // 查找所属模块
        const moduleIds = [...new Set(nodeInfoList.map((info) => info.moduleId))];
        const modules = this.allModules.filter((m) => moduleIds.includes(m.id));

        // 计算选中区域边界
        const bounds = this.calculateSelectionBounds(selectedElementIds, elements);

        // 生成上下文描述
        const description = this.generateContextDescription(
            selectedNodes,
            relatedEdges,
            modules
        );

        // 创建上下文
        const context: SelectionContext = {
            elementIds: selectedElementIds,
            nodes: selectedNodes,
            relatedEdges,
            modules,
            bounds,
            description,
            timestamp: Date.now(),
        };

        this.currentContext = context;

        // 触发回调
        if (this.callbacks.onSelectionChange) {
            this.callbacks.onSelectionChange(context);
        }
        if (this.callbacks.onNodeSelected && selectedNodes.length > 0) {
            this.callbacks.onNodeSelected(selectedNodes);
        }

        return context;
    }

    /**
     * 获取当前上下文
     */
    getCurrentContext(): SelectionContext | null {
        return this.currentContext;
    }

    /**
     * 计算选中区域边界
     */
    private calculateSelectionBounds(
        elementIds: string[],
        elements: readonly ExcalidrawElement[]
    ): { x: number; y: number; width: number; height: number } | null {
        const selectedElements = elements.filter(
            (el) => elementIds.includes(el.id) && !el.isDeleted
        );

        if (selectedElements.length === 0) {
            return null;
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const el of selectedElements) {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + (el.width || 0));
            maxY = Math.max(maxY, el.y + (el.height || 0));
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    /**
     * 生成上下文描述（用于 AI Prompt）
     */
    private generateContextDescription(
        nodes: ShadowNode[],
        edges: ShadowEdge[],
        modules: ShadowModule[]
    ): string {
        if (nodes.length === 0) {
            return "未选中任何节点";
        }

        const parts: string[] = [];

        // 模块信息
        if (modules.length > 0) {
            const moduleNames = modules.map((m) => m.name).join("、");
            parts.push(`所属模块: ${moduleNames}`);
        }

        // 节点信息
        const nodeDescriptions = nodes.map(
            (n) => `[${n.type}] ${n.label}`
        );
        parts.push(`选中节点 (${nodes.length}个): ${nodeDescriptions.join(", ")}`);

        // 连线信息
        if (edges.length > 0) {
            const edgeDescriptions = edges.map((e) => {
                const source = nodes.find((n) => n.id === e.sourceNodeId);
                const target = nodes.find((n) => n.id === e.targetNodeId);
                const sourceLabel = source?.label || e.sourceNodeId;
                const targetLabel = target?.label || e.targetNodeId;
                return `${sourceLabel} → ${targetLabel}`;
            });
            parts.push(`相关连线 (${edges.length}条): ${edgeDescriptions.join(", ")}`);
        }

        return parts.join("\n");
    }

    /**
     * 创建空上下文
     */
    private createEmptyContext(): SelectionContext {
        return {
            elementIds: [],
            nodes: [],
            relatedEdges: [],
            modules: [],
            bounds: null,
            description: "未选中任何元素",
            timestamp: Date.now(),
        };
    }

    /**
     * 获取选中节点的邻居节点
     */
    getNeighborNodes(): ShadowNode[] {
        if (!this.currentContext || this.currentContext.nodes.length === 0) {
            return [];
        }

        const selectedNodeIds = new Set(this.currentContext.nodes.map((n) => n.id));
        const neighborIds = new Set<string>();

        // 通过连线找邻居
        for (const edge of this.allEdges) {
            if (selectedNodeIds.has(edge.sourceNodeId)) {
                neighborIds.add(edge.targetNodeId);
            }
            if (selectedNodeIds.has(edge.targetNodeId)) {
                neighborIds.add(edge.sourceNodeId);
            }
        }

        // 排除已选中的节点
        for (const id of selectedNodeIds) {
            neighborIds.delete(id);
        }

        return this.allNodes.filter((n) => neighborIds.has(n.id));
    }

    /**
     * 获取完整图表摘要（用于 AI 理解整体结构）
     */
    getFullDiagramSummary(): string {
        const parts: string[] = [];

        parts.push(`图表概览:`);
        parts.push(`- 节点总数: ${this.allNodes.length}`);
        parts.push(`- 连线总数: ${this.allEdges.length}`);
        parts.push(`- 模块数: ${this.allModules.length}`);

        if (this.allNodes.length > 0) {
            const typeCount = new Map<string, number>();
            for (const node of this.allNodes) {
                typeCount.set(node.type, (typeCount.get(node.type) || 0) + 1);
            }
            const typeSummary = Array.from(typeCount.entries())
                .map(([type, count]) => `${type}(${count})`)
                .join(", ");
            parts.push(`- 节点类型: ${typeSummary}`);
        }

        return parts.join("\n");
    }

    /**
     * 清除当前上下文
     */
    clearContext(): void {
        this.currentContext = null;
    }
}

/**
 * 创建选中上下文服务实例
 */
export function createSelectionContextService(
    callbacks?: SelectionListenerCallbacks
): SelectionContextService {
    return new SelectionContextService(callbacks);
}

/**
 * 全局默认服务
 */
let defaultService: SelectionContextService | null = null;

export function getDefaultSelectionContextService(): SelectionContextService {
    if (defaultService === null) {
        defaultService = new SelectionContextService();
    }
    return defaultService;
}
