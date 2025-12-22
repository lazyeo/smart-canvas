"use client";

import React, { useState, useEffect } from "react";
import {
    saveApiKey,
    getApiKey,
    deleteApiKey,
    setActiveProvider,
    maskApiKey,
    getProviderDisplayName,
    getApiKeysConfig,
    LLMProvider,
} from "@/lib/storage";

const PROVIDERS: LLMProvider[] = ["openai", "anthropic", "gemini"];

interface ApiKeyManagerProps {
    onClose?: () => void;
}

export function ApiKeyManager({ onClose }: ApiKeyManagerProps) {
    const [activeProvider, setActiveProviderState] = useState<LLMProvider | null>(null);
    const [keys, setKeys] = useState<Record<LLMProvider, string | null>>({
        openai: null,
        anthropic: null,
        gemini: null,
    });
    const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
    const [inputValue, setInputValue] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // 加载已保存的 Keys
    useEffect(() => {
        const config = getApiKeysConfig();
        setActiveProviderState(config.activeProvider);

        const loadedKeys: Record<LLMProvider, string | null> = {
            openai: null,
            anthropic: null,
            gemini: null,
        };

        PROVIDERS.forEach((provider) => {
            loadedKeys[provider] = getApiKey(provider);
        });

        setKeys(loadedKeys);
    }, []);

    const handleSave = (provider: LLMProvider) => {
        if (inputValue.trim() === "") {
            setMessage({ type: "error", text: "API Key 不能为空" });
            return;
        }

        const success = saveApiKey(provider, inputValue.trim());
        if (success) {
            setKeys((prev) => ({ ...prev, [provider]: inputValue.trim() }));
            setEditingProvider(null);
            setInputValue("");
            setMessage({ type: "success", text: "保存成功" });

            // 如果是第一个 Key，自动设为活跃
            if (activeProvider === null) {
                setActiveProviderState(provider);
            }

            setTimeout(() => setMessage(null), 2000);
        } else {
            setMessage({ type: "error", text: "保存失败" });
        }
    };

    const handleDelete = (provider: LLMProvider) => {
        const success = deleteApiKey(provider);
        if (success) {
            setKeys((prev) => ({ ...prev, [provider]: null }));
            if (activeProvider === provider) {
                const config = getApiKeysConfig();
                setActiveProviderState(config.activeProvider);
            }
            setMessage({ type: "success", text: "删除成功" });
            setTimeout(() => setMessage(null), 2000);
        }
    };

    const handleSetActive = (provider: LLMProvider) => {
        const success = setActiveProvider(provider);
        if (success) {
            setActiveProviderState(provider);
            setMessage({ type: "success", text: `已切换到 ${getProviderDisplayName(provider)}` });
            setTimeout(() => setMessage(null), 2000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white">API Key 设置</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {message !== null && (
                        <div
                            className={`px-3 py-2 rounded-lg text-sm ${message.type === "success"
                                    ? "bg-green-900/50 text-green-300"
                                    : "bg-red-900/50 text-red-300"
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <p className="text-sm text-slate-400">
                        配置您的 LLM API Key，所有数据仅存储在本地浏览器中。
                    </p>

                    <div className="space-y-3">
                        {PROVIDERS.map((provider) => (
                            <div
                                key={provider}
                                className={`p-3 rounded-lg border transition-colors ${activeProvider === provider
                                        ? "border-blue-500 bg-blue-900/20"
                                        : "border-slate-700 bg-slate-900/50"
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-medium">
                                            {getProviderDisplayName(provider)}
                                        </span>
                                        {activeProvider === provider && (
                                            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                                                当前使用
                                            </span>
                                        )}
                                    </div>
                                    {keys[provider] !== null && activeProvider !== provider && (
                                        <button
                                            onClick={() => handleSetActive(provider)}
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            设为默认
                                        </button>
                                    )}
                                </div>

                                {editingProvider === provider ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder={`输入 ${getProviderDisplayName(provider)} API Key`}
                                            className="flex-1 bg-slate-800 text-white text-sm rounded px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => handleSave(provider)}
                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                                        >
                                            保存
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingProvider(null);
                                                setInputValue("");
                                            }}
                                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                                        >
                                            取消
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        {keys[provider] !== null ? (
                                            <>
                                                <code className="text-sm text-slate-400 bg-slate-800 px-2 py-1 rounded">
                                                    {maskApiKey(keys[provider] as string)}
                                                </code>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingProvider(provider);
                                                            setInputValue("");
                                                        }}
                                                        className="text-xs text-slate-400 hover:text-white"
                                                    >
                                                        修改
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(provider)}
                                                        className="text-xs text-red-400 hover:text-red-300"
                                                    >
                                                        删除
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingProvider(provider);
                                                    setInputValue("");
                                                }}
                                                className="text-sm text-blue-400 hover:text-blue-300"
                                            >
                                                + 添加 API Key
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
}
