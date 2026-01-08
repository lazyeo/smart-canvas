/**
 * 缩略图生成工具
 * 从 Excalidraw 元素生成预览图
 */

/**
 * 从 Excalidraw 元素生成缩略图 Base64
 * @param elements Excalidraw 元素数组
 * @param options 配置选项
 * @returns Base64 编码的图片数据，或 undefined 如果生成失败
 */
export async function generateThumbnail(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[],
    options: {
        maxWidth?: number;
        maxHeight?: number;
    } = {}
): Promise<string | undefined> {
    const {
        maxWidth = 280,  // 缩略图宽度
        maxHeight = 180, // 缩略图高度
    } = options;

    // 过滤掉已删除的元素
    const visibleElements = elements.filter(el => !el.isDeleted);

    if (visibleElements.length === 0) {
        return undefined;
    }

    try {
        // 动态导入 Excalidraw 导出工具
        const { exportToBlob } = await import("@excalidraw/excalidraw");

        // 生成缩略图 - 让 Excalidraw 自动计算边界和缩放
        // 使用 exportPadding 确保完整显示
        const blob = await exportToBlob({
            elements: visibleElements,
            appState: {
                exportBackground: true,
                viewBackgroundColor: "#ffffff",
                exportWithDarkMode: false,
                exportPadding: 15, // 边距
            },
            files: null,
            maxWidthOrHeight: Math.max(maxWidth, maxHeight) * 2, // 生成较大图片再缩放，保证清晰
        });

        // 使用 Canvas 缩放到目标尺寸
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // 计算缩放以适应目标尺寸
                const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                const targetWidth = Math.round(img.width * scale);
                const targetHeight = Math.round(img.height * scale);

                // 创建 canvas 进行缩放
                const canvas = document.createElement("canvas");
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(undefined);
                    return;
                }

                // 使用高质量缩放
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = () => {
                resolve(undefined);
            };
            img.src = URL.createObjectURL(blob);
        });
    } catch (error) {
        console.error("[Thumbnail] Generation failed:", error);
        return undefined;
    }
}

/**
 * 生成简单的占位符缩略图（SVG）
 * 用于无法生成实际缩略图时的降级方案
 */
export function generatePlaceholderThumbnail(
    nodeCount: number = 0,
    edgeCount: number = 0
): string {
    // 使用英文避免编码问题
    const nodeText = nodeCount > 0 ? `${nodeCount} nodes` : "Empty";
    const edgeText = edgeCount > 0 ? ` - ${edgeCount} edges` : "";

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
            <rect width="200" height="150" fill="#1e293b"/>
            <rect x="30" y="30" width="60" height="35" rx="4" fill="#3b82f6" opacity="0.3"/>
            <rect x="110" y="30" width="60" height="35" rx="4" fill="#3b82f6" opacity="0.3"/>
            <rect x="70" y="85" width="60" height="35" rx="4" fill="#3b82f6" opacity="0.3"/>
            <line x1="90" y1="65" x2="90" y2="85" stroke="#64748b" stroke-width="2"/>
            <line x1="110" y1="47" x2="140" y2="47" stroke="#64748b" stroke-width="2"/>
            <text x="100" y="140" text-anchor="middle" fill="#64748b" font-size="10" font-family="system-ui">
                ${nodeText}${edgeText}
            </text>
        </svg>
    `.trim();

    // 使用 encodeURIComponent 处理特殊字符
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * 从 elements 统计节点和连线数量
 */
export function countElementStats(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[]
): { nodeCount: number; edgeCount: number } {
    const visibleElements = elements.filter(el => !el.isDeleted);

    const nodeCount = visibleElements.filter(
        el => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond"
    ).length;

    const edgeCount = visibleElements.filter(
        el => el.type === "arrow" || el.type === "line"
    ).length;

    return { nodeCount, edgeCount };
}
