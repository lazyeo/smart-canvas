/**
 * LocalStorage 工具函数
 * 提供类型安全的本地存储操作
 */

const STORAGE_PREFIX = "smartcanvas_";

/**
 * 获取存储项
 */
export function getItem<T>(key: string): T | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const item = localStorage.getItem(STORAGE_PREFIX + key);
        if (item === null) {
            return null;
        }
        return JSON.parse(item) as T;
    } catch (error) {
        console.error(`Failed to get item from localStorage: ${key}`, error);
        return null;
    }
}

/**
 * 设置存储项
 */
export function setItem<T>(key: string, value: T): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Failed to set item in localStorage: ${key}`, error);
        return false;
    }
}

/**
 * 移除存储项
 */
export function removeItem(key: string): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    try {
        localStorage.removeItem(STORAGE_PREFIX + key);
        return true;
    } catch (error) {
        console.error(`Failed to remove item from localStorage: ${key}`, error);
        return false;
    }
}

/**
 * 清除所有 SmartCanvas 存储项
 */
export function clearAll(): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    try {
        const keys = Object.keys(localStorage).filter((key) =>
            key.startsWith(STORAGE_PREFIX)
        );
        keys.forEach((key) => localStorage.removeItem(key));
        return true;
    } catch (error) {
        console.error("Failed to clear localStorage", error);
        return false;
    }
}
