"use client";

import { useState, useCallback } from "react";
import { CanvasProvider, useCanvas } from "@/contexts";
import { MainLayout, EditModePanel } from "@/components/layout";
import { ApiKeyManager } from "@/components/settings";
import { ExcalidrawWrapper } from "@/components/canvas";

function HomeContent() {
  const [showSettings, setShowSettings] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const { canvasRef, setSelectedElements } = useCanvas();

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedElements(ids);
    if (ids.length > 0) {
      console.log("Selected elements:", ids);
      // 自动打开编辑模式面板
      setShowEditMode(true);
    }
  }, [setSelectedElements]);

  return (
    <>
      <MainLayout
        onSettingsClick={() => setShowSettings(true)}
        onEditModeClick={() => setShowEditMode(!showEditMode)}
        isEditMode={showEditMode}
      >
        <ExcalidrawWrapper
          ref={canvasRef}
          onSelectionChange={handleSelectionChange}
        />
      </MainLayout>

      {showSettings && (
        <ApiKeyManager onClose={() => setShowSettings(false)} />
      )}

      <EditModePanel
        isVisible={showEditMode}
        onClose={() => setShowEditMode(false)}
      />
    </>
  );
}

export default function Home() {
  return (
    <CanvasProvider>
      <HomeContent />
    </CanvasProvider>
  );
}
