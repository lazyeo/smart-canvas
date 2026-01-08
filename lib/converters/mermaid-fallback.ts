/**
 * Mermaid 降级转换器
 * 将不支持的图表类型转换为 Excalidraw 可显示的降级格式
 */

import type { MermaidDiagramType } from "./mermaid-converter";

// ============= 降级结果类型 =============

export interface FallbackResult {
    success: boolean;
    mermaidCode?: string;      // 转换后的 Mermaid 代码
    originalType: MermaidDiagramType;
    fallbackType: string;      // 降级后的类型
    warning?: string;          // 降级提示信息
    error?: string;
}

// ============= ER 图降级 =============

/**
 * 将 ER 图降级为类图形式
 * erDiagram 在 @excalidraw/mermaid-to-excalidraw 中不完全支持
 * 降级为 classDiagram 可以保持基本结构
 */
export function generateERFallback(erCode: string): FallbackResult {
    try {
        // 解析 ER 图实体和关系
        const lines = erCode.split("\n").filter(line => line.trim());
        const entities: Map<string, string[]> = new Map();
        const relationships: Array<{ from: string; to: string; label: string }> = [];

        let currentEntity = "";

        for (const line of lines) {
            const trimmed = line.trim();

            // 跳过 erDiagram 声明
            if (trimmed.toLowerCase() === "erdiagram") continue;

            // 检测实体定义 ENTITY {
            const entityMatch = trimmed.match(/^(\w+)\s*\{$/);
            if (entityMatch) {
                currentEntity = entityMatch[1];
                entities.set(currentEntity, []);
                continue;
            }

            // 检测实体结束 }
            if (trimmed === "}" && currentEntity) {
                currentEntity = "";
                continue;
            }

            // 检测实体属性
            if (currentEntity && trimmed !== "{" && trimmed !== "}") {
                const attrs = entities.get(currentEntity) || [];
                attrs.push(trimmed);
                entities.set(currentEntity, attrs);
                continue;
            }

            // 检测关系 ENTITY1 ||--o{ ENTITY2 : relationship
            const relationMatch = trimmed.match(/^(\w+)\s*(\|{1,2}|}{1,2}|o)?-{1,2}(\|{1,2}|}{1,2}|o)?\s*(\w+)\s*:\s*(.+)$/);
            if (relationMatch) {
                relationships.push({
                    from: relationMatch[1],
                    to: relationMatch[4],
                    label: relationMatch[5].replace(/"/g, ""),
                });
                // 确保实体存在
                if (!entities.has(relationMatch[1])) {
                    entities.set(relationMatch[1], []);
                }
                if (!entities.has(relationMatch[4])) {
                    entities.set(relationMatch[4], []);
                }
                continue;
            }

            // 简单关系格式 ENTITY1 -- ENTITY2
            const simpleRelationMatch = trimmed.match(/^(\w+)\s*[-|o{}]+\s*(\w+)(?:\s*:\s*(.+))?$/);
            if (simpleRelationMatch) {
                relationships.push({
                    from: simpleRelationMatch[1],
                    to: simpleRelationMatch[2],
                    label: simpleRelationMatch[3]?.replace(/"/g, "") || "relates",
                });
                if (!entities.has(simpleRelationMatch[1])) {
                    entities.set(simpleRelationMatch[1], []);
                }
                if (!entities.has(simpleRelationMatch[2])) {
                    entities.set(simpleRelationMatch[2], []);
                }
            }
        }

        // 生成 classDiagram
        let classCode = "classDiagram\n";

        // 添加类定义
        for (const [entity, attrs] of entities) {
            classCode += `    class ${entity} {\n`;
            for (const attr of attrs) {
                // 解析属性格式: type name PK/FK
                const attrParts = attr.trim().split(/\s+/);
                if (attrParts.length >= 2) {
                    const type = attrParts[0];
                    const name = attrParts[1];
                    const constraint = attrParts[2] || "";
                    const prefix = constraint === "PK" ? "+" : constraint === "FK" ? "#" : "";
                    classCode += `        ${prefix}${type} ${name}\n`;
                } else if (attrParts.length === 1) {
                    classCode += `        ${attrParts[0]}\n`;
                }
            }
            classCode += `    }\n`;
        }

        // 添加关系
        for (const rel of relationships) {
            classCode += `    ${rel.from} --> ${rel.to} : ${rel.label}\n`;
        }

        return {
            success: true,
            mermaidCode: classCode,
            originalType: "er",
            fallbackType: "classDiagram",
            warning: "ER 图已降级为类图显示，部分关系符号可能简化",
        };
    } catch (error) {
        return {
            success: false,
            originalType: "er",
            fallbackType: "classDiagram",
            error: error instanceof Error ? error.message : "ER 图解析失败",
        };
    }
}

// ============= 架构图降级 =============

/**
 * 将架构图描述转换为 flowchart + subgraph 形式
 * 用于将自定义架构图格式降级显示
 */
export function generateArchitectureFallback(
    nodes: Array<{ id: string; label: string; group?: string }>,
    edges: Array<{ from: string; to: string; label?: string }>
): FallbackResult {
    try {
        let flowchartCode = "flowchart TB\n";

        // 按组分类节点
        const groups: Map<string, Array<{ id: string; label: string }>> = new Map();
        const ungrouped: Array<{ id: string; label: string }> = [];

        for (const node of nodes) {
            if (node.group) {
                const group = groups.get(node.group) || [];
                group.push({ id: node.id, label: node.label });
                groups.set(node.group, group);
            } else {
                ungrouped.push({ id: node.id, label: node.label });
            }
        }

        // 生成分组（subgraph）
        for (const [groupName, groupNodes] of groups) {
            flowchartCode += `    subgraph ${groupName.replace(/\s+/g, "_")}["${groupName}"]\n`;
            for (const node of groupNodes) {
                flowchartCode += `        ${node.id}["${node.label}"]\n`;
            }
            flowchartCode += `    end\n`;
        }

        // 生成未分组节点
        for (const node of ungrouped) {
            flowchartCode += `    ${node.id}["${node.label}"]\n`;
        }

        // 生成连线
        for (const edge of edges) {
            if (edge.label) {
                flowchartCode += `    ${edge.from} -->|${edge.label}| ${edge.to}\n`;
            } else {
                flowchartCode += `    ${edge.from} --> ${edge.to}\n`;
            }
        }

        return {
            success: true,
            mermaidCode: flowchartCode,
            originalType: "unknown",
            fallbackType: "flowchart",
            warning: "架构图已转换为流程图显示",
        };
    } catch (error) {
        return {
            success: false,
            originalType: "unknown",
            fallbackType: "flowchart",
            error: error instanceof Error ? error.message : "架构图转换失败",
        };
    }
}

// ============= 思维导图降级 =============

/**
 * 将思维导图转换为 flowchart LR 形式
 * 横向流程图可以近似展示思维导图的层级结构
 */
export function generateMindmapFallback(
    centerTopic: string,
    branches: Array<{
        topic: string;
        children?: Array<{ topic: string; children?: Array<{ topic: string }> }>;
    }>
): FallbackResult {
    try {
        let flowchartCode = "flowchart LR\n";

        // 中心节点
        const centerId = "center";
        flowchartCode += `    ${centerId}(("${centerTopic}"))\n`;

        let nodeCounter = 0;

        // 递归生成分支
        function addBranch(
            parentId: string,
            branch: { topic: string; children?: Array<{ topic: string; children?: Array<{ topic: string }> }> },
            level: number
        ) {
            const nodeId = `node_${nodeCounter++}`;
            const shape = level === 1 ? `["${branch.topic}"]` : `("${branch.topic}")`;
            flowchartCode += `    ${nodeId}${shape}\n`;
            flowchartCode += `    ${parentId} --> ${nodeId}\n`;

            if (branch.children) {
                for (const child of branch.children) {
                    addBranch(nodeId, child, level + 1);
                }
            }
        }

        for (const branch of branches) {
            addBranch(centerId, branch, 1);
        }

        return {
            success: true,
            mermaidCode: flowchartCode,
            originalType: "unknown",
            fallbackType: "flowchart LR",
            warning: "思维导图已转换为横向流程图显示",
        };
    } catch (error) {
        return {
            success: false,
            originalType: "unknown",
            fallbackType: "flowchart LR",
            error: error instanceof Error ? error.message : "思维导图转换失败",
        };
    }
}

// ============= 状态图增强 =============

/**
 * 状态图预处理
 * stateDiagram-v2 在某些情况下可能解析失败，提供预处理
 */
export function preprocessStateDiagram(stateCode: string): string {
    // 将 stateDiagram-v2 统一为 stateDiagram-v2
    let processed = stateCode.replace(/stateDiagram\s*$/im, "stateDiagram-v2");

    // 确保状态名称不包含特殊字符
    processed = processed.replace(/\[([^\]]+)\]/g, (_, content) => {
        return `["${content.replace(/"/g, "'")}"]`;
    });

    return processed;
}

