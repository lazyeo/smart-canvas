"use client";

import React, { useState, useRef } from "react";
import { useCanvas } from "@/contexts";
import { exportToJSON, exportToPNG, exportToSVG, importFromJSON } from "@/lib/canvas";

export function ExportButton() {
    const { getElements } = useCanvas();
    const [showMenu, setShowMenu] = useState(false);

    const handleExportJSON = () => {
        const elements = getElements();
        exportToJSON(elements);
        setShowMenu(false);
    };

    const handleExportPNG = async () => {
        const elements = getElements();
        await exportToPNG(elements);
        setShowMenu(false);
    };

    const handleExportSVG = async () => {
        const elements = getElements();
        await exportToSVG(elements);
        setShowMenu(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                导出
            </button>

            {showMenu && (
                <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 min-w-[120px] z-50">
                    <button
                        onClick={handleExportJSON}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                        导出 JSON
                    </button>
                    <button
                        onClick={handleExportPNG}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                        导出 PNG
                    </button>
                    <button
                        onClick={handleExportSVG}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700"
                    >
                        导出 SVG
                    </button>
                </div>
            )}
        </div>
    );
}

export function ImportButton() {
    const { updateScene } = useCanvas();
    const inputRef = useRef<HTMLInputElement>(null);

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
            alert("导入失败：文件格式不正确");
        }

        // 重置 input
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
                导入
            </button>
        </>
    );
}
