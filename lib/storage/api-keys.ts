/**
 * API Key 管理模块
 * 管理 LLM Provider 的 API Keys
 */

import { getItem, setItem, removeItem } from "./local-storage";

export type LLMProvider = "openai" | "anthropic" | "gemini";

interface ApiKeyConfig {
    provider: LLMProvider;
    key: string;
    createdAt: number;
}

interface ApiKeysStore {
    keys: ApiKeyConfig[];
    activeProvider: LLMProvider | null;
}

const API_KEYS_STORAGE_KEY = "api_keys";

/**
 * 获取所有已保存的 API Keys 配置
 */
export function getApiKeysConfig(): ApiKeysStore {
    const stored = getItem<ApiKeysStore>(API_KEYS_STORAGE_KEY);
    if (stored === null) {
        return { keys: [], activeProvider: null };
    }
    return stored;
}

/**
 * 保存 API Key
 */
export function saveApiKey(provider: LLMProvider, key: string): boolean {
    const config = getApiKeysConfig();

    // 查找是否已存在该 Provider 的 Key
    const existingIndex = config.keys.findIndex((k) => k.provider === provider);

    const newKeyConfig: ApiKeyConfig = {
        provider,
        key,
        createdAt: Date.now(),
    };

    if (existingIndex >= 0) {
        // 更新已存在的 Key
        config.keys[existingIndex] = newKeyConfig;
    } else {
        // 添加新的 Key
        config.keys.push(newKeyConfig);
    }

    // 如果没有活跃的 Provider，设置当前为活跃
    if (config.activeProvider === null) {
        config.activeProvider = provider;
    }

    return setItem(API_KEYS_STORAGE_KEY, config);
}

/**
 * 获取指定 Provider 的 API Key
 */
export function getApiKey(provider: LLMProvider): string | null {
    const config = getApiKeysConfig();
    const keyConfig = config.keys.find((k) => k.provider === provider);
    if (keyConfig === undefined) {
        return null;
    }
    return keyConfig.key;
}

/**
 * 获取当前活跃 Provider 的 API Key
 */
export function getActiveApiKey(): { provider: LLMProvider; key: string } | null {
    const config = getApiKeysConfig();
    if (config.activeProvider === null) {
        return null;
    }

    const key = getApiKey(config.activeProvider);
    if (key === null) {
        return null;
    }

    return { provider: config.activeProvider, key };
}

/**
 * 设置活跃的 Provider
 */
export function setActiveProvider(provider: LLMProvider): boolean {
    const config = getApiKeysConfig();

    // 检查是否有该 Provider 的 Key
    const hasKey = config.keys.some((k) => k.provider === provider);
    if (!hasKey) {
        return false;
    }

    config.activeProvider = provider;
    return setItem(API_KEYS_STORAGE_KEY, config);
}

/**
 * 删除指定 Provider 的 API Key
 */
export function deleteApiKey(provider: LLMProvider): boolean {
    const config = getApiKeysConfig();

    config.keys = config.keys.filter((k) => k.provider !== provider);

    // 如果删除的是活跃的 Provider，重置活跃 Provider
    if (config.activeProvider === provider) {
        config.activeProvider = config.keys.length > 0 ? config.keys[0].provider : null;
    }

    return setItem(API_KEYS_STORAGE_KEY, config);
}

/**
 * 掩码显示 API Key
 */
export function maskApiKey(key: string): string {
    if (key.length <= 8) {
        return "***";
    }
    return key.substring(0, 4) + "***" + key.substring(key.length - 4);
}

/**
 * 获取 Provider 显示名称
 */
export function getProviderDisplayName(provider: LLMProvider): string {
    const names: Record<LLMProvider, string> = {
        openai: "OpenAI",
        anthropic: "Anthropic",
        gemini: "Google Gemini",
    };
    return names[provider];
}