// ============= JSON 兜底方案 =============

/**
 * 从 JSON 格式的图表数据生成 Mermaid flowchart
 * 当所有其他方法都失败时的最终兜底
 */
export function generateFlowchartFromJSON(data: {
    nodes: Array<{ id: string; type?: string; label: string; row?: number; column?: number }>;
    edges: Array<{ source: string; target: string; label?: string }>;
}): FallbackResult {
    try {
        let flowchartCode = "flowchart TD\n";

        // 节点类型到形状的映射
        const typeToShape: Record<string, (label: string) => string> = {
            start: (label) => `((${label}))`,
            end: (label) => `((${label}))`,
            process: (label) => `[${label}]`,
            decision: (label) => `{${label}}`,
            data: (label) => `[/${label}/]`,
            entity: (label) => `[${label}]`,
            actor: (label) => `([${label}])`,
            component: (label) => `[${label}]`,
            container: (label) => `[[${label}]]`,
            default: (label) => `[${label}]`,
        };

        // 生成节点
        for (const node of data.nodes) {
            const shapeFunc = typeToShape[node.type || "default"] || typeToShape.default;
            flowchartCode += `    ${node.id}${shapeFunc(node.label)}\n`;
        }

        // 生成连线
        for (const edge of data.edges) {
            if (edge.label) {
                flowchartCode += `    ${edge.source} -->|${edge.label}| ${edge.target}\n`;
            } else {
                flowchartCode += `    ${edge.source} --> ${edge.target}\n`;
            }
        }

        return {
            success: true,
            mermaidCode: flowchartCode,
            originalType: "unknown",
            fallbackType: "flowchart TD",
            warning: "图表已转换为流程图格式显示",
        };
    } catch (error) {
        return {
            success: false,
            originalType: "unknown",
            fallbackType: "flowchart TD",
            error: error instanceof Error ? error.message : "JSON 转换失败",
        };
    }
}

