"use client";

import React, { useState, useRef, useEffect } from "react";
import { ExportButton, ImportButton } from "@/components/toolbar";
import { useEngine, CanvasEngine } from "@/contexts";
import { useFile } from "@/contexts/FileContext";
import { useTranslation, Language } from "@/lib/i18n";
import { formatVersionTime } from "@/types/diagram-file";
import { FileList } from "./FileList";
import { VersionPanel } from "./VersionPanel";
import { EnhancementPanel } from "./EnhancementPanel";

interface HeaderProps {
  onSettingsClick?: () => void;
  onAutoLayoutClick?: () => void;
}

export function Header({ onSettingsClick, onAutoLayoutClick }: HeaderProps) {
  const { engine, setEngine } = useEngine();
  const { language, setLanguage, t } = useTranslation();
  const {
    currentFile,
    currentSimpleVersion,
    currentProfessionalVersion,
    renameFile,
    saveStatus,
    switchToSimpleVersion,
    switchToProfessionalVersion,
  } = useFile();

  const [showFileList, setShowFileList] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showEnhancementPanel, setShowEnhancementPanel] = useState(false);
  const [showSimpleVersionMenu, setShowSimpleVersionMenu] = useState(false);
  const [showProfessionalVersionMenu, setShowProfessionalVersionMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 聚焦输入框
  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  // 开始编辑文件名
  const startEditName = () => {
    if (currentFile) {
      setEditName(currentFile.name);
      setIsEditingName(true);
    }
  };

  // 确认重命名
  const confirmRename = () => {
    if (currentFile && editName.trim() && editName !== currentFile.name) {
      renameFile(currentFile.id, editName.trim());
    }
    setIsEditingName(false);
  };

  // 取消编辑
  const cancelEdit = () => {
    setIsEditingName(false);
    setEditName("");
  };

  // 获取保存状态图标
  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case "saving":
        return (
          <svg className="w-4 h-4 animate-spin text-yellow-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      case "saved":
        return (
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case "error":
        return (
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const handleEngineChange = (newEngine: CanvasEngine) => {
    setEngine(newEngine);
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  return (
    <>
      <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {/* 文件列表按钮 */}
          <button
            onClick={() => setShowFileList(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={t("headerExtra.myFiles")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </button>

          {/* 文件名显示/编辑 */}
          {currentFile ? (
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={confirmRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="bg-slate-800 text-white text-sm px-2 py-1 rounded border border-blue-500 outline-none w-48"
                />
              ) : (
                <button
                  onClick={startEditName}
                  className="text-white text-sm hover:text-blue-400 transition-colors max-w-[200px] truncate"
                  title={currentFile.name}
                >
                  {currentFile.name}
                </button>
              )}
              {/* 保存状态 */}
              <div className="flex items-center gap-1">
                {getSaveStatusIcon()}
              </div>
            </div>
          ) : (
            <h1 className="text-lg font-semibold text-white">SmartCanvas AI</h1>
          )}

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
              {t("header.engineExcalidraw")}
            </button>
            <button
              onClick={() => handleEngineChange("drawio")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${engine === "drawio"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
                }`}
            >
              {t("header.engineDrawio")}
            </button>
          </div>

          {/* 版本切换区域 */}
          {currentFile && (
            <div className="flex items-center gap-2 ml-4">
              {/* 简明版版本下拉 */}
              <div className="relative">
                <button
                  onClick={() => setShowSimpleVersionMenu(!showSimpleVersionMenu)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${engine === "excalidraw"
                      ? "bg-blue-600/20 text-blue-300 border border-blue-500"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                >
                  <span>{t("common.simpleVersion")} v{currentSimpleVersion?.versionNumber || 1}</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showSimpleVersionMenu && currentFile.simpleVersions.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSimpleVersionMenu(false)} />
                    <div className="absolute left-0 top-full mt-1 bg-slate-800 rounded-lg shadow-lg z-50 py-1 min-w-[180px] border border-slate-600">
                      {[...currentFile.simpleVersions]
                        .sort((a, b) => b.versionNumber - a.versionNumber)
                        .map((version) => (
                          <button
                            key={version.id}
                            onClick={() => {
                              switchToSimpleVersion(version.id);
                              setShowSimpleVersionMenu(false);
                              setEngine("excalidraw");
                            }}
                            className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-700 flex items-center justify-between ${version.id === currentSimpleVersion?.id ? "text-blue-400" : "text-slate-300"
                              }`}
                          >
                            <span>v{version.versionNumber} - {formatVersionTime(version.createdAt)}</span>
                            {version.id === currentSimpleVersion?.id && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      <div className="border-t border-slate-700 mt-1 pt-1">
                        <button
                          onClick={() => {
                            setShowSimpleVersionMenu(false);
                            setShowVersionPanel(true);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-700 hover:text-white"
                        >
                          管理版本...
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 专业版版本下拉 */}
              <div className="relative">
                <button
                  onClick={() => setShowProfessionalVersionMenu(!showProfessionalVersionMenu)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${engine === "drawio" && currentProfessionalVersion
                      ? "bg-purple-600/20 text-purple-300 border border-purple-500"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                >
                  <span>
                    {currentProfessionalVersion
                      ? `专业版 v${currentProfessionalVersion.versionNumber}`
                      : t("headerExtra.proVersion")}
                  </span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showProfessionalVersionMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfessionalVersionMenu(false)} />
                    <div className="absolute left-0 top-full mt-1 bg-slate-800 rounded-lg shadow-lg z-50 py-1 min-w-[180px] border border-slate-600">
                      {currentFile.professionalVersions.length > 0 ? (
                        [...currentFile.professionalVersions]
                          .sort((a, b) => b.versionNumber - a.versionNumber)
                          .map((version) => (
                            <button
                              key={version.id}
                              onClick={() => {
                                switchToProfessionalVersion(version.id);
                                setShowProfessionalVersionMenu(false);
                                setEngine("drawio");
                              }}
                              className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-700 flex items-center justify-between ${version.id === currentProfessionalVersion?.id ? "text-purple-400" : "text-slate-300"
                                }`}
                            >
                              <span>v{version.versionNumber} - {formatVersionTime(version.createdAt)}</span>
                              {version.id === currentProfessionalVersion?.id && (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-slate-500">暂无专业版</div>
                      )}
                      <div className="border-t border-slate-700 mt-1 pt-1">
                        <button
                          onClick={() => {
                            setShowProfessionalVersionMenu(false);
                            setShowEnhancementPanel(true);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-purple-400 hover:bg-slate-700 flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          {t("header.generateNewVersion")}...
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 生成专业版按钮 */}
              <button
                onClick={() => setShowEnhancementPanel(true)}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="hidden sm:inline">{t("header.generatePro")}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* 自动布局按钮 - 仅在 Excalidraw 模式显示 */}
          {engine === "excalidraw" && (
            <button
              onClick={onAutoLayoutClick}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-sm"
              title={t("header.autoLayout")}
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
              <span className="hidden sm:inline">{t("header.autoLayout")}</span>
            </button>
          )}

          <ImportButton />
          <ExportButton />

          <div className="w-px h-6 bg-slate-700 mx-2" />

          {/* 语言切换 */}
          <div className="flex bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => handleLanguageChange("zh")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${language === "zh"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
                }`}
            >
              中
            </button>
            <button
              onClick={() => handleLanguageChange("en")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${language === "en"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
                }`}
            >
              EN
            </button>
          </div>

          <button
            onClick={onSettingsClick}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={t("common.settings")}
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

      {/* 文件列表侧边栏 */}
      <FileList isOpen={showFileList} onClose={() => setShowFileList(false)} />

      {/* 版本历史面板 */}
      <VersionPanel
        isOpen={showVersionPanel}
        onClose={() => setShowVersionPanel(false)}
        onGenerateProfessional={() => {
          setShowVersionPanel(false);
          setShowEnhancementPanel(true);
        }}
      />

      {/* 增强配置面板 */}
      <EnhancementPanel
        isOpen={showEnhancementPanel}
        onClose={() => setShowEnhancementPanel(false)}
      />
    </>
  );
}
