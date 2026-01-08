"use client";

import React, { useState, useEffect } from "react";
import { useFile } from "@/contexts/FileContext";
import { useCanvas, useEngine } from "@/contexts";
import {
    EnhancementOptions,
    DEFAULT_ENHANCEMENT_OPTIONS,
    EnhancementLevel,
    ColorScheme,
} from "@/types/diagram-file";

interface EnhancementPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * 增强配置面板
 * 配置专业版生成选项，支持智能默认和高级配置
 */
export function EnhancementPanel({ isOpen, onClose }: EnhancementPanelProps) {
    const { currentFile, currentSimpleVersion, generateProfessionalVersion } = useFile();
    const { getElements } = useCanvas();
    const { setEngine } = useEngine();

    const [options, setOptions] = useState<EnhancementOptions>(DEFAULT_ENHANCEMENT_OPTIONS);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [note, setNote] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // 重置状态
    useEffect(() => {
        if (isOpen) {
            setOptions(DEFAULT_ENHANCEMENT_OPTIONS);
            setNote("");
            setProgress(0);
            setError(null);
            setIsGenerating(false);
        }
    }, [isOpen]);

    if (!isOpen || !currentFile) return null;

    // 根据级别自动调整选项
    const handleLevelChange = (level: EnhancementLevel) => {
        let newOptions: EnhancementOptions;

        switch (level) {
            case "basic":
                newOptions = {
                    level: "basic",
                    structure: { addSwimlanes: false, addParallelBranches: false },
                    nodes: { useProfessionalSymbols: true, addDetails: false },
                    edges: { addConditionLabels: false, addSequenceNumbers: false },
                    style: { colorScheme: "minimal", addLegend: false, addTitle: true },
                };
                break;
            case "advanced":
                newOptions = {
                    level: "advanced",
                    structure: { addSwimlanes: true, addParallelBranches: true },
                    nodes: { useProfessionalSymbols: true, addDetails: true },
                    edges: { addConditionLabels: true, addSequenceNumbers: true },
                    style: { colorScheme: "professional", addLegend: true, addTitle: true },
                };
                break;
            default:
                newOptions = DEFAULT_ENHANCEMENT_OPTIONS;
        }

        setOptions(newOptions);
    };

    // 生成专业版
    const handleGenerate = async () => {
        if (!currentSimpleVersion) return;

        setIsGenerating(true);
        setProgress(10);
        setError(null);

        try {
            // 获取当前画布元素
            const elements = [...getElements()];
            setProgress(30);

            // 导入增强服务
            const { enhance } = await import("@/lib/ai/enhancement-service");
            setProgress(40);

            // 调用增强服务
            const result = await enhance({
                elements,
                diagramType: currentFile.type,
                options,
            });
            setProgress(80);

            if (!result.success || !result.drawioXml) {
                throw new Error(result.error || "生成失败");
            }

            // 保存专业版
            await generateProfessionalVersion(result.drawioXml, options, note || undefined);
            setProgress(100);

            // 切换到 Draw.io 引擎查看结果
            setEngine("drawio");

            // 关闭面板
            setTimeout(() => {
                onClose();
            }, 500);
        } catch (err) {
            console.error("Enhancement failed:", err);
            setError(err instanceof Error ? err.message : "生成失败，请重试");
            setProgress(0);
        } finally {
            setIsGenerating(false);
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
                    <div>
                        <h2 className="text-lg font-semibold text-white">生成专业版</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            基于简明版 v{currentSimpleVersion?.versionNumber || 1}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="p-1 text-slate-400 hover:text-white rounded disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* 增强级别 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">增强级别</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(["basic", "standard", "advanced"] as EnhancementLevel[]).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => handleLevelChange(level)}
                                    disabled={isGenerating}
                                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                                        options.level === level
                                            ? "bg-purple-600 text-white"
                                            : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                                    } disabled:opacity-50`}
                                >
                                    {level === "basic" ? "基础" : level === "standard" ? "标准" : "高级"}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            {options.level === "basic" && "简洁风格，保持原有结构"}
                            {options.level === "standard" && "推荐配置，添加泳道和专业符号"}
                            {options.level === "advanced" && "完整增强，包含所有专业元素"}
                        </p>
                    </div>

                    {/* AI 推荐配置 */}
                    <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            AI 推荐配置
                        </div>
                        <div className="space-y-2">
                            <OptionToggle
                                label="添加泳道分层"
                                checked={options.structure.addSwimlanes}
                                onChange={(checked) => setOptions({
                                    ...options,
                                    structure: { ...options.structure, addSwimlanes: checked }
                                })}
                                disabled={isGenerating}
                            />
                            <OptionToggle
                                label="使用专业符号"
                                checked={options.nodes.useProfessionalSymbols}
                                onChange={(checked) => setOptions({
                                    ...options,
                                    nodes: { ...options.nodes, useProfessionalSymbols: checked }
                                })}
                                disabled={isGenerating}
                            />
                            <OptionToggle
                                label="添加条件标注"
                                checked={options.edges.addConditionLabels}
                                onChange={(checked) => setOptions({
                                    ...options,
                                    edges: { ...options.edges, addConditionLabels: checked }
                                })}
                                disabled={isGenerating}
                            />
                        </div>
                    </div>

                    {/* 高级选项 */}
                    <div>
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            <svg
                                className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            高级选项
                        </button>

                        {showAdvanced && (
                            <div className="mt-3 space-y-4 pl-6 border-l border-slate-700">
                                {/* 结构选项 */}
                                <div>
                                    <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">结构</h4>
                                    <OptionToggle
                                        label="并行分支"
                                        checked={options.structure.addParallelBranches}
                                        onChange={(checked) => setOptions({
                                            ...options,
                                            structure: { ...options.structure, addParallelBranches: checked }
                                        })}
                                        disabled={isGenerating}
                                    />
                                </div>

                                {/* 节点选项 */}
                                <div>
                                    <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">节点</h4>
                                    <OptionToggle
                                        label="详细属性"
                                        checked={options.nodes.addDetails}
                                        onChange={(checked) => setOptions({
                                            ...options,
                                            nodes: { ...options.nodes, addDetails: checked }
                                        })}
                                        disabled={isGenerating}
                                    />
                                </div>

                                {/* 连线选项 */}
                                <div>
                                    <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">连线</h4>
                                    <OptionToggle
                                        label="序号标注"
                                        checked={options.edges.addSequenceNumbers}
                                        onChange={(checked) => setOptions({
                                            ...options,
                                            edges: { ...options.edges, addSequenceNumbers: checked }
                                        })}
                                        disabled={isGenerating}
                                    />
                                </div>

                                {/* 样式选项 */}
                                <div>
                                    <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-2">样式</h4>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">颜色方案</label>
                                            <select
                                                value={options.style.colorScheme}
                                                onChange={(e) => setOptions({
                                                    ...options,
                                                    style: { ...options.style, colorScheme: e.target.value as ColorScheme }
                                                })}
                                                disabled={isGenerating}
                                                className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 outline-none disabled:opacity-50"
                                            >
                                                <option value="professional">专业蓝</option>
                                                <option value="modern">现代彩</option>
                                                <option value="minimal">简约灰</option>
                                            </select>
                                        </div>
                                        <OptionToggle
                                            label="添加标题"
                                            checked={options.style.addTitle}
                                            onChange={(checked) => setOptions({
                                                ...options,
                                                style: { ...options.style, addTitle: checked }
                                            })}
                                            disabled={isGenerating}
                                        />
                                        <OptionToggle
                                            label="添加图例"
                                            checked={options.style.addLegend}
                                            onChange={(checked) => setOptions({
                                                ...options,
                                                style: { ...options.style, addLegend: checked }
                                            })}
                                            disabled={isGenerating}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 版本备注 */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">版本备注（可选）</label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="如：添加了泳道和专业符号"
                            disabled={isGenerating}
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 outline-none disabled:opacity-50"
                        />
                    </div>

                    {/* 错误提示 */}
                    {error && (
                        <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 text-sm text-red-300">
                            {error}
                        </div>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="p-4 border-t border-slate-700">
                    {isGenerating ? (
                        <div className="space-y-2">
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-purple-600 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-xs text-center text-slate-400">
                                {progress < 30 && "准备中..."}
                                {progress >= 30 && progress < 60 && "AI 分析中..."}
                                {progress >= 60 && progress < 90 && "生成专业版..."}
                                {progress >= 90 && "保存中..."}
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={handleGenerate}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            生成专业版
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

// ============= 选项开关组件 =============

interface OptionToggleProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

function OptionToggle({ label, checked, onChange, disabled }: OptionToggleProps) {
    return (
        <label className={`flex items-center justify-between py-1 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
            <span className="text-sm text-slate-300">{label}</span>
            <button
                type="button"
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    checked ? "bg-purple-600" : "bg-slate-600"
                } ${disabled ? "cursor-not-allowed" : ""}`}
            >
                <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        checked ? "translate-x-4.5" : "translate-x-1"
                    }`}
                    style={{ transform: checked ? "translateX(18px)" : "translateX(4px)" }}
                />
            </button>
        </label>
    );
}
