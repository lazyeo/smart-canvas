"use client";

// 导入 Excalidraw 样式
import "@excalidraw/excalidraw/index.css";

import React, { useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import dynamic from "next/dynamic";

// 动态导入 Excalidraw 组件（客户端渲染）
const Excalidraw = dynamic(
    async () => {
        const mod = await import("@excalidraw/excalidraw");
        return mod.Excalidraw;
    },
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full bg-slate-100">
                <div className="text-slate-500">加载画布中...</div>
            </div>
        ),
    }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExcalidrawElement = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppState = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExcalidrawAPI = any;

export interface ExcalidrawWrapperRef {
    getElements: () => readonly ExcalidrawElement[];
    getAppState: () => AppState | undefined;
    updateScene: (opts: { elements?: readonly ExcalidrawElement[] }) => void;
    getSelectedElements: () => readonly ExcalidrawElement[];
}

interface ExcalidrawWrapperProps {
    initialData?: {
        elements?: readonly ExcalidrawElement[];
        appState?: Partial<AppState>;
    };
    onChange?: (elements: readonly ExcalidrawElement[], appState: AppState) => void;
    onSelectionChange?: (selectedIds: string[]) => void;
}

export const ExcalidrawWrapper = forwardRef<ExcalidrawWrapperRef, ExcalidrawWrapperProps>(
    function ExcalidrawWrapper({ initialData, onChange, onSelectionChange }, ref) {
        // 使用 useRef 保存 API，避免重渲染
        const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);
        const [isReady, setIsReady] = useState(false);

        // 保存最新的回调函数引用
        const onChangeRef = useRef(onChange);
        const onSelectionChangeRef = useRef(onSelectionChange);

        useEffect(() => {
            onChangeRef.current = onChange;
            onSelectionChangeRef.current = onSelectionChange;
        }, [onChange, onSelectionChange]);

        // 暴露 API 给父组件
        useImperativeHandle(ref, () => ({
            getElements: () => {
                if (excalidrawAPIRef.current === null) {
                    return [];
                }
                return excalidrawAPIRef.current.getSceneElements();
            },
            getAppState: () => {
                if (excalidrawAPIRef.current === null) {
                    return undefined;
                }
                return excalidrawAPIRef.current.getAppState();
            },
            updateScene: (opts: { elements?: readonly ExcalidrawElement[] }) => {
                if (excalidrawAPIRef.current === null) {
                    return;
                }
                excalidrawAPIRef.current.updateScene(opts);
            },
            getSelectedElements: () => {
                if (excalidrawAPIRef.current === null) {
                    return [];
                }
                const appState = excalidrawAPIRef.current.getAppState();
                const elements = excalidrawAPIRef.current.getSceneElements();
                return elements.filter((el: ExcalidrawElement) => appState.selectedElementIds[el.id]);
            },
        }), [isReady]);

        // 稳定的 API 设置回调
        const handleExcalidrawAPI = useCallback((api: ExcalidrawAPI) => {
            excalidrawAPIRef.current = api;
            setIsReady(true);
        }, []);

        // 处理变更事件 - 使用 useCallback 确保引用稳定
        const handleChange = useCallback(
            (elements: readonly ExcalidrawElement[], appState: AppState) => {
                if (onChangeRef.current !== undefined) {
                    onChangeRef.current(elements, appState);
                }

                // 检测选中变化
                if (onSelectionChangeRef.current !== undefined && appState.selectedElementIds) {
                    const selectedIds = Object.keys(appState.selectedElementIds).filter(
                        (id) => appState.selectedElementIds[id]
                    );
                    onSelectionChangeRef.current(selectedIds);
                }
            },
            []
        );

        return (
            <div className="w-full h-full">
                <Excalidraw
                    excalidrawAPI={handleExcalidrawAPI}
                    initialData={initialData}
                    onChange={handleChange}
                    langCode="zh-CN"
                    theme="light"
                    UIOptions={{
                        canvasActions: {
                            loadScene: true,
                            saveAsImage: true,
                            export: { saveFileToDisk: true },
                        },
                    }}
                />
            </div>
        );
    }
);
