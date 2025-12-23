/**
 * 画布状态同步服务
 * 负责将画布元素变化同步到影子模型，以及将影子模型变化应用到画布
 */

import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";
import { ShadowNode, ShadowEdge, ShadowModule } from "@/types";
import { CoordinateEngine, createCoordinateEngine, Bounds } from "./coordinate-engine";
import { getNodeByElementId, mapElementToNode, unmapElement } from "./element-mapping";

/**
 * 同步事件类型
 */
export type SyncEventType =
    | "element_added"
    | "element_updated"
    | "element_deleted"
    | "element_moved"
    | "selection_changed";

/**
 * 同步事件
 */
export interface SyncEvent {
    type: SyncEventType;
    elementIds: string[];
    timestamp: number;
}

/**
 * 同步回调
 */
export interface SyncCallbacks {
    onNodeUpdate?: (node: ShadowNode) => void;
    onEdgeUpdate?: (edge: ShadowEdge) => void;
    onModuleUpdate?: (module: ShadowModule) => void;
    onSyncError?: (error: Error) => void;
}

/**
 * 元素变化检测结果
 */
export interface ElementChanges {
    added: ExcalidrawElement[];
    updated: ExcalidrawElement[];
    deleted: string[];
    moved: ExcalidrawElement[];
}

/**
 * 画布状态同步服务类
 */
export class CanvasSyncService {
    private coordinateEngine: CoordinateEngine;
    private previousElements: Map<string, ExcalidrawElement>;
    private callbacks: SyncCallbacks;
    private syncEnabled: boolean;

    constructor(callbacks: SyncCallbacks = {}) {
        this.coordinateEngine = createCoordinateEngine();
        this.previousElements = new Map();
        this.callbacks = callbacks;
        this.syncEnabled = true;
    }

    /**
     * 启用/禁用同步
     */
    setSyncEnabled(enabled: boolean): void {
        this.syncEnabled = enabled;
    }

