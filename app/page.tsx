"use client";

import React, { useRef, useState, useCallback } from "react";
import { MainLayout } from "@/components/layout";
import { ApiKeyManager } from "@/components/settings";
import { ExcalidrawWrapper, ExcalidrawWrapperRef } from "@/components/canvas";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const canvasRef = useRef<ExcalidrawWrapperRef>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    if (ids.length > 0) {
      console.log("Selected elements:", ids);
    }
  }, []);

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
