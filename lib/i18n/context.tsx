"use client";

/**
 * 语言上下文
 * 管理当前语言状态和切换
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { zh, TranslationKeys } from "./locales/zh";
import { en } from "./locales/en";

export type Language = "zh" | "en";

const LANGUAGE_STORAGE_KEY = "smartcanvas-language";

// 语言包映射
const locales: Record<Language, TranslationKeys> = {
    zh,
    en: en as TranslationKeys,
};

// Context 值类型
interface I18nContextValue {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    locale: TranslationKeys;
}

// 创建 Context
const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * 获取嵌套对象的值
 */
function getNestedValue(obj: unknown, path: string): string | undefined {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== "object") {
            return undefined;
        }
        current = (current as Record<string, unknown>)[key];
    }

    return typeof current === "string" ? current : undefined;
}

/**
 * 替换模板参数
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return params[key] !== undefined ? String(params[key]) : match;
    });
}

/**
 * I18n Provider
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>("zh");

    // 初始化时从 localStorage 读取
    useEffect(() => {
        const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
        if (saved && (saved === "zh" || saved === "en")) {
            setLanguageState(saved);
        } else {
            // 检测浏览器语言
            const browserLang = navigator.language.toLowerCase();
            if (browserLang.startsWith("zh")) {
                setLanguageState("zh");
            } else {
                setLanguageState("en");
            }
        }
    }, []);

    // 设置语言并保存
    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    }, []);

    // 翻译函数
    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
        const value = getNestedValue(locales[language], key);
        if (value === undefined) {
            console.warn(`Missing translation: ${key}`);
            return key;
        }
        return interpolate(value, params);
    }, [language]);

    const value: I18nContextValue = {
        language,
        setLanguage,
        t,
        locale: locales[language],
    };

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
}

/**
 * useTranslation hook
 */
export function useTranslation() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error("useTranslation must be used within I18nProvider");
    }
    return context;
}

/**
 * 获取当前语言（不在组件中使用）
 */
export function getCurrentLanguage(): Language {
    if (typeof window === "undefined") return "zh";
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    return saved || "zh";
}
