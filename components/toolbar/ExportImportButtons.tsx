"use client";

import React, { useState, useRef } from "react";
import { useCanvas, useEngine } from "@/contexts";
import { useFile } from "@/contexts/FileContext";
import { exportToJSON, exportToPNG, exportToSVG, importFromJSON } from "@/lib/canvas";
import { useTranslation } from "@/lib/i18n";

export function ExportButton() {
    const { getElements } = useCanvas();
    const { currentFile, currentSimpleVersion, currentProfessionalVersion } = useFile();
    const { engine, drawioXml } = useEngine();
    const [showMenu, setShowMenu] = useState(false);
    const { t } = useTranslation();

    // 导出当前画布
    const handleExportJSON = () => {
        const elements = getElements();
        const filename = currentFile ? `${currentFile.name}.excalidraw` : "diagram.excalidraw";
        exportToJSON(elements, filename);
        setShowMenu(false);
    };

    const handleExportPNG = async () => {
        const elements = getElements();
        const filename = currentFile ? `${currentFile.name}.png` : "diagram.png";
        await exportToPNG(elements, filename);
        setShowMenu(false);
    };

    const handleExportSVG = async () => {
        const elements = getElements();
        const filename = currentFile ? `${currentFile.name}.svg` : "diagram.svg";
        await exportToSVG(elements, filename);
        setShowMenu(false);
    };

    // 导出专业版 Draw.io XML
    const handleExportDrawioXml = () => {
        if (!drawioXml) {
            alert("暂无专业版数据，请先生成专业版");
            return;
        }

        const filename = currentFile ? `${currentFile.name}.drawio` : "diagram.drawio";
        const blob = new Blob([drawioXml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setShowMenu(false);
    };

    // 导出完整文件（包含所有版本）
    const handleExportFullFile = () => {
        if (!currentFile) {
            alert("请先打开或创建文件");
            return;
        }

        const exportData = {
            version: "1.0",
            type: "smartcanvas-file",
            file: {
                id: currentFile.id,
                name: currentFile.name,
                type: currentFile.type,
                description: currentFile.description,
                createdAt: currentFile.createdAt,
                updatedAt: currentFile.updatedAt,
                simpleVersions: currentFile.simpleVersions,
                professionalVersions: currentFile.professionalVersions,
            },
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentFile.name}.smartcanvas`;
        a.click();
        URL.revokeObjectURL(url);
        setShowMenu(false);
    };

    const hasSimpleVersion = currentSimpleVersion && (currentSimpleVersion.excalidrawElements?.length ?? 0) > 0;
    const hasProfessionalVersion = currentProfessionalVersion || drawioXml;

    return (
        <div className="relative">
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t("common.export")}
            </button>

            {showMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 min-w-[180px] z-50">
                        {/* 简明版导出 */}
                        <div className="px-3 py-1 text-xs text-slate-500 uppercase">简明版</div>
                        <button
                            onClick={handleExportJSON}
                            disabled={!hasSimpleVersion}
                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            导出 Excalidraw (.json)
                        </button>
                        <button
                            onClick={handleExportPNG}
                            disabled={!hasSimpleVersion}
                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            导出 PNG 图片
                        </button>
                        <button
                            onClick={handleExportSVG}
                            disabled={!hasSimpleVersion}
                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            导出 SVG 矢量图
                        </button>

                        {/* 专业版导出 */}
                        <div className="border-t border-slate-700 mt-1 pt-1">
                            <div className="px-3 py-1 text-xs text-slate-500 uppercase">专业版</div>
                            <button
                                onClick={handleExportDrawioXml}
                                disabled={!hasProfessionalVersion}
                                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                导出 Draw.io (.drawio)
                                {!hasProfessionalVersion && (
                                    <span className="text-xs text-slate-500">无数据</span>
                                )}
                            </button>
                        </div>

                        {/* 完整文件导出 */}
                        {currentFile && (
                            <div className="border-t border-slate-700 mt-1 pt-1">
                                <button
                                    onClick={handleExportFullFile}
                                    className="w-full text-left px-3 py-2 text-sm text-purple-300 hover:text-white hover:bg-slate-700 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    导出完整文件 (.smartcanvas)
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export function ImportButton() {
    const { updateScene } = useCanvas();
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file === undefined) {
            return;
        }

        try {
            const elements = await importFromJSON(file);
            updateScene({ elements });
        } catch (error) {
            console.error("Import failed:", error);
            alert(t("exportImport.importFailed"));
        }

        if (inputRef.current !== null) {
            inputRef.current.value = "";
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".excalidraw,.json"
                onChange={handleImport}
                className="hidden"
            />
            <button
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t("common.import")}
            </button>
        </>
    );
}
