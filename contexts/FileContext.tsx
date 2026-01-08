"use client";

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    ReactNode,
    useMemo,
} from "react";
import {
    DiagramFile,
    DiagramVersion,
    FileManagerState,
    CreateFileParams,
    UpdateFileParams,
    EnhancementOptions,
    FILE_CONFIG,
    getCurrentSimpleVersion,
    getCurrentProfessionalVersion,
    ChatMessage,
} from "@/types/diagram-file";
import {
    createFile,
    getFile,
    listFiles,
    updateFile,
    deleteFile as deleteFileFromDB,
    saveFile,
    getRecentFileIds,
    addToRecentFiles,
    removeFromRecentFiles,
} from "@/lib/storage/file-manager";
import {
    createSimpleVersion,
    autoSaveSimpleVersion,
    createProfessionalVersion,
    switchSimpleVersion,
    switchProfessionalVersion,
    deleteSimpleVersion,
    deleteProfessionalVersion,
    getVersionStats,
} from "@/lib/storage/version-manager";

// ============= Context 类型定义 =============

// 保存状态类型
type SaveStatus = "idle" | "saving" | "saved" | "error";

interface FileContextValue {
    // 状态
    state: FileManagerState;
    currentFile: DiagramFile | null;
    currentSimpleVersion: DiagramVersion | undefined;
    currentProfessionalVersion: DiagramVersion | undefined;
    saveStatus: SaveStatus;

    // 文件操作
    files: DiagramFile[];
    isLoading: boolean;
    createNewFile: (params?: CreateFileParams) => Promise<DiagramFile>;
    createFile: (params: CreateFileParams) => Promise<DiagramFile>;
    openFile: (fileId: string) => Promise<void>;
    closeFile: () => void;
    updateCurrentFile: (params: UpdateFileParams) => Promise<void>;
    deleteCurrentFile: () => Promise<void>;
    deleteFile: (fileId: string) => Promise<void>;
    deleteFileById: (fileId: string) => Promise<void>;
    renameFile: (fileId: string, newName: string) => Promise<void>;

    // 版本操作
    saveAsNewSimpleVersion: (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elements: any[],
        note?: string
    ) => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoSave: (elements: any[]) => void;
    generateProfessionalVersion: (
        drawioXml: string,
        options: EnhancementOptions,
        note?: string
    ) => Promise<void>;
    switchToSimpleVersion: (versionId: string) => Promise<void>;
    switchToProfessionalVersion: (versionId: string) => Promise<void>;
    deleteVersion: (versionId: string, type: "simple" | "professional") => Promise<void>;

    // 对话历史
    saveChatHistory: (messages: ChatMessage[]) => Promise<void>;

    // 刷新
    refreshFiles: () => Promise<void>;
}

const FileContext = createContext<FileContextValue | null>(null);

// ============= Provider =============

