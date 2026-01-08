/**
 * 版本管理器
 * 提供简明版和专业版的版本控制功能
 */

import {
    DiagramFile,
    DiagramVersion,
    CreateVersionParams,
    EnhancementOptions,
    FILE_CONFIG,
    createNewVersion,
    getCurrentSimpleVersion,
    getCurrentProfessionalVersion,
} from "@/types/diagram-file";
import {
    getFile,
    saveFile,
    addVersion,
    deleteVersion as deleteVersionFromDB,
    switchVersion as switchVersionInDB,
    updateVersion,
} from "./file-manager";

// ============= 简明版操作 =============

/**
 * 创建简明版新版本
 */
export async function createSimpleVersion(
    fileId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[],
    note?: string
): Promise<DiagramFile | undefined> {
    const file = await getFile(fileId);
    if (!file) return undefined;

    const version = createNewVersion(file, {
        type: "simple",
        excalidrawElements: elements,
        note: note || `版本 ${file.simpleVersions.length + 1}`,
        autoSave: false,
    });

    return addVersion(fileId, version);
}

/**
 * 自动保存简明版（更新当前版本，不创建新版本）
 */
export async function autoSaveSimpleVersion(
    fileId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[]
): Promise<void> {
    const file = await getFile(fileId);
    if (!file) return;

    const currentVersion = getCurrentSimpleVersion(file);
    if (!currentVersion) return;

    // 更新当前版本的元素
    await updateVersion(currentVersion.id, {
        excalidrawElements: elements,
    });

    // 同时更新文件的 updatedAt 时间戳
    const { updateFile } = await import("./file-manager");
    await updateFile(fileId, {});
}

/**
 * 获取简明版版本列表
 */
export async function getSimpleVersions(fileId: string): Promise<DiagramVersion[]> {
    const file = await getFile(fileId);
    if (!file) return [];
    return file.simpleVersions.sort((a, b) => b.versionNumber - a.versionNumber);
}

/**
 * 切换简明版版本
 */
export async function switchSimpleVersion(
    fileId: string,
    versionId: string
): Promise<DiagramFile | undefined> {
    return switchVersionInDB(fileId, versionId, "simple");
}

/**
 * 删除简明版版本
 */
export async function deleteSimpleVersion(
    fileId: string,
    versionId: string
): Promise<DiagramFile | undefined> {
    const file = await getFile(fileId);
    if (!file) return undefined;

    // 确保至少保留一个简明版
    if (file.simpleVersions.length <= 1) {
        throw new Error("至少需要保留一个简明版本");
    }

    await deleteVersionFromDB(fileId, versionId);
    return getFile(fileId);
}

// ============= 专业版操作 =============

/**
 * 创建专业版新版本
 */
export async function createProfessionalVersion(
    fileId: string,
    drawioXml: string,
    enhancementOptions: EnhancementOptions,
    note?: string
): Promise<DiagramFile | undefined> {
    const file = await getFile(fileId);
    if (!file) return undefined;

    const currentSimple = getCurrentSimpleVersion(file);
    if (!currentSimple) {
        throw new Error("需要先有简明版才能生成专业版");
    }

    const version = createNewVersion(file, {
        type: "professional",
        drawioXml,
        enhancementOptions,
        sourceSimpleVersionId: currentSimple.id,
        note: note || `基于简明版 v${currentSimple.versionNumber}`,
        autoSave: false,
    });

    return addVersion(fileId, version);
}

/**
 * 获取专业版版本列表
 */
export async function getProfessionalVersions(fileId: string): Promise<DiagramVersion[]> {
    const file = await getFile(fileId);
    if (!file) return [];
    return file.professionalVersions.sort((a, b) => b.versionNumber - a.versionNumber);
}

/**
 * 切换专业版版本
 */
export async function switchProfessionalVersion(
    fileId: string,
    versionId: string
): Promise<DiagramFile | undefined> {
    return switchVersionInDB(fileId, versionId, "professional");
}

/**
 * 删除专业版版本
 */
export async function deleteProfessionalVersion(
    fileId: string,
    versionId: string
): Promise<DiagramFile | undefined> {
    await deleteVersionFromDB(fileId, versionId);

    const file = await getFile(fileId);
    if (!file) return undefined;

    // 如果删除的是当前版本，切换到最新版本
    if (file.professionalVersions.length > 0 && !file.currentProfessionalVersionId) {
        const latest = file.professionalVersions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
        return switchProfessionalVersion(fileId, latest.id);
    }

    return file;
}

// ============= 版本比较 =============

/**
 * 获取版本的来源信息
 */