    /**
     * 更新回调
     */
    setCallbacks(callbacks: SyncCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    /**
     * 获取坐标引擎
     */
    getCoordinateEngine(): CoordinateEngine {
        return this.coordinateEngine;
    }

    /**
     * 检测元素变化
     */
    detectChanges(currentElements: readonly ExcalidrawElement[]): ElementChanges {
        const changes: ElementChanges = {
            added: [],
            updated: [],
            deleted: [],
            moved: [],
        };

        const currentIds = new Set<string>();

        for (const element of currentElements) {
            if (element.isDeleted) continue;

            currentIds.add(element.id);
            const previous = this.previousElements.get(element.id);

            if (!previous) {
                // 新增元素
                changes.added.push(element);
            } else {
                // 检查是否移动
                if (previous.x !== element.x || previous.y !== element.y) {
                    changes.moved.push(element);
                }
                // 检查是否更新（版本变化）
                else if (previous.version !== element.version) {
                    changes.updated.push(element);
                }
            }
        }

        // 检测删除
        for (const [id] of this.previousElements) {
            if (!currentIds.has(id)) {
                changes.deleted.push(id);
            }
        }

        return changes;
    }

    /**
     * 同步画布状态
     */
    syncFromCanvas(
        currentElements: readonly ExcalidrawElement[],
        nodes: ShadowNode[],
        edges: ShadowEdge[]
    ): { updatedNodes: ShadowNode[]; updatedEdges: ShadowEdge[] } {
        if (!this.syncEnabled) {
            return { updatedNodes: [], updatedEdges: [] };
        }

        const changes = this.detectChanges(currentElements);
        const updatedNodes: ShadowNode[] = [];
        const updatedEdges: ShadowEdge[] = [];

        // 处理移动的元素
        for (const element of changes.moved) {
            const nodeInfo = getNodeByElementId(element.id);
            if (nodeInfo) {
                const node = nodes.find((n) => n.id === nodeInfo.nodeId);
                if (node) {
                    // 更新节点位置
                    const newLogical = this.coordinateEngine.canvasToLogical({
                        x: element.x,
                        y: element.y,
                    });

                    const updatedNode: ShadowNode = {
                        ...node,
                        logicalPosition: newLogical,
                        position: {
                            x: element.x,
                            y: element.y,
                            width: element.width || node.position.width,
                            height: element.height || node.position.height,
                        },
                        updatedAt: Date.now(),
                    };

                    updatedNodes.push(updatedNode);

                    if (this.callbacks.onNodeUpdate) {
                        this.callbacks.onNodeUpdate(updatedNode);
                    }
                }
            }
        }

        // 更新缓存
        this.updateCache(currentElements);

        return { updatedNodes, updatedEdges };
    }

    /**
     * 将影子模型变化应用到画布元素
     */
    applyToCanvas(
        node: ShadowNode,
        currentElements: readonly ExcalidrawElement[]
    ): ExcalidrawElement[] {
        const updatedElements: ExcalidrawElement[] = [];
        const bounds = this.coordinateEngine.getNodeBounds(node.logicalPosition);

        for (const elementId of node.elementIds) {
            const element = currentElements.find((e) => e.id === elementId);
            if (element) {
                const updatedElement = {
                    ...element,
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height,
                    version: (element.version || 0) + 1,
                };
                updatedElements.push(updatedElement);
            }
        }

        return updatedElements;
    }

    /**
     * 更新元素缓存
     */
    private updateCache(elements: readonly ExcalidrawElement[]): void {
        this.previousElements.clear();
        for (const element of elements) {
            if (!element.isDeleted) {
                this.previousElements.set(element.id, { ...element });
            }
        }
    }

    /**
     * 初始化缓存（首次加载时调用）
     */
    initializeCache(elements: readonly ExcalidrawElement[]): void {
        this.updateCache(elements);
    }

    /**
     * 获取选中元素的节点信息
     */
    getSelectedNodesInfo(
        selectedElementIds: string[],
        nodes: ShadowNode[]
    ): ShadowNode[] {
        const selectedNodes: ShadowNode[] = [];

        for (const elementId of selectedElementIds) {
            const nodeInfo = getNodeByElementId(elementId);
            if (nodeInfo) {
                const node = nodes.find((n) => n.id === nodeInfo.nodeId);
                if (node && !selectedNodes.includes(node)) {
                    selectedNodes.push(node);
                }
            }
        }

        return selectedNodes;
    }

    /**
     * 批量更新节点位置
     */
    batchUpdateNodePositions(
        nodes: ShadowNode[],
        updateFn: (node: ShadowNode) => { x: number; y: number }
    ): ShadowNode[] {
        return nodes.map((node) => {
            const newPosition = updateFn(node);
            const newLogical = this.coordinateEngine.canvasToLogical(newPosition);

            return {
                ...node,
                logicalPosition: newLogical,
                position: {
                    ...node.position,
                    x: newPosition.x,
                    y: newPosition.y,
                },
                updatedAt: Date.now(),
            };
        });
    }

    /**
     * 计算模块边界
     */
    calculateModuleBounds(nodes: ShadowNode[]): Bounds {
        return this.coordinateEngine.calculateModuleBounds(nodes);
    }

    /**
     * 重置缓存
     */
    resetCache(): void {
        this.previousElements.clear();
    }
}

/**
 * 创建画布同步服务实例
 */
export function createCanvasSyncService(callbacks?: SyncCallbacks): CanvasSyncService {
    return new CanvasSyncService(callbacks);
}

/**
 * 全局默认同步服务
 */
let defaultSyncService: CanvasSyncService | null = null;

export function getDefaultCanvasSyncService(): CanvasSyncService {
    if (defaultSyncService === null) {
        defaultSyncService = new CanvasSyncService();
    }
    return defaultSyncService;
}
