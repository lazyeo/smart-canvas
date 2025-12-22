"use client";

import { useState, useCallback } from "react";
import { CanvasProvider, useCanvas } from "@/contexts";
import { MainLayout } from "@/components/layout";
import { ApiKeyManager } from "@/components/settings";
import { ExcalidrawWrapper } from "@/components/canvas";

function HomeContent() {
  const [showSettings, setShowSettings] = useState(false);
  const { canvasRef, setSelectedElements } = useCanvas();

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedElements(ids);
    if (ids.length > 0) {
      console.log("Selected elements:", ids);
    }
  }, [setSelectedElements]);

  return (
    <>
      <MainLayout onSettingsClick={() => setShowSettings(true)}>
        <ExcalidrawWrapper
          ref={canvasRef}
          onSelectionChange={handleSelectionChange}
        />
      </MainLayout>

      {showSettings && (
        <ApiKeyManager onClose={() => setShowSettings(false)} />
      )}
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
