/**
 * 专业版增强提示词模板
 * 用于 AI 分析图表和生成增强建议
 */

import { EnhancementOptions, ColorScheme } from "@/types/diagram-file";

// ============= 图表分析提示词 =============

/**
 * 图表分析系统提示词
 * 用于分析图表结构，识别可增强的元素
 */
export const ANALYSIS_SYSTEM_PROMPT = `你是一个专业的流程图分析专家。你的任务是分析给定的图表数据，识别其结构特征和可增强的部分。

## 分析维度

1. **参与者/泳道检测**
   - 识别不同的参与者、角色或系统
   - 分析哪些节点属于同一参与者
   - 建议合适的泳道划分

2. **流程结构分析**
   - 识别主流程和分支
   - 检测并行处理的机会
   - 识别循环和异常处理

3. **节点类型优化**
   - 建议更专业的 BPMN/UML 符号
   - 识别需要添加详细信息的节点

4. **连线增强**
   - 识别需要条件标签的分支
   - 建议添加序号的流程

## 输出格式

输出 JSON 格式的分析结果：
\`\`\`json
{
  "swimlanes": [
    {
      "name": "泳道名称",
      "nodeIds": ["node_1", "node_2"],
      "color": "#颜色代码"
    }
  ],
  "parallelBranches": [
    {
      "startNodeId": "分支起点",
      "branches": [["分支1节点"], ["分支2节点"]],
      "endNodeId": "合并点"
    }
  ],
  "nodeEnhancements": [
    {
      "nodeId": "node_1",
      "suggestedType": "BPMN类型",
      "addDetails": ["详细信息1", "详细信息2"]
    }
  ],
  "edgeEnhancements": [
    {
      "edgeId": "edge_1",
      "conditionLabel": "条件文本",
      "sequenceNumber": 1
    }
  ],
  "title": "图表标题建议",
  "legend": ["图例项1", "图例项2"]
}
\`\`\`
`;

/**
 * 构建图表分析用户提示词
 */
export function buildAnalysisPrompt(
    nodes: Array<{ id: string; label: string; type?: string }>,
    edges: Array<{ id: string; source: string; target: string; label?: string }>,
    diagramType?: string
): string {
    return `请分析以下${diagramType || "流程图"}数据，并提供增强建议：

## 节点列表
${JSON.stringify(nodes, null, 2)}

## 连线列表
${JSON.stringify(edges, null, 2)}

请识别：
1. 可能的参与者/泳道划分
2. 并行处理的机会
3. 节点类型优化建议
4. 连线标签建议
5. 合适的标题

只输出 JSON 分析结果，不要添加解释。`;
}

// ============= 分析结果类型 =============

/**
 * 泳道信息
 */
export interface SwimlaneInfo {
    name: string;
    nodeIds: string[];
    color?: string;
}

/**
 * 并行分支信息
 */
export interface ParallelBranchInfo {
    startNodeId: string;
    branches: string[][];
    endNodeId: string;
}

/**
 * 节点增强建议
 */
export interface NodeEnhancement {
    nodeId: string;
    suggestedType?: string;
    addDetails?: string[];
}

/**
 * 连线增强建议
 */
export interface EdgeEnhancement {
    edgeId: string;
    conditionLabel?: string;
    sequenceNumber?: number;
}

/**
 * 完整分析结果
 */
export interface AnalysisResult {
    swimlanes: SwimlaneInfo[];
    parallelBranches: ParallelBranchInfo[];
    nodeEnhancements: NodeEnhancement[];
    edgeEnhancements: EdgeEnhancement[];
    title?: string;
    legend?: string[];
}

// ============= 颜色方案 =============

/**
 * 专业颜色方案
 */
