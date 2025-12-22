/**
 * 画布导入导出工具
 */

import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";

interface ExportData {
    type: "excalidraw";
    version: number;
    elements: readonly ExcalidrawElement[];
    appState?: Record<string, unknown>;
}

/**
 * 导出为 JSON 文件
 */
export function exportToJSON(elements: readonly ExcalidrawElement[], filename?: string): void {
    const data: ExportData = {
        type: "excalidraw",
        version: 2,
        elements,
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `smartcanvas-${Date.now()}.excalidraw`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 从 JSON 文件导入
 */
export async function importFromJSON(file: File): Promise<ExcalidrawElement[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const result = event.target?.result;
                if (typeof result !== "string") {
                    reject(new Error("Failed to read file"));
                    return;
                }

                const data = JSON.parse(result);

                // 验证数据格式
                if (data.type !== "excalidraw" || !Array.isArray(data.elements)) {
                    reject(new Error("Invalid Excalidraw file format"));
                    return;
                }

                resolve(data.elements);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
    });
}

/**
 * 导出为 PNG 图片
 */
export async function exportToPNG(
    elements: readonly ExcalidrawElement[],
    filename?: string
): Promise<void> {
    // 使用 Excalidraw 的导出功能
    const { exportToBlob } = await import("@excalidraw/excalidraw");

    const blob = await exportToBlob({
        elements: elements as ExcalidrawElement[],
        mimeType: "image/png",
        appState: {
            exportWithDarkMode: false,
            exportBackground: true,
        },
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `smartcanvas-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * 导出为 SVG 图片
 */
export async function exportToSVG(
    elements: readonly ExcalidrawElement[],
    filename?: string
): Promise<void> {
    const { exportToSvg } = await import("@excalidraw/excalidraw");

    const svg = await exportToSvg({
        elements: elements as ExcalidrawElement[],
        appState: {
            exportWithDarkMode: false,
            exportBackground: true,
        },
    });

    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `smartcanvas-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
