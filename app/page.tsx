"use client";

import { useState, useCallback } from "react";
import { CanvasProvider, useCanvas, EngineProvider, useEngine } from "@/contexts";
import { MainLayout } from "@/components/layout";
import { ApiKeyManager } from "@/components/settings";
import { ExcalidrawWrapper, DrawioWrapper } from "@/components/canvas";
import { WelcomeGuide } from "@/components/guide";
import { layoutDiagram } from "@/lib/layout";

function HomeContent() {
  const [showSettings, setShowSettings] = useState(false);
  const { canvasRef, setSelectedElements, getElements, updateScene } = useCanvas();
  const { engine, drawioXml } = useEngine();

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
          />
        </div>
        <div className={`w-full h-full ${engine === "drawio" ? "block" : "hidden"}`}>
          <DrawioWrapper
            initialXml={drawioXml}
          />
        </div>
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
    <EngineProvider>
      <CanvasProvider>
        <HomeContent />
      </CanvasProvider>
    </EngineProvider>
  );
}
