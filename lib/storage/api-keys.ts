/**
 * API Key 管理模块
 * 管理 LLM Provider 的 API Keys 和自定义 Base URL
 */

import { getItem, setItem } from "./local-storage";

export type LLMProvider = "openai" | "anthropic" | "gemini";

// 默认 API Base URL
const DEFAULT_BASE_URLS: Record<LLMProvider, string> = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com",
    gemini: "https://generativelanguage.googleapis.com/v1beta",
};

interface ApiKeyConfig {
    provider: LLMProvider;
    key: string;
    baseUrl: string;  // 添加 baseUrl 字段
    createdAt: number;
}

interface ApiKeysStore {
    keys: ApiKeyConfig[];
    activeProvider: LLMProvider | null;
}

const API_KEYS_STORAGE_KEY = "api_keys";

/**
 * 获取 Provider 的默认 Base URL
 */
export function getDefaultBaseUrl(provider: LLMProvider): string {
    return DEFAULT_BASE_URLS[provider];
}

/**
 * 获取所有已保存的 API Keys 配置
 */
export function getApiKeysConfig(): ApiKeysStore {
    const stored = getItem<ApiKeysStore>(API_KEYS_STORAGE_KEY);
    if (stored === null) {
        return { keys: [], activeProvider: null };
    }
    // 兼容旧数据：为没有 baseUrl 的配置添加默认值
    const migratedKeys = stored.keys.map((k) => ({
        ...k,
        baseUrl: k.baseUrl || DEFAULT_BASE_URLS[k.provider],
    }));
    return { ...stored, keys: migratedKeys };
}

/**
 * 保存 API Key（支持自定义 Base URL）
 */
export function saveApiKey(
    provider: LLMProvider,
    key: string,
    baseUrl?: string
): boolean {
    const config = getApiKeysConfig();

    // 查找是否已存在该 Provider 的 Key
    const existingIndex = config.keys.findIndex((k) => k.provider === provider);

    const newKeyConfig: ApiKeyConfig = {
        provider,
        key,
        baseUrl: baseUrl || DEFAULT_BASE_URLS[provider],
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
 * 获取指定 Provider 的 Base URL
 */
export function getBaseUrl(provider: LLMProvider): string {
    const config = getApiKeysConfig();
    const keyConfig = config.keys.find((k) => k.provider === provider);
    if (keyConfig === undefined) {
        return DEFAULT_BASE_URLS[provider];
    }
    return keyConfig.baseUrl;
}

/**
 * 获取指定 Provider 的完整配置
 */
export function getProviderConfig(
    provider: LLMProvider
): { key: string; baseUrl: string } | null {
    const config = getApiKeysConfig();
    const keyConfig = config.keys.find((k) => k.provider === provider);
    if (keyConfig === undefined) {
        return null;
    }
    return { key: keyConfig.key, baseUrl: keyConfig.baseUrl };
}

/**
 * 获取当前活跃 Provider 的 API Key 和 Base URL
 */
export function getActiveApiKey(): {
    provider: LLMProvider;
    key: string;
    baseUrl: string;
} | null {
    const config = getApiKeysConfig();
    if (config.activeProvider === null) {
        return null;
    }

    const providerConfig = getProviderConfig(config.activeProvider);
    if (providerConfig === null) {
        return null;
    }

    return { provider: config.activeProvider, ...providerConfig };
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
