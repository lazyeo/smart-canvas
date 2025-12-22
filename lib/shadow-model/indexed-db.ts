/**
 * IndexedDB 存储层
 * 使用 idb 库提供类型安全的 IndexedDB 操作
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import {
    ShadowProject,
    ShadowModule,
    ShadowNode,
    ShadowEdge,
    VersionSnapshot,
} from "@/types";

const DB_NAME = "smartcanvas";
const DB_VERSION = 1;

interface SmartCanvasDB extends DBSchema {
    projects: {
        key: string;
        value: ShadowProject;
        indexes: {
            "by-updated": number;
        };
    };
    modules: {
        key: string;
        value: ShadowModule;
        indexes: {
            "by-project": string;
        };
    };
    nodes: {
        key: string;
        value: ShadowNode;
        indexes: {
            "by-module": string;
        };
    };
    edges: {
        key: string;
        value: ShadowEdge;
        indexes: {
            "by-module": string;
        };
    };
    snapshots: {
        key: string;
        value: VersionSnapshot;
        indexes: {
            "by-project": string;
            "by-created": number;
        };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: {
        key: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any;
        indexes: {
            "by-project": string;
        };
    };
}

let dbInstance: IDBPDatabase<SmartCanvasDB> | null = null;

/**
 * 获取数据库实例
 */
export async function getDB(): Promise<IDBPDatabase<SmartCanvasDB>> {
    if (dbInstance !== null) {
        return dbInstance;
    }

    dbInstance = await openDB<SmartCanvasDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // 项目表
            if (!db.objectStoreNames.contains("projects")) {
                const projectStore = db.createObjectStore("projects", { keyPath: "id" });
                projectStore.createIndex("by-updated", "updatedAt");
            }

            // 模块表
            if (!db.objectStoreNames.contains("modules")) {
                const moduleStore = db.createObjectStore("modules", { keyPath: "id" });
                moduleStore.createIndex("by-project", "projectId");
            }

            // 节点表
            if (!db.objectStoreNames.contains("nodes")) {
                const nodeStore = db.createObjectStore("nodes", { keyPath: "id" });
                nodeStore.createIndex("by-module", "moduleId");
            }

            // 连线表
            if (!db.objectStoreNames.contains("edges")) {
                const edgeStore = db.createObjectStore("edges", { keyPath: "id" });
                edgeStore.createIndex("by-module", "moduleId");
            }

            // 快照表
            if (!db.objectStoreNames.contains("snapshots")) {
                const snapshotStore = db.createObjectStore("snapshots", { keyPath: "id" });
                snapshotStore.createIndex("by-project", "projectId");
                snapshotStore.createIndex("by-created", "createdAt");
            }

            // 画布元素表
            if (!db.objectStoreNames.contains("elements")) {
                const elementStore = db.createObjectStore("elements", { keyPath: "id" });
                elementStore.createIndex("by-project", "projectId");
            }
        },
    });

    return dbInstance;
}

/**
 * 关闭数据库连接
 */
export async function closeDB(): Promise<void> {
    if (dbInstance !== null) {
        dbInstance.close();
        dbInstance = null;
    }
}

// ============= 项目操作 =============

export async function saveProject(project: ShadowProject): Promise<void> {
    const db = await getDB();
    await db.put("projects", project);
}

export async function getProject(id: string): Promise<ShadowProject | undefined> {
    const db = await getDB();
    return db.get("projects", id);
}

export async function getAllProjects(): Promise<ShadowProject[]> {
    const db = await getDB();
    return db.getAllFromIndex("projects", "by-updated");
}

export async function deleteProject(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("projects", id);
}

// ============= 模块操作 =============

export async function saveModule(module: ShadowModule & { projectId: string }): Promise<void> {
    const db = await getDB();
    await db.put("modules", module);
}

export async function getModule(id: string): Promise<ShadowModule | undefined> {
    const db = await getDB();
    return db.get("modules", id);
}

export async function getModulesByProject(projectId: string): Promise<ShadowModule[]> {
    const db = await getDB();
    return db.getAllFromIndex("modules", "by-project", projectId);
}

export async function deleteModule(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("modules", id);
}

// ============= 节点操作 =============

export async function saveNode(node: ShadowNode & { moduleId: string }): Promise<void> {
    const db = await getDB();
    await db.put("nodes", node);
}

export async function getNode(id: string): Promise<ShadowNode | undefined> {
    const db = await getDB();
    return db.get("nodes", id);
}

export async function getNodesByModule(moduleId: string): Promise<ShadowNode[]> {
    const db = await getDB();
    return db.getAllFromIndex("nodes", "by-module", moduleId);
}

export async function deleteNode(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("nodes", id);
}

// ============= 连线操作 =============

export async function saveEdge(edge: ShadowEdge & { moduleId: string }): Promise<void> {
    const db = await getDB();
    await db.put("edges", edge);
}

export async function getEdge(id: string): Promise<ShadowEdge | undefined> {
    const db = await getDB();
    return db.get("edges", id);
}

export async function getEdgesByModule(moduleId: string): Promise<ShadowEdge[]> {
    const db = await getDB();
    return db.getAllFromIndex("edges", "by-module", moduleId);
}

export async function deleteEdge(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("edges", id);
}

// ============= 快照操作 =============

export async function saveSnapshot(snapshot: VersionSnapshot): Promise<void> {
    const db = await getDB();
    await db.put("snapshots", snapshot);
}

export async function getSnapshot(id: string): Promise<VersionSnapshot | undefined> {
    const db = await getDB();
    return db.get("snapshots", id);
}

export async function getSnapshotsByProject(projectId: string): Promise<VersionSnapshot[]> {
    const db = await getDB();
    return db.getAllFromIndex("snapshots", "by-project", projectId);
}

export async function deleteSnapshot(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("snapshots", id);
}

// ============= 画布元素操作 =============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveElements(projectId: string, elements: any[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction("elements", "readwrite");

    // 删除旧元素
    const existingElements = await tx.store.index("by-project").getAllKeys(projectId);
    for (const key of existingElements) {
        await tx.store.delete(key);
    }

    // 保存新元素
    for (const element of elements) {
        await tx.store.put({ ...element, projectId });
    }

    await tx.done;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getElements(projectId: string): Promise<any[]> {
    const db = await getDB();
    return db.getAllFromIndex("elements", "by-project", projectId);
}
