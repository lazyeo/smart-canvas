"use client";

import React, { useState } from "react";
import { useFile } from "@/contexts/FileContext";
import { DiagramVersion, formatVersionTime } from "@/types/diagram-file";

interface VersionPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerateProfessional?: () => void;
}

/**
 * 版本历史面板
 * 显示简明版和专业版的版本列表，支持切换和删除
 */
export function VersionPanel({ isOpen, onClose, onGenerateProfessional }: VersionPanelProps) {
    const {
        currentFile,
        currentSimpleVersion,
        currentProfessionalVersion,
        switchToSimpleVersion,
        switchToProfessionalVersion,
        deleteVersion,
        saveAsNewSimpleVersion,
    } = useFile();

    const [activeTab, setActiveTab] = useState<"simple" | "professional">("simple");
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveNote, setSaveNote] = useState("");

    if (!isOpen || !currentFile) return null;

    const simpleVersions = [...currentFile.simpleVersions].sort(
        (a, b) => b.versionNumber - a.versionNumber
    );
    const professionalVersions = [...currentFile.professionalVersions].sort(
        (a, b) => b.versionNumber - a.versionNumber
    );

    const handleSaveVersion = async () => {
        // 这里需要从画布获取当前 elements，暂时用空数组
        // 实际应该通过 context 或 props 传入
        await saveAsNewSimpleVersion([], saveNote || undefined);
        setShowSaveDialog(false);
        setSaveNote("");
    };

    const handleDeleteVersion = async (version: DiagramVersion) => {
        const type = version.type;
        const versionList = type === "simple" ? simpleVersions : professionalVersions;

        // 不允许删除最后一个版本
        if (versionList.length <= 1) {
            alert("不能删除最后一个版本");
            return;
        }

        if (window.confirm(`确定要删除 v${version.versionNumber} 吗？此操作不可撤销。`)) {
            await deleteVersion(version.id, type);
        }
    };

    return (
        <>
            {/* 遮罩层 */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* 面板 */}
            <div className="fixed right-0 top-0 h-full w-96 bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-xl">
                {/* 头部 */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white">版本历史</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-white rounded"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tab 切换 */}
                <div className="flex border-b border-slate-700">
                    <button
                        onClick={() => setActiveTab("simple")}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === "simple"
                                ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/50"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        简明版 ({simpleVersions.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("professional")}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === "professional"
                                ? "text-purple-400 border-b-2 border-purple-400 bg-slate-800/50"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        专业版 ({professionalVersions.length})
                    </button>
                </div>

                {/* 版本列表 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {activeTab === "simple" ? (
                        <>
                            {/* 保存新版本按钮 */}
                            <button
                                onClick={() => setShowSaveDialog(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                保存当前为新版本
                            </button>

                            {/* 简明版列表 */}
                            {simpleVersions.map((version) => (
                                <VersionCard
                                    key={version.id}
                                    version={version}
                                    isCurrent={version.id === currentSimpleVersion?.id}
                                    onSelect={() => switchToSimpleVersion(version.id)}
                                    onDelete={() => handleDeleteVersion(version)}
                                    canDelete={simpleVersions.length > 1}
                                />
                            ))}
                        </>
                    ) : (
                        <>
                            {/* 生成专业版按钮 */}
                            <button
                                onClick={onGenerateProfessional}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                从简明版生成新版本
                            </button>

                            {professionalVersions.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-sm">暂无专业版</p>
                                    <p className="text-xs text-slate-500 mt-1">点击上方按钮生成</p>
                                </div>
                            ) : (
                                /* 专业版列表 */
                                professionalVersions.map((version) => (
                                    <VersionCard
                                        key={version.id}
                                        version={version}
                                        isCurrent={version.id === currentProfessionalVersion?.id}
                                        onSelect={() => switchToProfessionalVersion(version.id)}
                                        onDelete={() => handleDeleteVersion(version)}
                                        canDelete={true}
                                        sourceVersion={
                                            version.sourceSimpleVersionId
                                                ? simpleVersions.find(v => v.id === version.sourceSimpleVersionId)
                                                : undefined
                                        }
                                    />
                                ))
                            )}
                        </>
                    )}
                </div>

                {/* 底部提示 */}
                <div className="p-3 border-t border-slate-700 text-xs text-slate-500">
                    {activeTab === "simple" ? (
                        <span>简明版会自动保存，也可手动保存为新版本</span>
                    ) : (
                        <span>每次生成专业版都会创建新版本</span>
                    )}
                </div>
            </div>

            {/* 保存版本对话框 */}
            {showSaveDialog && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-[60]"
                        onClick={() => setShowSaveDialog(false)}
                    />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-slate-800 rounded-lg shadow-xl z-[70] p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">保存新版本</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">版本备注（可选）</label>
                                <input
                                    type="text"
                                    value={saveNote}
                                    onChange={(e) => setSaveNote(e.target.value)}
                                    placeholder="如：添加了错误处理流程"
                                    className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 outline-none text-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveVersion();
                                        if (e.key === "Escape") setShowSaveDialog(false);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowSaveDialog(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSaveVersion}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

// ============= 版本卡片组件 =============

interface VersionCardProps {
    version: DiagramVersion;
    isCurrent: boolean;
    onSelect: () => void;
    onDelete: () => void;
    canDelete: boolean;
    sourceVersion?: DiagramVersion;
}

function VersionCard({
    version,
    isCurrent,
    onSelect,
    onDelete,
    canDelete,
    sourceVersion,
}: VersionCardProps) {
    const [showMenu, setShowMenu] = useState(false);

    const isProfessional = version.type === "professional";

    return (
        <div
            className={`relative p-3 rounded-lg border transition-colors cursor-pointer ${
                isCurrent
                    ? isProfessional
                        ? "bg-purple-900/30 border-purple-500"
                        : "bg-blue-900/30 border-blue-500"
                    : "bg-slate-800 border-slate-700 hover:border-slate-500"
            }`}
            onClick={onSelect}
        >
            {/* 当前版本标记 */}
            {isCurrent && (
                <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded ${
                    isProfessional ? "bg-purple-600 text-white" : "bg-blue-600 text-white"
                }`}>
                    当前
                </span>
            )}

            {/* 版本信息 */}
            <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    isProfessional ? "bg-purple-600 text-white" : "bg-blue-600 text-white"
                }`}>
                    v{version.versionNumber}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-white">
                            {formatVersionTime(version.createdAt)}
                        </span>
                        {version.autoSave && (
                            <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
                                自动
                            </span>
                        )}
                    </div>

                    {version.note && (
                        <p className="text-xs text-slate-400 mt-1 truncate" title={version.note}>
                            {version.note}
                        </p>
                    )}

                    {sourceVersion && (
                        <p className="text-xs text-slate-500 mt-1">
                            基于简明版 v{sourceVersion.versionNumber}
                        </p>
                    )}

                    {/* 增强选项摘要（专业版） */}
                    {isProfessional && version.enhancementOptions && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                            {version.enhancementOptions.structure.addSwimlanes && (
                                <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">泳道</span>
                            )}
                            {version.enhancementOptions.nodes.useProfessionalSymbols && (
                                <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">专业符号</span>
                            )}
                            {version.enhancementOptions.style.addTitle && (
                                <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">标题</span>
                            )}
                        </div>
                    )}
                </div>

                {/* 操作菜单 */}
                {canDelete && (
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMenu(!showMenu);
                            }}
                            className="p-1 text-slate-400 hover:text-white rounded"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                        </button>

                        {showMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                    }}
                                />
                                <div className="absolute right-0 top-6 bg-slate-700 rounded-lg shadow-lg z-20 py-1 min-w-[100px]">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMenu(false);
                                            onDelete();
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-600"
                                    >
                                        删除
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
