"use client";

import { useState, useCallback } from "react";
import { CanvasProvider, useCanvas } from "@/contexts";
import { MainLayout, EditModePanel } from "@/components/layout";
import { ApiKeyManager } from "@/components/settings";
import { ExcalidrawWrapper } from "@/components/canvas";
import { ShadowNode, ShadowEdge } from "@/types";

function HomeContent() {
  const [showSettings, setShowSettings] = useState(false);
  const [showEditMode, setShowEditMode] = useState(false);
  const { canvasRef, setSelectedElements } = useCanvas();

  // 影子模型数据（当前为空，可从生成的图表中获取）
  const [nodes] = useState<ShadowNode[]>([]);
  const [edges] = useState<ShadowEdge[]>([]);

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
        nodes={nodes}
        edges={edges}
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