export function FileProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<FileManagerState>({
        files: [],
        currentFileId: null,
        recentFileIds: [],
        isLoading: true,
        error: null,
    });

    const [currentFile, setCurrentFile] = useState<DiagramFile | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

    // 自动保存定时器
    const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const saveStatusTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    // 初始化：加载文件列表和最近文件
    useEffect(() => {
        async function init() {
            try {
                const files = await listFiles();
                const recentFileIds = getRecentFileIds();

                setState(prev => ({
                    ...prev,
                    files,
                    recentFileIds,
                    isLoading: false,
                }));

                // 如果有最近打开的文件，自动打开
                if (recentFileIds.length > 0) {
                    const recentFile = await getFile(recentFileIds[0]);
                    if (recentFile) {
                        setCurrentFile(recentFile);
                        setState(prev => ({
                            ...prev,
                            currentFileId: recentFile.id,
                        }));
                    }
                }
            } catch (error) {
                console.error("Failed to initialize file manager:", error);
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: "加载文件失败",
                }));
            }
        }

        init();
    }, []);

    // 计算当前版本
    const currentSimpleVersion = useMemo(() => {
        if (!currentFile) return undefined;
        return getCurrentSimpleVersion(currentFile);
    }, [currentFile]);

    const currentProfessionalVersion = useMemo(() => {
        if (!currentFile) return undefined;
        return getCurrentProfessionalVersion(currentFile);
    }, [currentFile]);

    // ============= 文件操作 =============

    const createNewFile = useCallback(async (params?: CreateFileParams): Promise<DiagramFile> => {
        const file = await createFile(params || { name: FILE_CONFIG.DEFAULT_FILE_NAME });

        // 更新状态
        setState(prev => ({
            ...prev,
            files: [file, ...prev.files],
            currentFileId: file.id,
            recentFileIds: addToRecentFiles(file.id),
        }));

        setCurrentFile(file);
        return file;
    }, []);

    const openFile = useCallback(async (fileId: string): Promise<void> => {
        const file = await getFile(fileId);
        if (!file) {
            throw new Error("文件不存在");
        }

        setCurrentFile(file);
        setState(prev => ({
            ...prev,
            currentFileId: file.id,
            recentFileIds: addToRecentFiles(file.id),
        }));
    }, []);

    const closeFile = useCallback(() => {
        setCurrentFile(null);
        setState(prev => ({
            ...prev,
            currentFileId: null,
        }));
    }, []);

    const updateCurrentFile = useCallback(async (params: UpdateFileParams): Promise<void> => {
        if (!currentFile) return;

        const updated = await updateFile(currentFile.id, params);
        if (updated) {
            // 重新获取完整文件数据
            const fullFile = await getFile(currentFile.id);
            if (fullFile) {
                setCurrentFile(fullFile);
                setState(prev => ({
                    ...prev,
                    files: prev.files.map(f => f.id === fullFile.id ? fullFile : f),
                }));
            }
        }
    }, [currentFile]);

    const deleteCurrentFile = useCallback(async (): Promise<void> => {
        if (!currentFile) return;

        await deleteFileFromDB(currentFile.id);
        removeFromRecentFiles(currentFile.id);

        setState(prev => ({
            ...prev,
            files: prev.files.filter(f => f.id !== currentFile.id),
            currentFileId: null,
            recentFileIds: prev.recentFileIds.filter(id => id !== currentFile.id),
        }));

        setCurrentFile(null);
    }, [currentFile]);

    const deleteFileById = useCallback(async (fileId: string): Promise<void> => {
        await deleteFileFromDB(fileId);
        removeFromRecentFiles(fileId);

        setState(prev => ({
            ...prev,
            files: prev.files.filter(f => f.id !== fileId),
            currentFileId: prev.currentFileId === fileId ? null : prev.currentFileId,
            recentFileIds: prev.recentFileIds.filter(id => id !== fileId),
        }));

        if (currentFile?.id === fileId) {
            setCurrentFile(null);
        }
    }, [currentFile]);

    const renameFile = useCallback(async (fileId: string, newName: string): Promise<void> => {
        setSaveStatus("saving");

        try {
            const updated = await updateFile(fileId, { name: newName });
            if (updated) {
                const fullFile = await getFile(fileId);
                if (fullFile) {
                    if (currentFile?.id === fileId) {
                        setCurrentFile(fullFile);
                    }
                    setState(prev => ({
                        ...prev,
                        files: prev.files.map(f => f.id === fileId ? fullFile : f),
                    }));
                }
            }

            setSaveStatus("saved");

            // 3秒后重置状态
            if (saveStatusTimerRef.current) {
                clearTimeout(saveStatusTimerRef.current);
            }
            saveStatusTimerRef.current = setTimeout(() => {
                setSaveStatus("idle");
            }, 3000);
        } catch (error) {
            console.error("Rename failed:", error);
            setSaveStatus("error");
        }
    }, [currentFile]);

    // ============= 版本操作 =============

    const saveAsNewSimpleVersion = useCallback(async (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elements: any[],
        note?: string
    ): Promise<void> => {
        if (!currentFile) return;

        const updated = await createSimpleVersion(currentFile.id, elements, note);
        if (updated) {
            setCurrentFile(updated);
            setState(prev => ({
                ...prev,
                files: prev.files.map(f => f.id === updated.id ? updated : f),
            }));
        }
    }, [currentFile]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoSave = useCallback((elements: any[]) => {
        if (!currentFile) return;

        // 清除之前的定时器
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        // 设置新的定时器
        autoSaveTimerRef.current = setTimeout(async () => {
            try {
                await autoSaveSimpleVersion(currentFile.id, elements);

                // 异步生成缩略图（不阻塞保存）
                generateAndSaveThumbnail(currentFile.id, elements);
            } catch (error) {
                console.error("Auto-save failed:", error);
            }
        }, FILE_CONFIG.AUTO_SAVE_DEBOUNCE_MS);
    }, [currentFile]);

    // 生成并保存缩略图（异步，不阻塞主流程）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generateAndSaveThumbnail = async (fileId: string, elements: any[]) => {
        try {
            const { generateThumbnail, generatePlaceholderThumbnail, countElementStats } = await import("@/lib/utils/thumbnail");

            // 尝试生成真实缩略图
            let thumbnail = await generateThumbnail(elements);

            // 如果失败，使用占位符
            if (!thumbnail) {
                const { nodeCount, edgeCount } = countElementStats(elements);
                thumbnail = generatePlaceholderThumbnail(nodeCount, edgeCount);
            }

            // 保存缩略图
            if (thumbnail) {
                await updateFile(fileId, { thumbnail });
            }
        } catch (error) {
            console.error("Thumbnail generation failed:", error);
        }
    };

    const generateProfessionalVersion = useCallback(async (
        drawioXml: string,
        options: EnhancementOptions,
        note?: string
    ): Promise<void> => {
        if (!currentFile) return;

        const updated = await createProfessionalVersion(
            currentFile.id,
            drawioXml,
            options,
            note
        );
        if (updated) {
            setCurrentFile(updated);
            setState(prev => ({
                ...prev,
                files: prev.files.map(f => f.id === updated.id ? updated : f),
            }));
        }
    }, [currentFile]);

    const switchToSimpleVersion = useCallback(async (versionId: string): Promise<void> => {
        if (!currentFile) return;

        const updated = await switchSimpleVersion(currentFile.id, versionId);
        if (updated) {
            setCurrentFile(updated);
        }
    }, [currentFile]);

    const switchToProfessionalVersion = useCallback(async (versionId: string): Promise<void> => {
        if (!currentFile) return;

        const updated = await switchProfessionalVersion(currentFile.id, versionId);
        if (updated) {
            setCurrentFile(updated);
        }
    }, [currentFile]);

    const deleteVersion = useCallback(async (
        versionId: string,
        type: "simple" | "professional"
    ): Promise<void> => {
        if (!currentFile) return;

        const updated = type === "simple"
            ? await deleteSimpleVersion(currentFile.id, versionId)
            : await deleteProfessionalVersion(currentFile.id, versionId);

        if (updated) {
            setCurrentFile(updated);
            setState(prev => ({
                ...prev,
                files: prev.files.map(f => f.id === updated.id ? updated : f),
            }));
        }
    }, [currentFile]);

    // ============= 对话历史 =============

    const saveChatHistory = useCallback(async (messages: ChatMessage[]): Promise<void> => {
        if (!currentFile) return;

        try {
            await updateFile(currentFile.id, { chatHistory: messages } as UpdateFileParams);
            // 更新本地状态
            setCurrentFile(prev => prev ? { ...prev, chatHistory: messages } : null);
        } catch (error) {
            console.error("Save chat history failed:", error);
        }
    }, [currentFile]);

    // ============= 刷新 =============

    const refreshFiles = useCallback(async (): Promise<void> => {
        const files = await listFiles();
        setState(prev => ({
            ...prev,
            files,
        }));

        // 如果当前有打开的文件，刷新它
        if (currentFile) {
            const updated = await getFile(currentFile.id);
            if (updated) {
                setCurrentFile(updated);
            }
        }
    }, [currentFile]);

    // ============= 清理 =============

    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            if (saveStatusTimerRef.current) {
                clearTimeout(saveStatusTimerRef.current);
            }
        };
    }, []);

    // ============= 提供值 =============

    const value: FileContextValue = {
        state,
        currentFile,
        currentSimpleVersion,
        currentProfessionalVersion,
        saveStatus,

        // 便捷访问
        files: state.files,
        isLoading: state.isLoading,

        // 文件操作
        createNewFile,
        createFile: createNewFile, // 别名
        openFile,
        closeFile,
        updateCurrentFile,
        deleteCurrentFile,
        deleteFile: deleteFileById, // 别名
        deleteFileById,
        renameFile,

        // 版本操作
        saveAsNewSimpleVersion,
        autoSave,
        generateProfessionalVersion,
        switchToSimpleVersion,
        switchToProfessionalVersion,
        deleteVersion,

        // 对话历史
        saveChatHistory,

        refreshFiles,
    };

    return (
        <FileContext.Provider value={value}>
            {children}
        </FileContext.Provider>
    );
}

// ============= Hook =============

export function useFile() {
    const context = useContext(FileContext);
    if (!context) {
        throw new Error("useFile must be used within a FileProvider");
    }
    return context;
}

// ============= 便捷 Hooks =============

/**
 * 获取当前文件的版本统计
 */
export function useVersionStats() {
    const { currentFile } = useFile();
    const [stats, setStats] = useState<{
        simpleCount: number;
        professionalCount: number;
        latestSimple?: DiagramVersion;
        latestProfessional?: DiagramVersion;
    } | null>(null);

    useEffect(() => {
        async function loadStats() {
            if (!currentFile) {
                setStats(null);
                return;
            }

            const s = await getVersionStats(currentFile.id);
            setStats(s);
        }

        loadStats();
    }, [currentFile]);

    return stats;
}

/**
 * 获取最近打开的文件
 */
export function useRecentFiles() {
    const { state } = useFile();

    return useMemo(() => {
        return state.recentFileIds
            .map(id => state.files.find(f => f.id === id))
            .filter((f): f is DiagramFile => f !== undefined);
    }, [state.files, state.recentFileIds]);
}
