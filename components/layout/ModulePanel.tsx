"use client";

import React, { useState, useMemo } from "react";
import { useCanvas } from "@/contexts";
import { useTranslation } from "@/lib/i18n";

interface Module {
    id: string;
    name: string;
    nodeIds: string[];
    color: string;
}

interface ModulePanelProps {
    onSelectModule?: (module: Module) => void;
    onRegenerateModule?: (module: Module) => void;
}

// 模块颜色调色板
const MODULE_COLORS = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
];

export function ModulePanel({ onSelectModule, onRegenerateModule }: ModulePanelProps) {
    const { getElements, selectedElementIds } = useCanvas();
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
    const { t } = useTranslation();

    // 从画布元素提取模块
    const modules = useMemo(() => {
        const elements = getElements();
        const moduleMap = new Map<string, Module>();
        let colorIndex = 0;

        // 遍历形状元素，按 groupIds 分组
        for (const el of elements) {
            if (el.isDeleted) continue;
            if (el.type !== "rectangle" && el.type !== "ellipse" && el.type !== "diamond") continue;

            // 获取第一个 group ID 作为模块 ID
            const groupId = el.groupIds?.[0];
            if (!groupId) {
                // 无分组的元素放入默认模块
                const defaultId = "__ungrouped__";
                if (!moduleMap.has(defaultId)) {
                    moduleMap.set(defaultId, {
                        id: defaultId,
                        name: t("module.ungrouped"),
                        nodeIds: [],
                        color: "#6b7280",
                    });
                }
                moduleMap.get(defaultId)!.nodeIds.push(el.id);
            } else {
                if (!moduleMap.has(groupId)) {
                    moduleMap.set(groupId, {
                        id: groupId,
                        name: `${t("module.modulePrefix")} ${moduleMap.size + 1}`,
                        nodeIds: [],
                        color: MODULE_COLORS[colorIndex % MODULE_COLORS.length],
                    });
                    colorIndex++;
                }
                moduleMap.get(groupId)!.nodeIds.push(el.id);
            }
        }

        return Array.from(moduleMap.values());
    }, [getElements]);

    const toggleExpanded = (moduleId: string) => {
        setExpandedModules((prev) => {
            const next = new Set(prev);
            if (next.has(moduleId)) {
                next.delete(moduleId);
            } else {
                next.add(moduleId);
            }
            return next;
        });
    };

    if (modules.length === 0) {
        return (
            <div className="p-3 text-sm text-slate-400 text-center">
                {t("module.noModules")}
            </div>
        );
    }

    return (
        <div className="p-2 space-y-1">
            <div className="text-xs text-slate-400 px-2 py-1">
                {t("module.title")} ({modules.length})
            </div>

            {modules.map((module) => {
                const isExpanded = expandedModules.has(module.id);
                const hasSelectedNodes = module.nodeIds.some((id) =>
                    selectedElementIds.includes(id)
                );

                return (
                    <div key={module.id} className="rounded-lg overflow-hidden">
                        <div
                            className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${hasSelectedNodes ? "bg-blue-900/30" : "hover:bg-slate-800"
                                }`}
                            onClick={() => toggleExpanded(module.id)}
                        >
                            {/* 颜色指示器 */}
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: module.color }}
                            />

                            {/* 展开/折叠图标 */}
                            <svg
                                className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""
                                    }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>

                            {/* 模块名称 */}
                            <span className="flex-1 text-sm text-slate-200 truncate">
                                {module.name}
                            </span>

                            {/* 节点数量 */}
                            <span className="text-xs text-slate-500">
                                {module.nodeIds.length}
                            </span>
                        </div>

                        {/* 展开内容 */}
                        {isExpanded && (
                            <div className="bg-slate-800/50 px-2 py-1 space-y-1">
                                {/* 操作按钮 */}
                                <div className="flex gap-1">
                                    <button
                                        className="flex-1 text-xs py-1 px-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onSelectModule) onSelectModule(module);
                                        }}
                                    >
                                        {t("module.selectAll")}
                                    </button>
                                    <button
                                        className="flex-1 text-xs py-1 px-2 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onRegenerateModule) onRegenerateModule(module);
                                        }}
                                    >
                                        {t("module.regenerate")}
                                    </button>
                                </div>

                                {/* 节点列表 */}
                                <div className="text-xs text-slate-400 pt-1">
                                    {t("module.nodeCount")}: {module.nodeIds.length}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