export async function getVersionSource(
    fileId: string,
    versionId: string
): Promise<{ simpleVersion?: DiagramVersion; note: string } | undefined> {
    const file = await getFile(fileId);
    if (!file) return undefined;

    const version = [...file.simpleVersions, ...file.professionalVersions]
        .find(v => v.id === versionId);

    if (!version) return undefined;

    if (version.type === "simple") {
        return {
            note: "简明版",
        };
    }

    // 专业版，查找来源的简明版
    if (version.sourceSimpleVersionId) {
        const sourceSimple = file.simpleVersions.find(
            v => v.id === version.sourceSimpleVersionId
        );
        return {
            simpleVersion: sourceSimple,
            note: sourceSimple
                ? `基于简明版 v${sourceSimple.versionNumber}`
                : "基于的简明版已被删除",
        };
    }

    return {
        note: "专业版",
    };
}

/**
 * 获取基于同一简明版生成的所有专业版
 */
export async function getProfessionalVersionsBySource(
    fileId: string,
    simpleVersionId: string
): Promise<DiagramVersion[]> {
    const file = await getFile(fileId);
    if (!file) return [];

    return file.professionalVersions
        .filter(v => v.sourceSimpleVersionId === simpleVersionId)
        .sort((a, b) => b.versionNumber - a.versionNumber);
}

// ============= 版本限制管理 =============

/**
 * 检查是否可以创建新的简明版
 */
export async function canCreateSimpleVersion(fileId: string): Promise<{
    canCreate: boolean;
    reason?: string;
    willDeleteOldest?: DiagramVersion;
}> {
    const file = await getFile(fileId);
    if (!file) {
        return { canCreate: false, reason: "文件不存在" };
    }

    if (file.simpleVersions.length >= FILE_CONFIG.MAX_SIMPLE_VERSIONS) {
        const oldest = file.simpleVersions.sort((a, b) => a.createdAt - b.createdAt)[0];
        return {
            canCreate: true,
            reason: `将自动删除最早的版本 v${oldest.versionNumber}`,
            willDeleteOldest: oldest,
        };
    }

    return { canCreate: true };
}

/**
 * 检查是否可以创建新的专业版
 */
export async function canCreateProfessionalVersion(fileId: string): Promise<{
    canCreate: boolean;
    reason?: string;
    willDeleteOldest?: DiagramVersion;
}> {
    const file = await getFile(fileId);
    if (!file) {
        return { canCreate: false, reason: "文件不存在" };
    }

    if (file.simpleVersions.length === 0) {
        return { canCreate: false, reason: "需要先有简明版才能生成专业版" };
    }

    if (file.professionalVersions.length >= FILE_CONFIG.MAX_PROFESSIONAL_VERSIONS) {
        const oldest = file.professionalVersions.sort((a, b) => a.createdAt - b.createdAt)[0];
        return {
            canCreate: true,
            reason: `将自动删除最早的版本 v${oldest.versionNumber}`,
            willDeleteOldest: oldest,
        };
    }

    return { canCreate: true };
}

// ============= 版本统计 =============

/**
 * 获取版本统计信息
 */
export async function getVersionStats(fileId: string): Promise<{
    simpleCount: number;
    professionalCount: number;
    latestSimple?: DiagramVersion;
    latestProfessional?: DiagramVersion;
    currentSimple?: DiagramVersion;
    currentProfessional?: DiagramVersion;
}> {
    const file = await getFile(fileId);
    if (!file) {
        return {
            simpleCount: 0,
            professionalCount: 0,
        };
    }

    const sortedSimple = file.simpleVersions.sort((a, b) => b.versionNumber - a.versionNumber);
    const sortedProfessional = file.professionalVersions.sort((a, b) => b.versionNumber - a.versionNumber);

    return {
        simpleCount: file.simpleVersions.length,
        professionalCount: file.professionalVersions.length,
        latestSimple: sortedSimple[0],
        latestProfessional: sortedProfessional[0],
        currentSimple: getCurrentSimpleVersion(file),
        currentProfessional: getCurrentProfessionalVersion(file),
    };
}

// ============= 版本导出 =============

/**
 * 导出文件的所有版本
 */
export async function exportAllVersions(fileId: string): Promise<{
    file: DiagramFile;
    simpleVersions: DiagramVersion[];
    professionalVersions: DiagramVersion[];
} | undefined> {
    const file = await getFile(fileId);
    if (!file) return undefined;

    return {
        file,
        simpleVersions: file.simpleVersions,
        professionalVersions: file.professionalVersions,
    };
}

/**
 * 导入版本数据
 */
export async function importVersions(
    fileId: string,
    versions: DiagramVersion[]
): Promise<DiagramFile | undefined> {
    const file = await getFile(fileId);
    if (!file) return undefined;

    for (const version of versions) {
        await addVersion(fileId, version);
    }

    return getFile(fileId);
}
