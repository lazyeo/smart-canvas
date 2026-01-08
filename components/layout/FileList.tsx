"use client";

import React, { useState, useMemo } from "react";
import { useFile } from "@/contexts/FileContext";
import { FileCard } from "./FileCard";
import { DiagramFile } from "@/types/diagram-file";
import { ModuleType } from "@/types/shadow-model";

interface FileListProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * 文件列表侧边栏组件
 * 显示所有文件，支持搜索、筛选、新建
 */
export function FileList({ isOpen, onClose }: FileListProps) {
    const {
        files,
        currentFile,
        isLoading,
        createFile,
        openFile,
        renameFile,
        deleteFile,
    } = useFile();

    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<ModuleType | "all">("all");
    const [showNewFileDialog, setShowNewFileDialog] = useState(false);
    const [newFileName, setNewFileName] = useState("");
    const [newFileType, setNewFileType] = useState<ModuleType>("flowchart");

    // 筛选和搜索文件
    const filteredFiles = useMemo(() => {
        let result = [...files];

        // 按类型筛选
        if (filterType !== "all") {
            result = result.filter(f => f.type === filterType);
        }

        // 按搜索词筛选
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(f =>
                f.name.toLowerCase().includes(query) ||
                f.description?.toLowerCase().includes(query)
            );
        }

        // 按更新时间排序
        result.sort((a, b) => b.updatedAt - a.updatedAt);

        return result;
    }, [files, filterType, searchQuery]);

    // 创建新文件
    const handleCreateFile = async () => {
        if (!newFileName.trim()) return;

        await createFile({
            name: newFileName.trim(),
            type: newFileType,
        });

        setNewFileName("");
        setShowNewFileDialog(false);
    };

    // 处理删除确认
    const handleDelete = async (file: DiagramFile) => {
        if (window.confirm(`确定要删除 "${file.name}" 吗？此操作不可撤销。`)) {
            await deleteFile(file.id);
        }
    };

    // 处理复制
    const handleDuplicate = async (file: DiagramFile) => {
        await createFile({
            name: `${file.name} (副本)`,
            type: file.type,
            description: file.description,
            initialElements: file.simpleVersions[0]?.excalidrawElements,
        });
    };

    if (!isOpen) return null;

    return (
        <>
            {/* 遮罩层 */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* 侧边栏 */}
            <div className="fixed left-0 top-0 h-full w-80 bg-slate-900 border-r border-slate-700 z-50 flex flex-col shadow-xl">
                {/* 头部 */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white">我的文件</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-white rounded"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 搜索和筛选 */}
                <div className="p-3 border-b border-slate-700 space-y-2">
                    {/* 搜索框 */}
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="搜索文件..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800 text-white text-sm pl-9 pr-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none"
                        />
                    </div>

                    {/* 类型筛选 */}
                    <div className="flex gap-1 overflow-x-auto pb-1">
                        {(["all", "flowchart", "er", "architecture", "sequence"] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-2 py-1 text-xs rounded whitespace-nowrap transition-colors ${filterType === type
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-800 text-slate-400 hover:text-white"
                                    }`}
                            >
                                {type === "all" ? "全部" : type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 新建文件按钮 */}
                <div className="p-3 border-b border-slate-700">
                    <button
                        onClick={() => setShowNewFileDialog(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        新建文件
                    </button>
                </div>

                {/* 文件列表 */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32 text-slate-400">
                            <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            加载中...
                        </div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm">
                                {searchQuery || filterType !== "all" ? "没有找到匹配的文件" : "暂无文件"}
                            </span>
                        </div>
                    ) : (
                        filteredFiles.map((file) => (
                            <FileCard
                                key={file.id}
                                file={file}
                                isActive={currentFile?.id === file.id}
                                onClick={() => openFile(file.id)}
                                onDoubleClick={() => {
                                    openFile(file.id);
                                    onClose();
                                }}
                                onRename={(newName) => renameFile(file.id, newName)}
                                onDelete={() => handleDelete(file)}
                                onDuplicate={() => handleDuplicate(file)}
                            />
                        ))
                    )}
                </div>

                {/* 底部统计 */}
                <div className="p-3 border-t border-slate-700 text-xs text-slate-400">
                    共 {files.length} 个文件
                    {filterType !== "all" && ` · 筛选显示 ${filteredFiles.length} 个`}
                </div>
            </div>

            {/* 新建文件对话框 */}
            {showNewFileDialog && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-[60]"
                        onClick={() => setShowNewFileDialog(false)}
                    />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-800 rounded-lg shadow-xl z-[70] p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">新建文件</h3>

                        <div className="space-y-4">
                            {/* 文件名 */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">文件名</label>
                                <input
                                    type="text"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    placeholder="输入文件名..."
                                    className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleCreateFile();
                                        if (e.key === "Escape") setShowNewFileDialog(false);
                                    }}
                                />
                            </div>

                            {/* 文件类型 */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">类型</label>
                                <select
                                    value={newFileType}
                                    onChange={(e) => setNewFileType(e.target.value as ModuleType)}
                                    className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none"
                                >
                                    <option value="flowchart">流程图</option>
                                    <option value="er">ER 图</option>
                                    <option value="architecture">架构图</option>
                                    <option value="sequence">时序图</option>
                                    <option value="mindmap">思维导图</option>
                                </select>
                            </div>
                        </div>

                        {/* 按钮 */}
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowNewFileDialog(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreateFile}
                                disabled={!newFileName.trim()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                            >
                                创建
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
