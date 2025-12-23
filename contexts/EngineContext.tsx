"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

/**
 * 画布引擎类型
 */
export type CanvasEngine = "excalidraw" | "drawio";

/**
 * 图表数据（引擎无关）
 */
export interface DiagramData {
    nodes: Array<{
        id: string;
        type: string;
        label: string;
        row: number;
        column: number;
    }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
        label?: string;
    }>;
}

/**
 * 引擎上下文值
 */
interface EngineContextValue {
    engine: CanvasEngine;
    setEngine: (engine: CanvasEngine) => void;
    diagramData: DiagramData | null;
    setDiagramData: (data: DiagramData | null) => void;
    drawioXml: string;
    setDrawioXml: (xml: string) => void;
}

const EngineContext = createContext<EngineContextValue | null>(null);

/**
 * 引擎 Provider
 */
export function EngineProvider({ children }: { children: ReactNode }) {
    const [engine, setEngineState] = useState<CanvasEngine>("excalidraw");
    const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
    const [drawioXml, setDrawioXml] = useState<string>("");

    const setEngine = useCallback((newEngine: CanvasEngine) => {
        console.log(`Switching engine: ${engine} -> ${newEngine}`);
        setEngineState(newEngine);
    }, [engine]);

    return (
        <EngineContext.Provider
            value={{
                engine,
                setEngine,
                diagramData,
                setDiagramData,
                drawioXml,
                setDrawioXml,
            }}
        >
            {children}
        </EngineContext.Provider>
    );
}

/**
 * 使用引擎上下文
 */
export function useEngine() {
    const context = useContext(EngineContext);
    if (!context) {
        throw new Error("useEngine must be used within an EngineProvider");
    }
    return context;
}
