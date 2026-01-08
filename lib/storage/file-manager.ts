/**
 * 文件管理器
 * 基于 IndexedDB 提供文件的 CRUD 操作
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import {
    DiagramFile,
    DiagramVersion,
    CreateFileParams,
    UpdateFileParams,
    FILE_CONFIG,
    createNewFile,
    generateId,
} from "@/types/diagram-file";

// ============= 数据库定义 =============

const DB_NAME = "smartcanvas-files";
const DB_VERSION = 1;

interface FileDB extends DBSchema {
    files: {
        key: string;
        value: DiagramFile;
        indexes: {
            "by-updated": number;
            "by-name": string;
        };
    };
    // 分离存储大型版本数据，避免加载文件列表时加载所有版本
    versions: {
        key: string;
        value: DiagramVersion & { fileId: string };
        indexes: {
            "by-file": string;
            "by-created": number;
        };
    };
}

let dbInstance: IDBPDatabase<FileDB> | null = null;

/**
 * 获取数据库实例
 */
async function getDB(): Promise<IDBPDatabase<FileDB>> {
    if (dbInstance !== null) {
        return dbInstance;
    }

    dbInstance = await openDB<FileDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // 文件表
            if (!db.objectStoreNames.contains("files")) {
                const fileStore = db.createObjectStore("files", { keyPath: "id" });
                fileStore.createIndex("by-updated", "updatedAt");
                fileStore.createIndex("by-name", "name");
            }

            // 版本表（分离存储）
            if (!db.objectStoreNames.contains("versions")) {
                const versionStore = db.createObjectStore("versions", { keyPath: "id" });
                versionStore.createIndex("by-file", "fileId");
                versionStore.createIndex("by-created", "createdAt");
            }
        },
    });

    return dbInstance;
}

/**
 * 关闭数据库连接
 */
export async function closeFileDB(): Promise<void> {
    if (dbInstance !== null) {
        dbInstance.close();
        dbInstance = null;
    }
}

// ============= 文件操作 =============

/**
 * 创建新文件
 */
export async function createFile(params: CreateFileParams): Promise<DiagramFile> {
    const db = await getDB();

    // 检查文件数量限制
    const count = await db.count("files");
    if (count >= FILE_CONFIG.MAX_FILES) {
        throw new Error(`文件数量已达上限 (${FILE_CONFIG.MAX_FILES})，请删除一些文件后再试`);
    }

    const file = createNewFile(params);

    // 保存文件元数据（不含版本内容）
    const fileMetadata = createFileMetadata(file);
    await db.put("files", fileMetadata);

    // 保存初始版本
    const initialVersion = file.simpleVersions[0];
    await db.put("versions", { ...initialVersion, fileId: file.id });

    return file;
}

/**
 * 获取文件（包含完整版本数据）
 */
export async function getFile(id: string): Promise<DiagramFile | undefined> {
    const db = await getDB();

    const fileMetadata = await db.get("files", id);
    if (!fileMetadata) return undefined;

    // 加载版本数据
    const versions = await db.getAllFromIndex("versions", "by-file", id);

    const simpleVersions = versions
        .filter(v => v.type === "simple")
        .sort((a, b) => b.versionNumber - a.versionNumber);

    const professionalVersions = versions
        .filter(v => v.type === "professional")
        .sort((a, b) => b.versionNumber - a.versionNumber);

    return {
        ...fileMetadata,
        simpleVersions,
        professionalVersions,
    };
}

/**
 * 获取文件列表（仅元数据，不含版本内容）
 */
