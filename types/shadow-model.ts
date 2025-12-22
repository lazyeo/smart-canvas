/**
 * 影子模型类型定义
 * 影子模型是画布元素的逻辑抽象层，用于 AI 理解和操作
 */

/**
 * 模块类型 - 表示逻辑上的图表模块
 */
export type ModuleType =
    | "flowchart"      // 流程图
    | "architecture"   // 架构图
    | "sequence"       // 时序图
    | "mindmap"        // 思维导图
    | "er"             // ER 图
    | "class"          // 类图
    | "generic";       // 通用

/**
 * 节点类型
 */
export type NodeType =
    | "process"        // 处理/步骤
    | "decision"       // 判断
    | "start"          // 开始
    | "end"            // 结束
    | "data"           // 数据
    | "entity"         // 实体
    | "actor"          // 参与者
    | "component"      // 组件
    | "container"      // 容器/分组
    | "annotation"     // 注释
    | "generic";       // 通用

/**
 * 连线类型
 */
export type EdgeType =
    | "flow"           // 流程
    | "association"    // 关联
    | "dependency"     // 依赖
    | "inheritance"    // 继承
    | "composition"    // 组合
    | "aggregation"    // 聚合
    | "message"        // 消息
    | "generic";       // 通用

/**
 * 影子模型节点
 */
export interface ShadowNode {
    id: string;
    type: NodeType;
    label: string;
    description?: string;

    // 关联的画布元素 ID 列表
    elementIds: string[];

    // 逻辑位置（相对于模块）
    logicalPosition: {
        row: number;
        column: number;
    };

    // 实际位置（画布坐标）
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };

    // 自定义属性
    properties: Record<string, unknown>;

    // 时间戳
    createdAt: number;
    updatedAt: number;
}

/**
 * 影子模型连线
 */
export interface ShadowEdge {
    id: string;
    type: EdgeType;
    label?: string;

    // 源节点和目标节点
    sourceNodeId: string;
    targetNodeId: string;

    // 关联的画布元素 ID
    elementId: string;

    // 自定义属性
    properties: Record<string, unknown>;

    // 时间戳
    createdAt: number;
    updatedAt: number;
}

/**
 * 影子模型模块 - 表示一个逻辑图表单元
 */
export interface ShadowModule {
    id: string;
    name: string;
    type: ModuleType;
    description?: string;

    // 包含的节点和连线
    nodeIds: string[];
    edgeIds: string[];

    // 模块边界（画布坐标）
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };

    // 布局配置
    layout: {
        direction: "TB" | "LR" | "BT" | "RL";  // Top-Bottom, Left-Right, etc.
        spacing: number;
    };

    // 时间戳
    createdAt: number;
    updatedAt: number;
}

/**
 * 影子模型项目 - 顶层容器
 */
export interface ShadowProject {
    id: string;
    name: string;
    description?: string;

    // 引擎类型
    engine: "excalidraw" | "drawio";

    // 包含的模块
    moduleIds: string[];

    // 画布配置
    canvasConfig: {
        width: number;
        height: number;
        background: string;
    };

    // 时间戳
    createdAt: number;
    updatedAt: number;
}

/**
 * 元素-节点映射
 */
export interface ElementNodeMapping {
    elementId: string;
    nodeId: string;
    moduleId: string;
}

/**
 * 版本快照
 */
export interface VersionSnapshot {
    id: string;
    projectId: string;
    name: string;
    description?: string;

    // 快照数据
    data: {
        project: ShadowProject;
        modules: ShadowModule[];
        nodes: ShadowNode[];
        edges: ShadowEdge[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        excalidrawElements: any[];
    };

    // 时间戳
    createdAt: number;
}
