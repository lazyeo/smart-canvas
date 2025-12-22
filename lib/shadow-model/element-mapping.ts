/**
 * 元素映射管理器
 * 管理画布元素与影子模型节点之间的映射关系
 */

import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";
import { ShadowNode, ElementNodeMapping } from "@/types";

// 内存中的映射缓存
const elementToNodeMap = new Map<string, { nodeId: string; moduleId: string }>();
const nodeToElementsMap = new Map<string, string[]>();

/**
 * 建立元素到节点的映射
 */
export function mapElementToNode(
    elementId: string,
    nodeId: string,
    moduleId: string
): void {
    elementToNodeMap.set(elementId, { nodeId, moduleId });

    const existingElements = nodeToElementsMap.get(nodeId) || [];
    if (!existingElements.includes(elementId)) {
        existingElements.push(elementId);
        nodeToElementsMap.set(nodeId, existingElements);
    }
}

/**
 * 解除元素到节点的映射
 */
export function unmapElement(elementId: string): void {
    const mapping = elementToNodeMap.get(elementId);
    if (mapping) {
        const elements = nodeToElementsMap.get(mapping.nodeId) || [];
        nodeToElementsMap.set(
            mapping.nodeId,
            elements.filter((id) => id !== elementId)
        );
        elementToNodeMap.delete(elementId);
    }
}

/**
 * 根据元素 ID 获取节点信息
 */
export function getNodeByElementId(
    elementId: string
): { nodeId: string; moduleId: string } | undefined {
    return elementToNodeMap.get(elementId);
}

/**
 * 根据节点 ID 获取所有关联的元素 ID
 */
export function getElementsByNodeId(nodeId: string): string[] {
    return nodeToElementsMap.get(nodeId) || [];
}

/**
 * 批量建立映射
 */
export function batchMapElements(mappings: ElementNodeMapping[]): void {
    for (const mapping of mappings) {
        mapElementToNode(mapping.elementId, mapping.nodeId, mapping.moduleId);
    }
}

/**
 * 清除所有映射
 */
export function clearAllMappings(): void {
    elementToNodeMap.clear();
    nodeToElementsMap.clear();
}

/**
 * 获取所有映射
 */
export function getAllMappings(): ElementNodeMapping[] {
    const mappings: ElementNodeMapping[] = [];
    elementToNodeMap.forEach((value, elementId) => {
        mappings.push({
            elementId,
            nodeId: value.nodeId,
            moduleId: value.moduleId,
        });
    });
    return mappings;
}

/**
 * 从 Excalidraw 元素的 customData 恢复映射
 */
export function restoreMappingsFromElements(elements: ExcalidrawElement[]): void {
    for (const element of elements) {
        if (element.customData && element.customData.nodeId && element.customData.moduleId) {
            mapElementToNode(
                element.id,
                element.customData.nodeId as string,
                element.customData.moduleId as string
            );
        }
    }
}

/**
 * 将映射信息注入到 Excalidraw 元素的 customData
 */
export function injectMappingsToElements(
    elements: ExcalidrawElement[]
): ExcalidrawElement[] {
    return elements.map((element) => {
        const mapping = elementToNodeMap.get(element.id);
        if (mapping) {
            return {
                ...element,
                customData: {
                    ...element.customData,
                    nodeId: mapping.nodeId,
                    moduleId: mapping.moduleId,
                },
            };
        }
        return element;
    });
}

/**
 * 查找选中元素对应的节点
 */
export function findNodesForSelectedElements(
    selectedElementIds: string[]
): Array<{ elementId: string; nodeId: string; moduleId: string }> {
    const result: Array<{ elementId: string; nodeId: string; moduleId: string }> = [];

    for (const elementId of selectedElementIds) {
        const mapping = elementToNodeMap.get(elementId);
        if (mapping) {
            result.push({
                elementId,
                nodeId: mapping.nodeId,
                moduleId: mapping.moduleId,
            });
        }
    }

    return result;
}
