/**
 * 设备指纹生成模块
 * 生成简单的浏览器设备指纹用于用户识别
 */

/**
 * 简单的字符串哈希函数
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}

/**
 * 生成设备指纹
 * 基于浏览器和设备特征生成一个相对稳定的标识符
 */
export function generateFingerprint(): string {
    if (typeof window === "undefined") {
        return "server";
    }

    const components: string[] = [
        navigator.userAgent,
        navigator.language,
        `${screen.width}x${screen.height}`,
        `${screen.colorDepth}`,
        String(new Date().getTimezoneOffset()),
        String(navigator.hardwareConcurrency || 0),
        navigator.platform || "",
    ];

    return hashString(components.join("|"));
}

// 缓存指纹，避免重复计算
let cachedFingerprint: string | null = null;

/**
 * 获取设备指纹（带缓存）
 */
export function getFingerprint(): string {
    if (cachedFingerprint === null) {
        cachedFingerprint = generateFingerprint();
    }
    return cachedFingerprint;
}
