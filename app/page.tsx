"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout";
import { ApiKeyManager } from "@/components/settings";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <MainLayout onSettingsClick={() => setShowSettings(true)} />

      {showSettings && (
        <ApiKeyManager onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}
