/**
 * 影子模型管理器
 * 提供影子模型的高级操作和画布元素同步
 */

import {
    ShadowProject,
    ShadowModule,
    ShadowNode,
    ShadowEdge,
    ModuleType,
    NodeType,
    EdgeType,
} from "@/types";
import {
    saveProject,
    getProject,
    saveModule,
    getModulesByProject,
    saveNode,
    getNodesByModule,
    saveEdge,
    getEdgesByModule,
    deleteModule,
    deleteNode,
    deleteEdge,
} from "./indexed-db";

/**
 * 生成唯一 ID
 */
function generateId(): string {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建新项目
 */
export async function createProject(
    name: string,
    engine: "excalidraw" | "drawio" = "excalidraw"
): Promise<ShadowProject> {
    const now = Date.now();
    const project: ShadowProject = {
        id: generateId(),
        name,
        engine,
        moduleIds: [],
        canvasConfig: {
            width: 1920,
            height: 1080,
            background: "#ffffff",
        },
        createdAt: now,
        updatedAt: now,
    };

    await saveProject(project);
    return project;
}

/**
 * 创建新模块
 */
export async function createModule(
    projectId: string,
    name: string,
    type: ModuleType = "generic",
    bounds?: { x: number; y: number; width: number; height: number }
): Promise<ShadowModule> {
    const now = Date.now();
    const module: ShadowModule = {
        id: generateId(),
        name,
        type,
        nodeIds: [],
        edgeIds: [],
        bounds: bounds || { x: 0, y: 0, width: 400, height: 300 },
        layout: {
            direction: "TB",
            spacing: 50,
        },
        createdAt: now,
        updatedAt: now,
    };

    await saveModule({ ...module, projectId });

    // 更新项目的模块列表
    const project = await getProject(projectId);
    if (project) {
        project.moduleIds.push(module.id);
        project.updatedAt = now;
        await saveProject(project);
    }

    return module;
}

/**
 * 创建新节点
 */
export async function createNode(
    moduleId: string,
    label: string,
    type: NodeType = "generic",
    position: { x: number; y: number; width?: number; height?: number },
    elementIds: string[] = []
): Promise<ShadowNode> {
    const now = Date.now();
    const node: ShadowNode = {
        id: generateId(),
        type,
        label,
        elementIds,
        logicalPosition: { row: 0, column: 0 },
        position: {
            x: position.x,
            y: position.y,
            width: position.width || 120,
            height: position.height || 60,
        },
        properties: {},
        createdAt: now,
        updatedAt: now,
    };

    await saveNode({ ...node, moduleId });

    // 更新模块的节点列表
    const modules = await getModulesByProject("");
    const module = modules.find((m) => m.id === moduleId);
    if (module) {
        // 这里简化处理，实际需要从正确的 projectId 获取
    }

    return node;
}

/**
 * 创建新连线
 */
export async function createEdge(
    moduleId: string,
    sourceNodeId: string,
    targetNodeId: string,
    type: EdgeType = "flow",
    elementId: string = "",
    label?: string
): Promise<ShadowEdge> {
    const now = Date.now();
    const edge: ShadowEdge = {
        id: generateId(),
        type,
        label,
        sourceNodeId,
        targetNodeId,
        elementId,
        properties: {},
        createdAt: now,
        updatedAt: now,
    };

    await saveEdge({ ...edge, moduleId });
    return edge;
}

/**
 * 获取模块的完整数据（包含节点和连线）
 */
export async function getModuleWithContents(
    moduleId: string
): Promise<{
    module: ShadowModule | undefined;
    nodes: ShadowNode[];
    edges: ShadowEdge[];
}> {
    const modules = await getModulesByProject(""); // 需要改进
    const module = modules.find((m) => m.id === moduleId);
    const nodes = await getNodesByModule(moduleId);
    const edges = await getEdgesByModule(moduleId);

    return { module, nodes, edges };
}

/**
 * 删除模块及其所有内容
 */
export async function deleteModuleWithContents(moduleId: string): Promise<void> {
    // 删除所有节点
    const nodes = await getNodesByModule(moduleId);
    for (const node of nodes) {
        await deleteNode(node.id);
    }

    // 删除所有连线
    const edges = await getEdgesByModule(moduleId);
    for (const edge of edges) {
        await deleteEdge(edge.id);
    }

    // 删除模块
    await deleteModule(moduleId);
}

/**
 * 从 Excalidraw 元素推断节点类型
 */
export function inferNodeType(elementType: string): NodeType {
    const typeMap: Record<string, NodeType> = {
        rectangle: "process",
        ellipse: "start",
        diamond: "decision",
        text: "annotation",
        image: "generic",
    };
    return typeMap[elementType] || "generic";
}

/**
 * 从 Excalidraw 箭头推断连线类型
 */
export function inferEdgeType(arrowType?: string): EdgeType {
    // 默认是流程箭头
    return "flow";
}