export const COLOR_SCHEMES: Record<ColorScheme, {
    swimlaneColors: string[];
    nodeColors: Record<string, { fill: string; stroke: string }>;
    edgeColor: string;
    titleColor: string;
    legendBg: string;
}> = {
    professional: {
        swimlaneColors: ["#E3F2FD", "#FFF3E0", "#E8F5E9", "#FCE4EC", "#F3E5F5"],
        nodeColors: {
            start: { fill: "#C8E6C9", stroke: "#4CAF50" },
            end: { fill: "#FFCDD2", stroke: "#F44336" },
            process: { fill: "#BBDEFB", stroke: "#2196F3" },
            decision: { fill: "#FFF9C4", stroke: "#FFC107" },
            data: { fill: "#E1BEE7", stroke: "#9C27B0" },
            task: { fill: "#BBDEFB", stroke: "#2196F3" },
            gateway: { fill: "#FFF9C4", stroke: "#FFC107" },
            event: { fill: "#C8E6C9", stroke: "#4CAF50" },
        },
        edgeColor: "#616161",
        titleColor: "#212121",
        legendBg: "#FAFAFA",
    },
    modern: {
        swimlaneColors: ["#EDE7F6", "#E0F7FA", "#FFF8E1", "#FFEBEE", "#E8F5E9"],
        nodeColors: {
            start: { fill: "#B2DFDB", stroke: "#00897B" },
            end: { fill: "#FFAB91", stroke: "#E64A19" },
            process: { fill: "#B3E5FC", stroke: "#0288D1" },
            decision: { fill: "#FFE082", stroke: "#FFA000" },
            data: { fill: "#CE93D8", stroke: "#7B1FA2" },
            task: { fill: "#B3E5FC", stroke: "#0288D1" },
            gateway: { fill: "#FFE082", stroke: "#FFA000" },
            event: { fill: "#B2DFDB", stroke: "#00897B" },
        },
        edgeColor: "#455A64",
        titleColor: "#263238",
        legendBg: "#ECEFF1",
    },
    minimal: {
        swimlaneColors: ["#F5F5F5", "#EEEEEE", "#E0E0E0", "#FAFAFA", "#F5F5F5"],
        nodeColors: {
            start: { fill: "#FFFFFF", stroke: "#9E9E9E" },
            end: { fill: "#FFFFFF", stroke: "#9E9E9E" },
            process: { fill: "#FFFFFF", stroke: "#9E9E9E" },
            decision: { fill: "#FFFFFF", stroke: "#9E9E9E" },
            data: { fill: "#FFFFFF", stroke: "#9E9E9E" },
            task: { fill: "#FFFFFF", stroke: "#9E9E9E" },
            gateway: { fill: "#FFFFFF", stroke: "#9E9E9E" },
            event: { fill: "#FFFFFF", stroke: "#9E9E9E" },
        },
        edgeColor: "#757575",
        titleColor: "#424242",
        legendBg: "#FAFAFA",
    },
};

// ============= 智能默认配置 =============

/**
 * 根据图表特征智能推荐增强选项
 */
export function suggestEnhancementOptions(
    nodeCount: number,
    edgeCount: number,
    hasDecisions: boolean,
    diagramType?: string
): Partial<EnhancementOptions> {
    const suggestions: Partial<EnhancementOptions> = {
        level: "standard",
        structure: {
            addSwimlanes: nodeCount >= 5, // 5个以上节点建议泳道
            addParallelBranches: false,
        },
        nodes: {
            useProfessionalSymbols: true,
            addDetails: nodeCount <= 10, // 10个以下节点可添加详情
        },
        edges: {
            addConditionLabels: hasDecisions, // 有判断节点时添加条件标签
            addSequenceNumbers: edgeCount >= 5, // 5条以上连线添加序号
        },
        style: {
            colorScheme: "professional",
            addLegend: nodeCount >= 8, // 8个以上节点添加图例
            addTitle: true,
        },
    };

    // 根据图表类型调整
    if (diagramType === "er") {
        suggestions.structure!.addSwimlanes = false;
        suggestions.nodes!.useProfessionalSymbols = true;
        suggestions.nodes!.addDetails = true;
    } else if (diagramType === "sequence") {
        suggestions.structure!.addSwimlanes = true;
        suggestions.edges!.addSequenceNumbers = true;
    }

    return suggestions;
}

// ============= 解析分析结果 =============

/**
 * 解析 AI 返回的分析结果
 */
export function parseAnalysisResult(content: string): AnalysisResult | null {
    try {
        // 尝试提取 JSON 块
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

        const data = JSON.parse(jsonStr);

        // 验证必需字段
        return {
            swimlanes: data.swimlanes || [],
            parallelBranches: data.parallelBranches || [],
            nodeEnhancements: data.nodeEnhancements || [],
            edgeEnhancements: data.edgeEnhancements || [],
            title: data.title,
            legend: data.legend,
        };
    } catch (error) {
        console.error("Failed to parse analysis result:", error);
        return null;
    }
}
