/**
 * Prompt 模板系统
 * 用于生成各类图表的 Prompt
 */

import { Language, getCurrentLanguage } from "@/lib/i18n";

export type DiagramType =
    | "flowchart"
    | "architecture"
    | "sequence"
    | "mindmap"
    | "er"
    | "class"
    | "generic";

// 多语言系统提示词
const SYSTEM_PROMPTS: Record<Language, string> = {
    zh: `你是一个专业的图表设计助手。你的任务是根据用户的描述生成图表元素数据。

## 输出格式要求
你必须输出 JSON 格式的图表数据，包含 nodes（节点）和 edges（连线）两个数组。

### 节点格式
\`\`\`json
{
  "nodes": [
    {
      "id": "node_1",
      "type": "process|decision|start|end|data|entity|actor|component|container",
      "label": "节点标签",
      "description": "可选的详细描述",
      "row": 0,
      "column": 0
    }
  ]
}
\`\`\`

### 连线格式
\`\`\`json
{
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2",
      "label": "可选的连线标签"
    }
  ]
}
\`\`\`

## 布局规则
- row 和 column 表示逻辑位置，从 0 开始
- 流程图：从上到下 (row 递增)，分支用不同 column
- 架构图：按层级排列
- 时序图：参与者在同一 row，消息按 row 递增

## 重要
1. 只输出 JSON，不要包含任何解释文字
2. 确保所有 id 唯一
3. 确保连线的 source 和 target 引用存在的节点 id
4. 标签使用简洁的中文
`,

    en: `You are a professional diagram design assistant. Your task is to generate diagram element data based on user descriptions.

## Output Format Requirements
You must output JSON format diagram data containing nodes and edges arrays.

### Node Format
\`\`\`json
{
  "nodes": [
    {
      "id": "node_1",
      "type": "process|decision|start|end|data|entity|actor|component|container",
      "label": "Node Label",
      "description": "Optional detailed description",
      "row": 0,
      "column": 0
    }
  ]
}
\`\`\`

### Edge Format
\`\`\`json
{
  "edges": [
    {
      "id": "edge_1",
      "source": "node_1",
      "target": "node_2",
      "label": "Optional edge label"
    }
  ]
}
\`\`\`

## Layout Rules
- row and column represent logical positions, starting from 0
- Flowcharts: top to bottom (row increases), branches use different columns
- Architecture diagrams: arranged by hierarchy
- Sequence diagrams: participants on same row, messages increase row

## Important
1. Output only JSON, no explanatory text
2. Ensure all ids are unique
3. Ensure edge source and target reference existing node ids
4. Use concise English labels
`,
};

/**
 * 获取当前语言的系统提示词
 */
export function getSystemPrompt(lang?: Language): string {
    const language = lang || getCurrentLanguage();
    return SYSTEM_PROMPTS[language];
}

// 默认系统提示词（向后兼容）
export const SYSTEM_PROMPT = SYSTEM_PROMPTS.zh;

// 图表类型特定的提示
const DIAGRAM_TYPE_PROMPTS: Record<DiagramType, string> = {
    flowchart: `生成流程图。使用以下节点类型：
- start: 开始节点（椭圆形）
- end: 结束节点（椭圆形）
- process: 处理步骤（矩形）
- decision: 判断/分支（菱形）
- data: 数据/文档（平行四边形）`,

    architecture: `生成系统架构图。使用以下节点类型：
- component: 系统组件（矩形）
- container: 容器/分组（大矩形）
- entity: 外部实体（矩形）
- data: 数据存储（圆柱形）`,

    sequence: `生成时序图。使用以下节点类型：
- actor: 参与者/角色
消息用 edges 表示，按时间顺序排列 (row 递增)`,

    mindmap: `生成思维导图。使用以下规则：
- 中心主题放在 row=0, column=0
- 子主题按层级向外扩展
- 使用 process 类型表示节点`,

    er: `生成 ER 图（实体关系图）。使用以下节点类型：
- entity: 实体表
- 在 description 中列出实体的属性
连线表示关系，label 说明关系类型（一对多等）`,

    class: `生成类图。使用以下节点类型：
- entity: 类
- 在 description 中列出类的属性和方法
连线类型说明关系（继承、组合等）`,

    generic: `生成通用图表。根据内容自动选择合适的节点类型和布局。`,
};

/**
 * 生成图表生成的 prompt
 */
export function buildDiagramPrompt(
    userDescription: string,
    diagramType: DiagramType = "generic"
): string {
    const typePrompt = DIAGRAM_TYPE_PROMPTS[diagramType];

    return `${typePrompt}

用户需求：
${userDescription}

请根据以上需求生成图表 JSON 数据。`;
}

/**
 * 生成增量修改的 prompt
 */
export function buildModifyPrompt(
    currentNodes: Array<{ id: string; label: string; type: string }>,
    currentEdges: Array<{ id: string; source: string; target: string; label?: string }>,
    selectedNodeIds: string[],
    modifyRequest: string
): string {
    const selectedNodes = currentNodes.filter((n) => selectedNodeIds.includes(n.id));

    return `当前图表状态：
节点：${JSON.stringify(currentNodes, null, 2)}
连线：${JSON.stringify(currentEdges, null, 2)}

用户选中的节点：${JSON.stringify(selectedNodes, null, 2)}

用户修改请求：${modifyRequest}

请输出修改后的完整图表 JSON（包含 nodes 和 edges）。只修改必要的部分，保持其他内容不变。`;
}

/**
 * 解析 LLM 输出的 JSON
 */
export function parseDiagramJSON(content: string): {
    nodes: Array<{
        id: string;
        type: string;
        label: string;
        description?: string;
        row: number;
        column: number;
    }>;
    edges: Array<{
        id: string;
        source: string;
        target: string;
        label?: string;
    }>;
} | null {
    try {
        // 尝试提取 JSON 块
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

        const data = JSON.parse(jsonStr);

        // 验证数据结构
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            console.error("Invalid diagram JSON structure");
            return null;
        }

        return data;
    } catch (error) {
        console.error("Failed to parse diagram JSON:", error);
        return null;
    }
}
