"use client";

import { useState } from "react";
import { useFile, useRecentFiles, useVersionStats } from "@/contexts/FileContext";
import { formatVersionTime } from "@/types/diagram-file";

/**
 * 文件管理调试面板
 * 用于测试文件管理基础设施
 */
export function FileManagerDebug() {
    const [isOpen, setIsOpen] = useState(false);
    const [newFileName, setNewFileName] = useState("");
    const [message, setMessage] = useState("");

    const {
        state,
        currentFile,
        currentSimpleVersion,
        currentProfessionalVersion,
        createNewFile,
        openFile,
        closeFile,
        updateCurrentFile,
        deleteCurrentFile,
        saveAsNewSimpleVersion,
    } = useFile();

    const recentFiles = useRecentFiles();
    const versionStats = useVersionStats();

    const showMessage = (msg: string) => {
        setMessage(msg);
        setTimeout(() => setMessage(""), 3000);
    };

    const handleCreateFile = async () => {
        try {
            const file = await createNewFile({
                name: newFileName || "测试文件",
            });
            showMessage(`创建成功: ${file.name} (ID: ${file.id.slice(0, 8)}...)`);
            setNewFileName("");
        } catch (error) {
            showMessage(`创建失败: ${error}`);
        }
    };

    const handleSaveVersion = async () => {
        try {
            // 模拟保存一些元素
            const mockElements = [
                { id: `elem-${Date.now()}`, type: "rectangle", x: 100, y: 100 },
            ];
            await saveAsNewSimpleVersion(mockElements, "测试版本");
            showMessage("版本保存成功");
        } catch (error) {
            showMessage(`保存失败: ${error}`);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-50 bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-blue-600 text-sm"
            >
                文件管理测试
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h3 className="font-semibold text-sm">文件管理测试面板</h3>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                    ✕
                </button>
            </div>

            <div className="p-3 overflow-y-auto max-h-[calc(80vh-50px)] space-y-4 text-sm">
                {/* 状态信息 */}
                <div className="bg-gray-50 dark:bg-gray-900 rounded p-2">
                    <div className="text-xs text-gray-500 mb-1">状态</div>
                    <div>加载中: {state.isLoading ? "是" : "否"}</div>
                    <div>文件数: {state.files.length}</div>
                    <div>当前文件: {currentFile?.name || "无"}</div>
                    {state.error && <div className="text-red-500">错误: {state.error}</div>}
                </div>

                {/* 消息提示 */}
                {message && (
                    <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 p-2 rounded text-xs">
                        {message}
                    </div>
                )}

                {/* 创建文件 */}
                <div className="space-y-2">
                    <div className="text-xs text-gray-500">创建文件</div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder="文件名"
                            className="flex-1 px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
                        />
                        <button
                            onClick={handleCreateFile}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                        >
                            创建
                        </button>
                    </div>
                </div>

                {/* 当前文件操作 */}
                {currentFile && (
                    <div className="space-y-2 border-t pt-2">
                        <div className="text-xs text-gray-500">当前文件: {currentFile.name}</div>
                        <div className="text-xs">
                            <div>ID: {currentFile.id.slice(0, 12)}...</div>
                            <div>类型: {currentFile.type}</div>
                            <div>创建: {formatVersionTime(currentFile.createdAt)}</div>
                            <div>更新: {formatVersionTime(currentFile.updatedAt)}</div>
                        </div>

                        {/* 版本信息 */}
                        {versionStats && (
                            <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded text-xs">
                                <div>简明版数: {versionStats.simpleCount}</div>
                                <div>专业版数: {versionStats.professionalCount}</div>
                                {currentSimpleVersion && (
                                    <div>当前简明版: v{currentSimpleVersion.versionNumber}</div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={handleSaveVersion}
                                className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                            >
                                保存新版本
                            </button>
                            <button
                                onClick={() => updateCurrentFile({ name: `${currentFile.name} (已编辑)` })}
                                className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs"
                            >
                                重命名
                            </button>
                            <button
                                onClick={closeFile}
                                className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs"
                            >
                                关闭
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirm("确定删除此文件?")) {
                                        await deleteCurrentFile();
                                        showMessage("文件已删除");
                                    }
                                }}
                                className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                )}

                {/* 文件列表 */}
                <div className="space-y-2 border-t pt-2">
                    <div className="text-xs text-gray-500">所有文件 ({state.files.length})</div>
                    {state.files.length === 0 ? (
                        <div className="text-xs text-gray-400">暂无文件</div>
                    ) : (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {state.files.map((file) => (
                                <div
                                    key={file.id}
                                    onClick={() => openFile(file.id)}
                                    className={`p-2 rounded cursor-pointer text-xs ${
                                        currentFile?.id === file.id
                                            ? "bg-blue-100 dark:bg-blue-900/50"
                                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    <div className="font-medium">{file.name}</div>
                                    <div className="text-gray-500">
                                        {formatVersionTime(file.updatedAt)} · {file.type}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 最近文件 */}
                {recentFiles.length > 0 && (
                    <div className="space-y-2 border-t pt-2">
                        <div className="text-xs text-gray-500">最近文件</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                            {recentFiles.map((f) => f.name).join(", ")}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
