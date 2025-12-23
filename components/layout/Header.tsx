"use client";

import React from "react";
import { ExportButton, ImportButton } from "@/components/toolbar";
import { useEngine, CanvasEngine } from "@/contexts";

interface HeaderProps {
  onSettingsClick?: () => void;
  onAutoLayoutClick?: () => void;
}

export function Header({ onSettingsClick, onAutoLayoutClick }: HeaderProps) {
  const { engine, setEngine } = useEngine();

  const handleEngineChange = (newEngine: CanvasEngine) => {
    setEngine(newEngine);
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-white">SmartCanvas AI</h1>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
          Alpha
        </span>

        {/* 引擎切换 Tab */}
        <div className="flex bg-slate-800 rounded-lg p-0.5 ml-2">
          <button
            onClick={() => handleEngineChange("excalidraw")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${engine === "excalidraw"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
              }`}
          >
            Excalidraw
          </button>
          <button
            onClick={() => handleEngineChange("drawio")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${engine === "drawio"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
              }`}
          >
            Draw.io
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* 自动布局按钮 - 仅在 Excalidraw 模式显示 */}
        {engine === "excalidraw" && (
          <button
            onClick={onAutoLayoutClick}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-sm"
            title="自动布局"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
              />
            </svg>
            <span className="hidden sm:inline">布局</span>
          </button>
        )}

        <ImportButton />
        <ExportButton />

        <div className="w-px h-6 bg-slate-700 mx-2" />

        <button
          onClick={onSettingsClick}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="设置"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
