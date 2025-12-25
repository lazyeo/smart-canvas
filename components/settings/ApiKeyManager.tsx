"use client";

import React, { useState, useEffect } from "react";
import {
    saveApiKey,
    getApiKey,
    getBaseUrl,
    getModel,
    deleteApiKey,
    setActiveProvider,
    maskApiKey,
    getProviderDisplayName,
    getApiKeysConfig,
    getDefaultBaseUrl,
    getDefaultModel,
    LLMProvider,
} from "@/lib/storage";
import { useTranslation } from "@/lib/i18n";

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
    const [baseUrls, setBaseUrls] = useState<Record<LLMProvider, string>>({
        openai: getDefaultBaseUrl("openai"),
        anthropic: getDefaultBaseUrl("anthropic"),
        gemini: getDefaultBaseUrl("gemini"),
    });
    const [models, setModels] = useState<Record<LLMProvider, string>>({
        openai: getDefaultModel("openai"),
        anthropic: getDefaultModel("anthropic"),
        gemini: getDefaultModel("gemini"),
    });
    const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
    const [inputKey, setInputKey] = useState("");
    const [inputBaseUrl, setInputBaseUrl] = useState("");
    const [inputModel, setInputModel] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const { t } = useTranslation();

    // 加载已保存的 Keys
    useEffect(() => {
        const config = getApiKeysConfig();
        setActiveProviderState(config.activeProvider);

        const loadedKeys: Record<LLMProvider, string | null> = {
            openai: null,
            anthropic: null,
            gemini: null,
        };
        const loadedBaseUrls: Record<LLMProvider, string> = {
            openai: getDefaultBaseUrl("openai"),
            anthropic: getDefaultBaseUrl("anthropic"),
            gemini: getDefaultBaseUrl("gemini"),
        };
        const loadedModels: Record<LLMProvider, string> = {
            openai: getDefaultModel("openai"),
            anthropic: getDefaultModel("anthropic"),
            gemini: getDefaultModel("gemini"),
        };

        PROVIDERS.forEach((provider) => {
            loadedKeys[provider] = getApiKey(provider);
            loadedBaseUrls[provider] = getBaseUrl(provider);
            loadedModels[provider] = getModel(provider);
        });

        setKeys(loadedKeys);
        setBaseUrls(loadedBaseUrls);
        setModels(loadedModels);
    }, []);

    const handleStartEdit = (provider: LLMProvider) => {
        setEditingProvider(provider);
        setInputKey("");
        setInputBaseUrl(baseUrls[provider]);
        setInputModel(models[provider]);
        const hasCustomSettings =
            baseUrls[provider] !== getDefaultBaseUrl(provider) ||
            models[provider] !== getDefaultModel(provider);
        setShowAdvanced(hasCustomSettings);
    };

    const handleSave = (provider: LLMProvider) => {
        if (inputKey.trim() === "") {
            setMessage({ type: "error", text: t("apiKey.apiKeyEmpty") });
            return;
        }

        const finalBaseUrl = inputBaseUrl.trim() || getDefaultBaseUrl(provider);
        const finalModel = inputModel.trim() || getDefaultModel(provider);
        const success = saveApiKey(provider, inputKey.trim(), finalBaseUrl, finalModel);

        if (success) {
            setKeys((prev) => ({ ...prev, [provider]: inputKey.trim() }));
            setBaseUrls((prev) => ({ ...prev, [provider]: finalBaseUrl }));
            setModels((prev) => ({ ...prev, [provider]: finalModel }));
            setEditingProvider(null);
            setInputKey("");
            setInputBaseUrl("");
            setInputModel("");
            setShowAdvanced(false);
            setMessage({ type: "success", text: t("apiKey.saveSuccess") });

            // 如果是第一个 Key，自动设为活跃
            if (activeProvider === null) {
                setActiveProviderState(provider);
            }

            setTimeout(() => setMessage(null), 2000);
        } else {
            setMessage({ type: "error", text: t("apiKey.saveFailed") });
        }
    };

    const handleDelete = (provider: LLMProvider) => {
        const success = deleteApiKey(provider);
        if (success) {
            setKeys((prev) => ({ ...prev, [provider]: null }));
            setBaseUrls((prev) => ({ ...prev, [provider]: getDefaultBaseUrl(provider) }));
            setModels((prev) => ({ ...prev, [provider]: getDefaultModel(provider) }));
            if (activeProvider === provider) {
                const config = getApiKeysConfig();
                setActiveProviderState(config.activeProvider);
            }
            setMessage({ type: "success", text: t("apiKey.deleteSuccess") });
            setTimeout(() => setMessage(null), 2000);
        }
    };

    const handleSetActive = (provider: LLMProvider) => {
        const success = setActiveProvider(provider);
        if (success) {
            setActiveProviderState(provider);
            setMessage({ type: "success", text: t("apiKey.switchedTo", { provider: getProviderDisplayName(provider) }) });
            setTimeout(() => setMessage(null), 2000);
        }
    };

    const handleCancel = () => {
        setEditingProvider(null);
        setInputKey("");
        setInputBaseUrl("");
        setInputModel("");
        setShowAdvanced(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white">{t("apiKey.title")}</h2>
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
                        {t("apiKey.description")}
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
                                                {t("apiKey.currentlyUsing")}
                                            </span>
                                        )}
                                    </div>
                                    {keys[provider] !== null && activeProvider !== provider && (
                                        <button
                                            onClick={() => handleSetActive(provider)}
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            {t("apiKey.setDefault")}
                                        </button>
                                    )}
                                </div>

                                {editingProvider === provider ? (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">API Key</label>
                                            <input
                                                type="password"
                                                value={inputKey}
                                                onChange={(e) => setInputKey(e.target.value)}
                                                placeholder={`输入 ${getProviderDisplayName(provider)} API Key`}
                                                className="w-full bg-slate-800 text-white text-sm rounded px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
                                                autoFocus
                                            />
                                        </div>

                                        <button
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
                                        >
                                            <svg
                                                className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            {t("apiKey.advancedSettings")}
                                        </button>

                                        {showAdvanced && (
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        {t("apiKey.model")}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={inputModel}
                                                        onChange={(e) => setInputModel(e.target.value)}
                                                        placeholder={getDefaultModel(provider)}
                                                        className="w-full bg-slate-800 text-white text-sm rounded px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        {t("apiKey.baseUrl")}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={inputBaseUrl}
                                                        onChange={(e) => setInputBaseUrl(e.target.value)}
                                                        placeholder={getDefaultBaseUrl(provider)}
                                                        className="w-full bg-slate-800 text-white text-sm rounded px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 font-mono text-xs"
                                                    />
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {t("apiKey.baseUrlHint")}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSave(provider)}
                                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                                            >
                                                {t("apiKey.save")}
                                            </button>
                                            <button
                                                onClick={handleCancel}
                                                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                                            >
                                                {t("apiKey.cancel")}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {keys[provider] !== null ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <code className="text-sm text-slate-400 bg-slate-800 px-2 py-1 rounded">
                                                        {maskApiKey(keys[provider] as string)}
                                                    </code>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleStartEdit(provider)}
                                                            className="text-xs text-slate-400 hover:text-white"
                                                        >
                                                            {t("apiKey.modify")}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(provider)}
                                                            className="text-xs text-red-400 hover:text-red-300"
                                                        >
                                                            {t("apiKey.delete")}
                                                        </button>
                                                    </div>
                                                </div>
                                                {models[provider] !== getDefaultModel(provider) && (
                                                    <div className="text-xs text-slate-500 font-mono truncate">
                                                        Model: {models[provider]}
                                                    </div>
                                                )}
                                                {baseUrls[provider] !== getDefaultBaseUrl(provider) && (
                                                    <div className="text-xs text-slate-500 font-mono truncate">
                                                        Base: {baseUrls[provider]}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleStartEdit(provider)}
                                                className="text-sm text-blue-400 hover:text-blue-300"
                                            >
                                                {t("apiKey.addApiKey")}
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
                        {t("apiKey.close")}
                    </button>
                </div>
            </div>
        </div>
    );
}