export async function listFiles(): Promise<DiagramFile[]> {
    const db = await getDB();
    const files = await db.getAllFromIndex("files", "by-updated");
    // 按更新时间倒序排列
    return files.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 更新文件元数据
 */
export async function updateFile(
    id: string,
    params: UpdateFileParams
): Promise<DiagramFile | undefined> {
    const db = await getDB();

    const file = await db.get("files", id);
    if (!file) return undefined;

    const updatedFile: DiagramFile = {
        ...file,
        ...params,
        updatedAt: Date.now(),
    };

    await db.put("files", updatedFile);
    return updatedFile;
}

/**
 * 删除文件
 */
export async function deleteFile(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(["files", "versions"], "readwrite");

    // 删除所有版本
    const versions = await tx.objectStore("versions").index("by-file").getAllKeys(id);
    for (const versionId of versions) {
        await tx.objectStore("versions").delete(versionId);
    }

    // 删除文件
    await tx.objectStore("files").delete(id);

    await tx.done;
}

/**
 * 保存文件（更新时间戳）
 */
export async function saveFile(file: DiagramFile): Promise<void> {
    const db = await getDB();

    const updatedFile: DiagramFile = {
        ...file,
        updatedAt: Date.now(),
    };

    // 保存文件元数据
    const metadata = createFileMetadata(updatedFile);
    await db.put("files", metadata);

    // 保存所有版本
    const tx = db.transaction("versions", "readwrite");
    for (const version of [...file.simpleVersions, ...file.professionalVersions]) {
        await tx.store.put({ ...version, fileId: file.id });
    }
    await tx.done;
}

// ============= 版本操作 =============

/**
 * 添加版本
 */
export async function addVersion(
    fileId: string,
    version: DiagramVersion
): Promise<DiagramFile | undefined> {
    const db = await getDB();

    const file = await db.get("files", fileId);
    if (!file) return undefined;

    // 检查版本数量限制
    const versions = await db.getAllFromIndex("versions", "by-file", fileId);
    const typeVersions = versions.filter(v => v.type === version.type);

    const maxVersions = version.type === "simple"
        ? FILE_CONFIG.MAX_SIMPLE_VERSIONS
        : FILE_CONFIG.MAX_PROFESSIONAL_VERSIONS;

    if (typeVersions.length >= maxVersions) {
        // 删除最早的版本
        const oldestVersion = typeVersions.sort((a, b) => a.createdAt - b.createdAt)[0];
        await db.delete("versions", oldestVersion.id);
    }

    // 添加新版本
    await db.put("versions", { ...version, fileId });

    // 更新文件的当前版本 ID
    const updatedFile: DiagramFile = {
        ...file,
        updatedAt: Date.now(),
    };

    if (version.type === "simple") {
        updatedFile.currentSimpleVersionId = version.id;
    } else {
        updatedFile.currentProfessionalVersionId = version.id;
    }

    await db.put("files", updatedFile);

    return getFile(fileId);
}

/**
 * 获取版本
 */
export async function getVersion(versionId: string): Promise<DiagramVersion | undefined> {
    const db = await getDB();
    const version = await db.get("versions", versionId);
    if (!version) return undefined;
    // 移除 fileId 属性
    const { fileId: _, ...versionData } = version;
    return versionData;
}

/**
 * 更新版本
 */
export async function updateVersion(
    versionId: string,
    updates: Partial<DiagramVersion>
): Promise<void> {
    const db = await getDB();
    const version = await db.get("versions", versionId);
    if (!version) return;

    await db.put("versions", { ...version, ...updates });
}

/**
 * 删除版本
 */
export async function deleteVersion(fileId: string, versionId: string): Promise<void> {
    const db = await getDB();

    const file = await db.get("files", fileId);
    if (!file) return;

    // 检查是否是当前版本
    if (file.currentSimpleVersionId === versionId) {
        throw new Error("无法删除当前正在使用的简明版本");
    }
    if (file.currentProfessionalVersionId === versionId) {
        throw new Error("无法删除当前正在使用的专业版本");
    }

    // 删除版本
    await db.delete("versions", versionId);
}

/**
 * 切换版本
 */
export async function switchVersion(
    fileId: string,
    versionId: string,
    type: "simple" | "professional"
): Promise<DiagramFile | undefined> {
    const db = await getDB();

    const file = await db.get("files", fileId);
    if (!file) return undefined;

    const updatedFile: DiagramFile = {
        ...file,
        updatedAt: Date.now(),
    };

    if (type === "simple") {
        updatedFile.currentSimpleVersionId = versionId;
    } else {
        updatedFile.currentProfessionalVersionId = versionId;
    }

    await db.put("files", updatedFile);

    return getFile(fileId);
}

// ============= 最近文件 =============

const RECENT_FILES_KEY = "smartcanvas-recent-files";

/**
 * 获取最近打开的文件 ID 列表
 */
export function getRecentFileIds(): string[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(RECENT_FILES_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

/**
 * 添加到最近文件
 */
export function addToRecentFiles(fileId: string): string[] {
    if (typeof window === "undefined") return [];

    let recentIds = getRecentFileIds();

    // 移除已存在的
    recentIds = recentIds.filter(id => id !== fileId);

    // 添加到开头
    recentIds.unshift(fileId);

    // 限制数量
    recentIds = recentIds.slice(0, FILE_CONFIG.MAX_RECENT_FILES);

    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentIds));

    return recentIds;
}

/**
 * 从最近文件中移除
 */
export function removeFromRecentFiles(fileId: string): string[] {
    if (typeof window === "undefined") return [];

    const recentIds = getRecentFileIds().filter(id => id !== fileId);
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recentIds));

    return recentIds;
}

// ============= 辅助函数 =============

/**
 * 创建文件元数据（不含版本内容）
 */
function createFileMetadata(file: DiagramFile): DiagramFile {
    return {
        ...file,
        // 元数据中不存储版本内容，仅保留结构
        simpleVersions: file.simpleVersions.map(v => ({
            ...v,
            excalidrawElements: undefined, // 移除大型数据
        })),
        professionalVersions: file.professionalVersions.map(v => ({
            ...v,
            excalidrawElements: undefined,
            drawioXml: undefined, // 移除大型数据
        })),
    };
}

/**
 * 自动保存工具 - 创建防抖保存函数
 */
export function createAutoSaver(
    fileId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getElements: () => any[]
): () => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(async () => {
            try {
                const elements = getElements();
                const version = await getVersion(fileId);
                if (version && version.type === "simple") {
                    await updateVersion(version.id, {
                        excalidrawElements: elements,
                    });
                }
            } catch (error) {
                console.error("Auto-save failed:", error);
            }
        }, FILE_CONFIG.AUTO_SAVE_DEBOUNCE_MS);
    };
}
