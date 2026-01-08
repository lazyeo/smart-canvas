"use client";

import React, { useState, useRef, useEffect } from "react";
import { DiagramFile, formatVersionTime } from "@/types/diagram-file";

interface FileCardProps {
    file: DiagramFile;
    isActive?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
    onRename?: (newName: string) => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
}

/**
 * 文件卡片组件
 * 显示单个文件的缩略图、名称、修改时间等信息
 */
export function FileCard({
    file,
    isActive = false,
    onClick,
    onDoubleClick,
    onRename,
    onDelete,
    onDuplicate,
}: FileCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(file.name);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const inputRef = useRef<HTMLInputElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // 聚焦输入框
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    // 点击外部关闭右键菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showContextMenu) {
                setShowContextMenu(false);
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [showContextMenu]);

    // 处理右键菜单
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
        setShowContextMenu(true);
    };

    // 处理重命名确认
    const handleRenameConfirm = () => {
        if (editName.trim() && editName !== file.name) {
            onRename?.(editName.trim());
        }
        setIsEditing(false);
        setEditName(file.name);
    };

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleRenameConfirm();
        } else if (e.key === "Escape") {
            setIsEditing(false);
            setEditName(file.name);
        }
    };

    // 获取图表类型图标
    const getTypeIcon = () => {
        switch (file.type) {
            case "flowchart":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                );
            case "er":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                );
            case "architecture":
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                );
        }
    };

    // 版本数量统计
    const simpleCount = file.simpleVersions.length;
    const proCount = file.professionalVersions.length;

    return (
        <>
            <div
                ref={cardRef}
                className={`
                    group relative p-3 rounded-lg border cursor-pointer transition-all
                    ${isActive
                        ? "bg-blue-900/30 border-blue-500"
                        : "bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600"
                    }
                `}
                onClick={onClick}
                onDoubleClick={onDoubleClick}
                onContextMenu={handleContextMenu}
            >
                {/* 缩略图区域 */}
                <div className="aspect-video bg-slate-900 rounded mb-2 flex items-center justify-center overflow-hidden">
                    {file.thumbnail ? (
                        <img
                            src={file.thumbnail}
                            alt={file.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="text-slate-600">
                            {getTypeIcon()}
                        </div>
                    )}
                </div>

                {/* 文件名 */}
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleRenameConfirm}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-slate-700 text-white text-sm px-2 py-1 rounded border border-blue-500 outline-none"
                    />
                ) : (
                    <h3 className="text-sm font-medium text-white truncate" title={file.name}>
                        {file.name}
                    </h3>
                )}

                {/* 元信息 */}
                <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
                    <span>{formatVersionTime(file.updatedAt)}</span>
                    <div className="flex items-center gap-1">
                        {getTypeIcon()}
                        <span>{file.type}</span>
                    </div>
                </div>

                {/* 版本徽章 */}
                <div className="flex gap-1 mt-2">
                    <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                        v{simpleCount}
                    </span>
                    {proCount > 0 && (
                        <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">
                            Pro v{proCount}
                        </span>
                    )}
                </div>

                {/* 活跃指示器 */}
                {isActive && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" />
                )}
            </div>

            {/* 右键菜单 */}
            {showContextMenu && (
                <div
                    className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-lg py-1 min-w-[140px]"
                    style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                            setShowContextMenu(false);
                            onDoubleClick?.();
                        }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        打开
                    </button>
                    <button
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                            setShowContextMenu(false);
                            setIsEditing(true);
                        }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        重命名
                    </button>
                    <button
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                            setShowContextMenu(false);
                            onDuplicate?.();
                        }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        复制
                    </button>
                    <div className="border-t border-slate-700 my-1" />
                    <button
                        className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-red-900/30 flex items-center gap-2"
                        onClick={() => {
                            setShowContextMenu(false);
                            onDelete?.();
                        }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除
                    </button>
                </div>
            )}
        </>
    );
}
