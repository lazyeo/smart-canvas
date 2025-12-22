"use client";

import React, { createContext, useContext, useRef, useState, useCallback, ReactNode } from "react";
import { ExcalidrawWrapperRef, ExcalidrawElement, AppState } from "@/components/canvas/ExcalidrawWrapper";

interface CanvasContextValue {
    // Ref 到 Excalidraw API
    canvasRef: React.RefObject<ExcalidrawWrapperRef | null>;

    // 状态
    isReady: boolean;
    selectedElementIds: string[];

    // 操作方法
    setCanvasReady: (ready: boolean) => void;
    setSelectedElements: (ids: string[]) => void;

    // 便捷方法
    getElements: () => readonly ExcalidrawElement[];
    updateScene: (opts: { elements?: readonly ExcalidrawElement[] }) => void;
    getSelectedElements: () => readonly ExcalidrawElement[];
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

interface CanvasProviderProps {
    children: ReactNode;
}

export function CanvasProvider({ children }: CanvasProviderProps) {
    const canvasRef = useRef<ExcalidrawWrapperRef | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

    const setCanvasReady = useCallback((ready: boolean) => {
        setIsReady(ready);
    }, []);

    const setSelectedElements = useCallback((ids: string[]) => {
        setSelectedElementIds(ids);
    }, []);

    const getElements = useCallback(() => {
        if (canvasRef.current === null) {
            return [];
        }
        return canvasRef.current.getElements();
    }, []);

    const updateScene = useCallback((opts: { elements?: readonly ExcalidrawElement[] }) => {
        if (canvasRef.current === null) {
            return;
        }
        canvasRef.current.updateScene(opts);
    }, []);

    const getSelectedElements = useCallback(() => {
        if (canvasRef.current === null) {
            return [];
        }
        return canvasRef.current.getSelectedElements();
    }, []);

    const value: CanvasContextValue = {
        canvasRef,
        isReady,
        selectedElementIds,
        setCanvasReady,
        setSelectedElements,
        getElements,
        updateScene,
        getSelectedElements,
    };

    return (
        <CanvasContext.Provider value={value}>
            {children}
        </CanvasContext.Provider>
    );
}

export function useCanvas(): CanvasContextValue {
    const context = useContext(CanvasContext);
    if (context === null) {
        throw new Error("useCanvas must be used within a CanvasProvider");
    }
    return context;
}
