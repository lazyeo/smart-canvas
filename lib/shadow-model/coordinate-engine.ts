/**
 * 坐标转换引擎
 * 负责逻辑坐标与画布坐标之间的相互转换
 */

import { ShadowNode, ShadowModule } from "@/types";

/**
 * 布局方向
 */
export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

/**
 * 布局配置
 */
export interface LayoutConfig {
    direction: LayoutDirection;
    nodeWidth: number;
    nodeHeight: number;
    horizontalSpacing: number;
    verticalSpacing: number;
    startX: number;
    startY: number;
}

/**
 * 默认布局配置
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
    direction: "TB",
    nodeWidth: 150,
    nodeHeight: 60,
    horizontalSpacing: 80,
    verticalSpacing: 100,
    startX: 100,
    startY: 100,
};

/**
 * 点坐标
 */
export interface Point {
    x: number;
    y: number;
}

/**
 * 矩形边界
 */
export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * 逻辑坐标（行列）
 */
export interface LogicalPosition {
    row: number;
    column: number;
}

/**
 * 坐标转换引擎类
 */
export class CoordinateEngine {
    private config: LayoutConfig;

    constructor(config: Partial<LayoutConfig> = {}) {
        this.config = { ...DEFAULT_LAYOUT_CONFIG, ...config };
    }

    /**
     * 更新布局配置
     */
    updateConfig(config: Partial<LayoutConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * 获取当前布局配置
     */
    getConfig(): LayoutConfig {
        return { ...this.config };
    }

    /**
     * 逻辑坐标 → 画布坐标
     * 将行列位置转换为实际的 x, y 坐标
     */
    logicalToCanvas(logical: LogicalPosition): Point {
        const { direction, nodeWidth, nodeHeight, horizontalSpacing, verticalSpacing, startX, startY } = this.config;

        let x: number;
        let y: number;

        switch (direction) {
            case "TB": // 从上到下
                x = startX + logical.column * (nodeWidth + horizontalSpacing);
                y = startY + logical.row * (nodeHeight + verticalSpacing);
                break;
            case "BT": // 从下到上
                x = startX + logical.column * (nodeWidth + horizontalSpacing);
                y = startY - logical.row * (nodeHeight + verticalSpacing);
                break;
            case "LR": // 从左到右
                x = startX + logical.row * (nodeWidth + horizontalSpacing);
                y = startY + logical.column * (nodeHeight + verticalSpacing);
                break;
            case "RL": // 从右到左
                x = startX - logical.row * (nodeWidth + horizontalSpacing);
                y = startY + logical.column * (nodeHeight + verticalSpacing);
                break;
            default:
                x = startX + logical.column * (nodeWidth + horizontalSpacing);
                y = startY + logical.row * (nodeHeight + verticalSpacing);
        }

        return { x, y };
    }

    /**
     * 画布坐标 → 逻辑坐标
     * 将实际的 x, y 坐标转换为行列位置
     */
    canvasToLogical(point: Point): LogicalPosition {
        const { direction, nodeWidth, nodeHeight, horizontalSpacing, verticalSpacing, startX, startY } = this.config;

        const cellWidth = nodeWidth + horizontalSpacing;
        const cellHeight = nodeHeight + verticalSpacing;

        let row: number;
        let column: number;

        switch (direction) {
            case "TB":
                column = Math.round((point.x - startX) / cellWidth);
                row = Math.round((point.y - startY) / cellHeight);
                break;
            case "BT":
                column = Math.round((point.x - startX) / cellWidth);
                row = Math.round((startY - point.y) / cellHeight);
                break;
            case "LR":
                row = Math.round((point.x - startX) / cellWidth);
                column = Math.round((point.y - startY) / cellHeight);
                break;
            case "RL":
                row = Math.round((startX - point.x) / cellWidth);
                column = Math.round((point.y - startY) / cellHeight);
                break;
            default:
                column = Math.round((point.x - startX) / cellWidth);
                row = Math.round((point.y - startY) / cellHeight);
        }

        return {
            row: Math.max(0, row),
            column: Math.max(0, column),
        };
    }

    /**
     * 计算节点的完整边界（含尺寸）
     */
    getNodeBounds(logical: LogicalPosition): Bounds {
        const point = this.logicalToCanvas(logical);
        return {
            x: point.x,
            y: point.y,
            width: this.config.nodeWidth,
            height: this.config.nodeHeight,
        };
    }

    /**
     * 计算节点中心点
     */
    getNodeCenter(logical: LogicalPosition): Point {
        const bounds = this.getNodeBounds(logical);
        return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
        };
    }