// ============= 通用降级入口 =============

/**
 * 自动检测图表类型并进行降级处理
 */
export function autoFallback(
    code: string,
    type: MermaidDiagramType
): FallbackResult {
    switch (type) {
        case "er":
            return generateERFallback(code);

        case "state":
            // 状态图通常可以直接解析，只需预处理
            return {
                success: true,
                mermaidCode: preprocessStateDiagram(code),
                originalType: "state",
                fallbackType: "stateDiagram-v2",
            };

        default:
            // 其他类型尝试原样返回
            return {
                success: true,
                mermaidCode: code,
                originalType: type,
                fallbackType: type,
            };
    }
}

// ============= 降级提示消息 =============

export const FALLBACK_MESSAGES = {
    er: {
        zh: "ER 图已转换为类图形式显示。如需完整 ER 符号，请查看专业版。",
        en: "ER diagram converted to class diagram format. For full ER notation, view professional version.",
    },
    architecture: {
        zh: "架构图已转换为分组流程图显示。如需专业图标，请查看专业版。",
        en: "Architecture diagram converted to grouped flowchart. For professional icons, view professional version.",
    },
    mindmap: {
        zh: "思维导图已转换为横向流程图显示。如需放射状布局，请查看专业版。",
        en: "Mindmap converted to horizontal flowchart. For radial layout, view professional version.",
    },
    generic: {
        zh: "图表已使用降级方案显示。如需更丰富的样式，请查看专业版。",
        en: "Diagram displayed using fallback format. For richer styles, view professional version.",
    },
} as const;
