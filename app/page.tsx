"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CanvasProvider, useCanvas, EngineProvider, useEngine, FileProvider } from "@/contexts";
import { useFile } from "@/contexts/FileContext";
import { MainLayout } from "@/components/layout";
import { ApiKeyManager } from "@/components/settings";
import { ExcalidrawWrapper, DrawioWrapper } from "@/components/canvas";
import { WelcomeGuide } from "@/components/guide";
import { layoutDiagram } from "@/lib/layout";

function HomeContent() {
  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const { canvasRef, setSelectedElements, getElements, updateScene } = useCanvas();
  const { engine, drawioXml } = useEngine();
  const { currentFile, currentSimpleVersion, autoSave } = useFile();

  // 跟踪上一次加载的版本 ID，避免重复加载
  const lastLoadedVersionRef = useRef<string | null>(null);
  // 跟踪是否正在加载文件（防止加载时触发自动保存）
  const isLoadingRef = useRef(false);

  // 当切换文件或版本时，加载 elements 到画布
  useEffect(() => {
    if (!currentSimpleVersion) {
      // 没有版本时不操作（保持当前画布状态）
      return;
    }

    // 如果是同一个版本，不重复加载
    if (lastLoadedVersionRef.current === currentSimpleVersion.id) {
      return;
    }

    // 标记正在加载
    isLoadingRef.current = true;
    setIsLoadingFile(true);

    const elements = currentSimpleVersion.excalidrawElements;
    if (elements && elements.length > 0) {
      console.log("[FileLoad] Loading elements from version:", currentSimpleVersion.id, "count:", elements.length);
      updateScene({ elements });
      lastLoadedVersionRef.current = currentSimpleVersion.id;
    } else if (currentFile) {
      // 新文件或空版本：清空画布
      console.log("[FileLoad] Empty version, clearing canvas");
      updateScene({ elements: [] });
      lastLoadedVersionRef.current = currentSimpleVersion.id;
    }

    // 延迟解除加载状态，避免立即触发自动保存
    setTimeout(() => {
      isLoadingRef.current = false;
      setIsLoadingFile(false);
    }, 500);
  }, [currentSimpleVersion, currentFile, updateScene]);

  // 画布变化时自动保存
  const handleCanvasChange = useCallback((elements: readonly unknown[]) => {
    // 如果正在加载文件，不触发自动保存
    if (isLoadingRef.current) {
      return;
    }
    // 如果没有当前文件，不保存
    if (!currentFile) {
      return;
    }
    // 触发自动保存（防抖在 autoSave 内部处理）
    autoSave([...elements]);
  }, [currentFile, autoSave]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedElements(ids);
  }, [setSelectedElements]);

  const handleAutoLayout = useCallback(() => {
    const elements = getElements();
    if (elements.length === 0) {
      console.log("No elements to layout");
      return;
    }

    const layoutedElements = layoutDiagram(elements);
    updateScene({ elements: layoutedElements });
    console.log("Auto layout applied");
  }, [getElements, updateScene]);

  return (
    <>
      <MainLayout
        onSettingsClick={() => setShowSettings(true)}
        onAutoLayoutClick={handleAutoLayout}
      >
        {/* 使用 CSS 隐藏而非条件渲染，保持组件挂载状态 */}
        <div className={`w-full h-full ${engine === "excalidraw" ? "block" : "hidden"}`}>
          <ExcalidrawWrapper
            ref={canvasRef}
            onSelectionChange={handleSelectionChange}
            onChange={handleCanvasChange}
          />
        </div>
        <div className={`w-full h-full ${engine === "drawio" ? "block" : "hidden"}`}>
          <DrawioWrapper xml={drawioXml} />
        </div>

        {/* 文件加载指示器 */}
        {isLoadingFile && (
          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg px-6 py-4 flex items-center gap-3 shadow-xl">
              <svg className="animate-spin w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-white text-sm">加载文件中...</span>
            </div>
          </div>
        )}
      </MainLayout>

      {showSettings && (
        <ApiKeyManager onClose={() => setShowSettings(false)} />
      )}

      <WelcomeGuide />
    </>
  );
}

export default function Home() {
  return (
    <FileProvider>
      <EngineProvider>
        <CanvasProvider>
          <HomeContent />
        </CanvasProvider>
      </EngineProvider>
    </FileProvider>
  );
}