    /**
     * 计算两个节点之间的连线端点
     */
    getEdgeEndpoints(
        sourceLogical: LogicalPosition,
        targetLogical: LogicalPosition
    ): { start: Point; end: Point } {
        const sourceBounds = this.getNodeBounds(sourceLogical);
        const targetBounds = this.getNodeBounds(targetLogical);

        // 计算相对方向
        const sourceCenter = {
            x: sourceBounds.x + sourceBounds.width / 2,
            y: sourceBounds.y + sourceBounds.height / 2,
        };
        const targetCenter = {
            x: targetBounds.x + targetBounds.width / 2,
            y: targetBounds.y + targetBounds.height / 2,
        };

        const dx = targetCenter.x - sourceCenter.x;
        const dy = targetCenter.y - sourceCenter.y;

        let start: Point;
        let end: Point;

        // 根据主要方向确定连接点
        if (Math.abs(dy) > Math.abs(dx)) {
            // 垂直方向为主
            if (dy > 0) {
                // 目标在下方
                start = { x: sourceCenter.x, y: sourceBounds.y + sourceBounds.height };
                end = { x: targetCenter.x, y: targetBounds.y };
            } else {
                // 目标在上方
                start = { x: sourceCenter.x, y: sourceBounds.y };
                end = { x: targetCenter.x, y: targetBounds.y + targetBounds.height };
            }
        } else {
            // 水平方向为主
            if (dx > 0) {
                // 目标在右方
                start = { x: sourceBounds.x + sourceBounds.width, y: sourceCenter.y };
                end = { x: targetBounds.x, y: targetCenter.y };
            } else {
                // 目标在左方
                start = { x: sourceBounds.x, y: sourceCenter.y };
                end = { x: targetBounds.x + targetBounds.width, y: targetCenter.y };
            }
        }

        return { start, end };
    }

    /**
     * 计算模块边界（包含所有节点）
     */
    calculateModuleBounds(nodes: ShadowNode[]): Bounds {
        if (nodes.length === 0) {
            return { x: this.config.startX, y: this.config.startY, width: 0, height: 0 };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const node of nodes) {
            const bounds = this.getNodeBounds(node.logicalPosition);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        }

        // 添加 padding
        const padding = 20;
        return {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2,
        };
    }

    /**
     * 检测点是否在边界内
     */
    isPointInBounds(point: Point, bounds: Bounds): boolean {
        return (
            point.x >= bounds.x &&
            point.x <= bounds.x + bounds.width &&
            point.y >= bounds.y &&
            point.y <= bounds.y + bounds.height
        );
    }

    /**
     * 检测两个边界是否相交
     */
    doBoundsIntersect(a: Bounds, b: Bounds): boolean {
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
    }

    /**
     * 移动节点到新位置（更新逻辑坐标）
     */
    moveNodeToPosition(node: ShadowNode, newPosition: Point): LogicalPosition {
        const newLogical = this.canvasToLogical(newPosition);
        return newLogical;
    }

    /**
     * 批量重新布局节点
     */
    relayoutNodes(
        nodes: ShadowNode[],
        startLogical: LogicalPosition = { row: 0, column: 0 }
    ): Map<string, { logical: LogicalPosition; bounds: Bounds }> {
        const result = new Map<string, { logical: LogicalPosition; bounds: Bounds }>();

        // 简单的网格布局
        const maxColumns = Math.ceil(Math.sqrt(nodes.length));

        nodes.forEach((node, index) => {
            const row = startLogical.row + Math.floor(index / maxColumns);
            const column = startLogical.column + (index % maxColumns);
            const logical = { row, column };
            const bounds = this.getNodeBounds(logical);
            result.set(node.id, { logical, bounds });
        });

        return result;
    }
}

/**
 * 创建默认坐标引擎实例
 */
export function createCoordinateEngine(config?: Partial<LayoutConfig>): CoordinateEngine {
    return new CoordinateEngine(config);
}

/**
 * 全局默认坐标引擎
 */
let defaultEngine: CoordinateEngine | null = null;

export function getDefaultCoordinateEngine(): CoordinateEngine {
    if (defaultEngine === null) {
        defaultEngine = new CoordinateEngine();
    }
    return defaultEngine;
}
