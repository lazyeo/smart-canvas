/**
 * 图表文件管理类型定义
 * 支持文件管理、版本控制和专业版增强
 */

import type { ModuleType } from "./shadow-model";

// ============= 增强选项类型 =============

/**
 * 增强级别
 */
export type EnhancementLevel = "basic" | "standard" | "advanced";

/**
 * 颜色方案
 */
export type ColorScheme = "professional" | "modern" | "minimal";

/**
 * 增强选项 - 用于配置专业版生成
 */
export interface EnhancementOptions {
    level: EnhancementLevel;

    structure: {
        addSwimlanes: boolean;        // 添加泳道
        addParallelBranches: boolean; // 并行分支
    };

    nodes: {
        useProfessionalSymbols: boolean; // BPMN/UML 符号
        addDetails: boolean;             // 详细属性
    };

    edges: {
        addConditionLabels: boolean;  // 条件标注
        addSequenceNumbers: boolean;  // 序号
    };

    style: {
        colorScheme: ColorScheme;
        addLegend: boolean;
        addTitle: boolean;
    };
}

/**
 * 默认增强选项
 */
export const DEFAULT_ENHANCEMENT_OPTIONS: EnhancementOptions = {
    level: "standard",
    structure: {
        addSwimlanes: true,
        addParallelBranches: false,
    },
    nodes: {
        useProfessionalSymbols: true,
        addDetails: false,
    },
    edges: {
        addConditionLabels: true,
        addSequenceNumbers: false,
    },
    style: {
        colorScheme: "professional",
        addLegend: false,
        addTitle: true,
    },
};

// ============= 版本类型 =============

/**
 * 版本类型
 */
export type VersionType = "simple" | "professional";

/**
 * 单个版本
 */
export interface DiagramVersion {
    id: string;
    versionNumber: number;           // v1, v2, v3...
    type: VersionType;
    createdAt: number;

    // 简明版内容（Excalidraw 元素）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    excalidrawElements?: any[];

    // 专业版内容
    drawioXml?: string;
    enhancementOptions?: EnhancementOptions;
    sourceSimpleVersionId?: string;  // 专业版基于哪个简明版生成

    // 版本说明
    note?: string;                   // 用户备注，如 "添加了错误处理"
    autoSave?: boolean;              // 是否自动保存的版本
}

// ============= 文件类型 =============

/**
 * 对话消息类型（用于持久化）
 */
export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

/**
 * 图表文件 - 用户创建的每个流程图/架构图等
 */
export interface DiagramFile {
    id: string;
    name: string;                    // 如 "用户登录流程"、"订单处理系统"
    type: ModuleType;                // flowchart, er, architecture 等
    description?: string;
    createdAt: number;
    updatedAt: number;

    // 版本管理
    simpleVersions: DiagramVersion[];      // 简明版历史
    professionalVersions: DiagramVersion[]; // 专业版历史
    currentSimpleVersionId: string;         // 当前显示的简明版
    currentProfessionalVersionId?: string;  // 当前显示的专业版

    // 对话历史
    chatHistory?: ChatMessage[];      // 该文件的对话历史

    // 元数据
    tags?: string[];
    thumbnail?: string;              // 缩略图 base64
}

/**
 * 文件列表状态
 */
export interface FileManagerState {
    files: DiagramFile[];
    currentFileId: string | null;    // 当前打开的文件
    recentFileIds: string[];         // 最近打开的文件（最多 10 个）
    isLoading: boolean;
    error: string | null;
}

// ============= 文件操作类型 =============

/**
 * 创建文件参数
 */
export interface CreateFileParams {
    name: string;
    type?: ModuleType;
    description?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialElements?: any[];         // 初始 Excalidraw 元素
}

/**
 * 更新文件参数
 */
export interface UpdateFileParams {
    name?: string;
    description?: string;
    tags?: string[];
    thumbnail?: string;
    chatHistory?: ChatMessage[];
}

/**
 * 创建版本参数
 */
export interface CreateVersionParams {
    fileId: string;
    type: VersionType;
    note?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    excalidrawElements?: any[];      // 简明版
    drawioXml?: string;               // 专业版
    enhancementOptions?: EnhancementOptions;
    sourceSimpleVersionId?: string;   // 专业版基于的简明版
    autoSave?: boolean;
}

// ============= 配置常量 =============

/**
 * 文件管理配置
 */
export const FILE_CONFIG = {
    MAX_FILES: 50,                    // 最大文件数量
    MAX_SIMPLE_VERSIONS: 10,          // 简明版最大版本数
    MAX_PROFESSIONAL_VERSIONS: 10,    // 专业版最大版本数
    MAX_RECENT_FILES: 10,             // 最近文件最大数量
    AUTO_SAVE_DEBOUNCE_MS: 2000,      // 自动保存防抖时间
    DEFAULT_FILE_NAME: "未命名图表",   // 默认文件名
} as const;

// ============= 工具函数类型 =============

/**
 * 生成唯一 ID
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 创建新文件
 */
export function createNewFile(params: CreateFileParams): DiagramFile {
    const now = Date.now();
    const fileId = generateId();
    const versionId = generateId();

    const initialVersion: DiagramVersion = {
        id: versionId,
        versionNumber: 1,
        type: "simple",
        createdAt: now,
        excalidrawElements: params.initialElements || [],
        note: "初始版本",
        autoSave: false,
    };

    return {
        id: fileId,
        name: params.name || FILE_CONFIG.DEFAULT_FILE_NAME,
        type: params.type || "flowchart",
        description: params.description,
        createdAt: now,
        updatedAt: now,
        simpleVersions: [initialVersion],
        professionalVersions: [],
        currentSimpleVersionId: versionId,
        currentProfessionalVersionId: undefined,
        tags: [],
        thumbnail: undefined,
    };
}

/**
 * 创建新版本
 */
export function createNewVersion(
    file: DiagramFile,
    params: Omit<CreateVersionParams, "fileId">
): DiagramVersion {
    const versions = params.type === "simple"
        ? file.simpleVersions
        : file.professionalVersions;

    const maxVersionNumber = versions.reduce(
        (max, v) => Math.max(max, v.versionNumber),
        0
    );

    return {
        id: generateId(),
        versionNumber: maxVersionNumber + 1,
        type: params.type,
        createdAt: Date.now(),
        excalidrawElements: params.excalidrawElements,
        drawioXml: params.drawioXml,
        enhancementOptions: params.enhancementOptions,
        sourceSimpleVersionId: params.sourceSimpleVersionId,
        note: params.note,
        autoSave: params.autoSave || false,
    };
}

/**
 * 获取当前简明版
 */
export function getCurrentSimpleVersion(file: DiagramFile): DiagramVersion | undefined {
    return file.simpleVersions.find(v => v.id === file.currentSimpleVersionId);
}

/**
 * 获取当前专业版
 */
export function getCurrentProfessionalVersion(file: DiagramFile): DiagramVersion | undefined {
    if (!file.currentProfessionalVersionId) return undefined;
    return file.professionalVersions.find(v => v.id === file.currentProfessionalVersionId);
}

/**
 * 格式化版本时间
 */
export function formatVersionTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) {
        return "刚刚";
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)} 分钟前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)} 小时前`;
    } else if (diff < 2 * day) {
        return "昨天";
    } else if (diff < 7 * day) {
        return `${Math.floor(diff / day)} 天前`;
    } else {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
}
