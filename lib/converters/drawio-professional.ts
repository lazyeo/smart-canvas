/**
 * 专业版 Draw.io XML 生成器
 * 支持泳道、BPMN 符号、图例、标题等专业特性
 */

import { EnhancementOptions, ColorScheme } from "@/types/diagram-file";
import {
    SwimlaneInfo,
    NodeEnhancement,
    EdgeEnhancement,
    AnalysisResult,
    COLOR_SCHEMES,
} from "@/lib/ai/enhancement-prompts";

// ============= 类型定义 =============

interface ProfessionalNode {
    id: string;
    type: string;
    label: string;
    row: number;
    column: number;
    x?: number;
    y?: number;
    details?: string[];
    swimlane?: string;
}

interface ProfessionalEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    conditionLabel?: string;
    sequenceNumber?: number;
}

interface ProfessionalDiagramData {
    nodes: ProfessionalNode[];
    edges: ProfessionalEdge[];
    title?: string;
    legend?: string[];
    swimlanes?: SwimlaneInfo[];
}

// ============= BPMN 符号映射 =============

/**
 * BPMN 符号样式映射
 */
const BPMN_SHAPES: Record<string, string> = {
    // 事件
    startEvent: "shape=mxgraph.bpmn.shape;perimeter=ellipsePerimeter;symbol=general;",
    endEvent: "shape=mxgraph.bpmn.shape;perimeter=ellipsePerimeter;symbol=terminate;outline=end;",
    intermediateEvent: "shape=mxgraph.bpmn.shape;perimeter=ellipsePerimeter;symbol=general;outline=throwing;",
    timerEvent: "shape=mxgraph.bpmn.shape;perimeter=ellipsePerimeter;symbol=timer;",
    messageEvent: "shape=mxgraph.bpmn.shape;perimeter=ellipsePerimeter;symbol=message;",

    // 网关
    exclusiveGateway: "shape=mxgraph.bpmn.shape;perimeter=rhombusPerimeter;symbol=exclusiveGw;",
    parallelGateway: "shape=mxgraph.bpmn.shape;perimeter=rhombusPerimeter;symbol=parallelGw;",
    inclusiveGateway: "shape=mxgraph.bpmn.shape;perimeter=rhombusPerimeter;symbol=inclusiveGw;",

    // 任务
    task: "shape=mxgraph.bpmn.shape;symbol=general;",
    userTask: "shape=mxgraph.bpmn.shape;symbol=general;verticalLabelPosition=bottom;",
    serviceTask: "shape=mxgraph.bpmn.shape;symbol=general;",
    scriptTask: "shape=mxgraph.bpmn.shape;symbol=general;",

    // 数据
    dataObject: "shape=mxgraph.bpmn.data_object;",
    dataStore: "shape=mxgraph.bpmn.data_store;",

    // 子流程
    subprocess: "shape=mxgraph.bpmn.shape;symbol=general;html=1;rounded=1;",
};

/**
 * 简单类型到 BPMN 类型的映射
 */
const TYPE_TO_BPMN: Record<string, string> = {
    start: "startEvent",
    end: "endEvent",
    process: "task",
    decision: "exclusiveGateway",
    data: "dataObject",
    database: "dataStore",
    parallel: "parallelGateway",
    timer: "timerEvent",
    message: "messageEvent",
    user: "userTask",
    service: "serviceTask",
};

// ============= 布局配置 =============

const PROFESSIONAL_LAYOUT = {
    // 泳道配置
    swimlaneWidth: 800,
    swimlaneHeaderWidth: 100,
    swimlaneMinHeight: 200,
    swimlaneSpacing: 20,

    // 节点配置
    nodeWidth: 100,
    nodeHeight: 60,
    eventSize: 40,
    gatewaySize: 50,
    horizontalSpacing: 150,
    verticalSpacing: 100,

    // 页面配置
    startX: 150,
    startY: 120,
    titleHeight: 60,
    legendWidth: 200,
    legendItemHeight: 30,

    // 边距
    marginX: 50,
    marginY: 50,
};

// ============= 工具函数 =============

/**
 * XML 转义
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * 获取颜色方案
 */
function getColorScheme(scheme: ColorScheme) {
    return COLOR_SCHEMES[scheme] || COLOR_SCHEMES.professional;
}

/**
 * 获取节点颜色
 */
function getNodeColors(nodeType: string, scheme: ColorScheme): { fill: string; stroke: string } {
    const colors = getColorScheme(scheme);
    const bpmnType = TYPE_TO_BPMN[nodeType] || nodeType;

    // 根据 BPMN 类型映射颜色
    if (bpmnType.includes("Event")) {
        if (bpmnType === "startEvent") return colors.nodeColors.start;
        if (bpmnType === "endEvent") return colors.nodeColors.end;
        return colors.nodeColors.event;
    }
    if (bpmnType.includes("Gateway")) return colors.nodeColors.gateway;
    if (bpmnType.includes("Task")) return colors.nodeColors.task;
    if (bpmnType.includes("data")) return colors.nodeColors.data;

    return colors.nodeColors[nodeType] || colors.nodeColors.process;
}

// ============= 生成器函数 =============

/**
 * 生成标题元素
 */
function generateTitle(title: string, scheme: ColorScheme, cellId: number): { xml: string; nextId: number } {
    const colors = getColorScheme(scheme);
    const xml = `<mxCell id="${cellId}" value="${escapeXml(title)}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;whiteSpace=wrap;rounded=0;fontSize=20;fontStyle=1;fontColor=${colors.titleColor};" vertex="1" parent="1">
        <mxGeometry x="${PROFESSIONAL_LAYOUT.marginX}" y="${PROFESSIONAL_LAYOUT.marginY}" width="${PROFESSIONAL_LAYOUT.swimlaneWidth}" height="${PROFESSIONAL_LAYOUT.titleHeight}" as="geometry" />
      </mxCell>`;

    return { xml, nextId: cellId + 1 };
}

/**
 * 生成泳道
 */
function generateSwimlanes(
    swimlanes: SwimlaneInfo[],
    scheme: ColorScheme,
    startCellId: number,
    startY: number
): { xml: string; swimlaneIdMap: Map<string, number>; nextId: number; totalHeight: number } {
    const colors = getColorScheme(scheme);
    const cells: string[] = [];
    const swimlaneIdMap = new Map<string, number>();
    let cellId = startCellId;
    let currentY = startY;

    for (let i = 0; i < swimlanes.length; i++) {
        const swimlane = swimlanes[i];
        const swimlaneId = cellId++;
        swimlaneIdMap.set(swimlane.name, swimlaneId);

        const fillColor = swimlane.color || colors.swimlaneColors[i % colors.swimlaneColors.length];
        const height = Math.max(PROFESSIONAL_LAYOUT.swimlaneMinHeight, swimlane.nodeIds.length * 80 + 40);

        cells.push(
            `<mxCell id="${swimlaneId}" value="${escapeXml(swimlane.name)}" style="swimlane;horizontal=0;whiteSpace=wrap;html=1;startSize=${PROFESSIONAL_LAYOUT.swimlaneHeaderWidth};fillColor=${fillColor};" vertex="1" parent="1">
        <mxGeometry x="${PROFESSIONAL_LAYOUT.marginX}" y="${currentY}" width="${PROFESSIONAL_LAYOUT.swimlaneWidth}" height="${height}" as="geometry" />
      </mxCell>`
        );

        currentY += height + PROFESSIONAL_LAYOUT.swimlaneSpacing;
    }

    return {
        xml: cells.join("\n        "),
        swimlaneIdMap,
        nextId: cellId,
        totalHeight: currentY - startY,
    };
}

/**
 * 生成专业版节点
 */
function generateProfessionalNodes(
    nodes: ProfessionalNode[],
    options: EnhancementOptions,
    swimlaneIdMap: Map<string, number>,
    startCellId: number
): { xml: string; nodeIdMap: Map<string, number>; nextId: number } {
    const cells: string[] = [];
    const nodeIdMap = new Map<string, number>();
    let cellId = startCellId;
    const scheme = options.style.colorScheme;

    for (const node of nodes) {
        const id = cellId++;
        nodeIdMap.set(node.id, id);

        // 确定父元素（泳道或根）
        const parentId = node.swimlane && swimlaneIdMap.has(node.swimlane)
            ? swimlaneIdMap.get(node.swimlane)!
            : 1;

        // 获取 BPMN 类型和样式
        const bpmnType = options.nodes.useProfessionalSymbols
            ? (TYPE_TO_BPMN[node.type] || "task")
            : node.type;

        const colors = getNodeColors(node.type, scheme);

        // 确定形状和尺寸
        let style: string;
        let width = PROFESSIONAL_LAYOUT.nodeWidth;
        let height = PROFESSIONAL_LAYOUT.nodeHeight;

        if (options.nodes.useProfessionalSymbols && BPMN_SHAPES[bpmnType]) {
            style = `${BPMN_SHAPES[bpmnType]}fillColor=${colors.fill};strokeColor=${colors.stroke};`;

            // 事件使用圆形
            if (bpmnType.includes("Event")) {
                width = height = PROFESSIONAL_LAYOUT.eventSize;
            }
            // 网关使用菱形
            if (bpmnType.includes("Gateway")) {
                width = height = PROFESSIONAL_LAYOUT.gatewaySize;
            }
        } else {
            // 使用标准形状
            let shape = "rounded=1";
            if (node.type === "decision") shape = "rhombus";
            if (node.type === "start" || node.type === "end") shape = "ellipse";
            if (node.type === "data") shape = "shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1";

            style = `${shape};whiteSpace=wrap;html=1;fillColor=${colors.fill};strokeColor=${colors.stroke};`;
        }

        // 计算位置
        const x = node.x ?? (PROFESSIONAL_LAYOUT.swimlaneHeaderWidth + 30 + node.column * PROFESSIONAL_LAYOUT.horizontalSpacing);
        const y = node.y ?? (20 + node.row * PROFESSIONAL_LAYOUT.verticalSpacing);

        // 构建标签（可能包含详情）
        let label = node.label;
        if (options.nodes.addDetails && node.details && node.details.length > 0) {
            label = `<b>${escapeXml(node.label)}</b><br/><hr/><small>${node.details.map(d => escapeXml(d)).join("<br/>")}</small>`;
            height = Math.max(height, 80 + node.details.length * 15);
        } else {
            label = escapeXml(node.label);
        }

        cells.push(
            `<mxCell id="${id}" value="${label}" style="${style}" vertex="1" parent="${parentId}">
        <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />
      </mxCell>`
        );
    }

    return { xml: cells.join("\n        "), nodeIdMap, nextId: cellId };
}

/**
 * 生成专业版连线
 */
function generateProfessionalEdges(
    edges: ProfessionalEdge[],
    options: EnhancementOptions,
    nodeIdMap: Map<string, number>,
    startCellId: number,
    scheme: ColorScheme
): { xml: string; nextId: number } {
    const cells: string[] = [];
    const colors = getColorScheme(scheme);
    let cellId = startCellId;

    for (const edge of edges) {
        const id = cellId++;
        const sourceId = nodeIdMap.get(edge.source);
        const targetId = nodeIdMap.get(edge.target);

        if (sourceId === undefined || targetId === undefined) continue;

        // 构建标签
        let label = "";
        if (options.edges.addSequenceNumbers && edge.sequenceNumber) {
            label += `<b>${edge.sequenceNumber}.</b> `;
        }
        if (options.edges.addConditionLabels && edge.conditionLabel) {
            label += edge.conditionLabel;
        } else if (edge.label) {
            label += edge.label;
        }

        const valueAttr = label ? `value="${escapeXml(label)}"` : "";
        const style = `edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=${colors.edgeColor};strokeWidth=1.5;`;

        cells.push(
            `<mxCell id="${id}" ${valueAttr} style="${style}" edge="1" parent="1" source="${sourceId}" target="${targetId}">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`
        );
    }

    return { xml: cells.join("\n        "), nextId: cellId };
}

/**
 * 生成图例
 */
function generateLegend(
    legend: string[],
    scheme: ColorScheme,
    startCellId: number,
    x: number,
    y: number
): { xml: string; nextId: number } {
    if (legend.length === 0) return { xml: "", nextId: startCellId };

    const colors = getColorScheme(scheme);
    const cells: string[] = [];
    let cellId = startCellId;

    const legendHeight = 40 + legend.length * PROFESSIONAL_LAYOUT.legendItemHeight;

    // 图例容器
    cells.push(
        `<mxCell id="${cellId++}" value="<b>图例</b>" style="swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=30;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;fillColor=${colors.legendBg};strokeColor=#9E9E9E;" vertex="1" parent="1">
        <mxGeometry x="${x}" y="${y}" width="${PROFESSIONAL_LAYOUT.legendWidth}" height="${legendHeight}" as="geometry" />
      </mxCell>`
    );

    const containerId = cellId - 1;

    // 图例项
    for (let i = 0; i < legend.length; i++) {
        cells.push(
            `<mxCell id="${cellId++}" value="${escapeXml(legend[i])}" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=10;spacingRight=4;overflow=hidden;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;rotatable=0;" vertex="1" parent="${containerId}">
        <mxGeometry y="${30 + i * PROFESSIONAL_LAYOUT.legendItemHeight}" width="${PROFESSIONAL_LAYOUT.legendWidth}" height="${PROFESSIONAL_LAYOUT.legendItemHeight}" as="geometry" />
      </mxCell>`
        );
    }

    return { xml: cells.join("\n        "), nextId: cellId };
}

// ============= 主生成函数 =============

/**
 * 生成专业版 Draw.io XML
 */
export function generateProfessionalDrawioXml(
    data: ProfessionalDiagramData,
    options: EnhancementOptions,
    analysisResult?: AnalysisResult
): string {
    const cells: string[] = [];
    let cellId = 2;
    let currentY = PROFESSIONAL_LAYOUT.marginY;
    const scheme = options.style.colorScheme;

    // 1. 生成标题
    if (options.style.addTitle && data.title) {
        const titleResult = generateTitle(data.title, scheme, cellId);
        cells.push(titleResult.xml);
        cellId = titleResult.nextId;
        currentY += PROFESSIONAL_LAYOUT.titleHeight + 20;
    }

    // 2. 处理泳道
    let swimlaneIdMap = new Map<string, number>();
    const swimlanes = data.swimlanes || analysisResult?.swimlanes || [];

    if (options.structure.addSwimlanes && swimlanes.length > 0) {
        // 将节点分配到泳道
        const nodeToSwimlane = new Map<string, string>();
        for (const swimlane of swimlanes) {
            for (const nodeId of swimlane.nodeIds) {
                nodeToSwimlane.set(nodeId, swimlane.name);
            }
        }

        // 更新节点的泳道信息
        for (const node of data.nodes) {
            if (nodeToSwimlane.has(node.id)) {
                node.swimlane = nodeToSwimlane.get(node.id);
            }
        }

        const swimlaneResult = generateSwimlanes(swimlanes, scheme, cellId, currentY);
        cells.push(swimlaneResult.xml);
        cellId = swimlaneResult.nextId;
        swimlaneIdMap = swimlaneResult.swimlaneIdMap;
        currentY += swimlaneResult.totalHeight;
    }

    // 3. 应用节点增强
    const enhancedNodes = data.nodes.map(node => {
        const enhancement = analysisResult?.nodeEnhancements.find(e => e.nodeId === node.id);
        return {
            ...node,
            type: enhancement?.suggestedType || node.type,
            details: enhancement?.addDetails || node.details,
        };
    });

    // 4. 生成节点
    const nodesResult = generateProfessionalNodes(enhancedNodes, options, swimlaneIdMap, cellId);
    cells.push(nodesResult.xml);
    cellId = nodesResult.nextId;

    // 5. 应用连线增强
    const enhancedEdges: ProfessionalEdge[] = data.edges.map((edge, index) => {
        const enhancement = analysisResult?.edgeEnhancements.find(e => e.edgeId === edge.id);
        return {
            ...edge,
            conditionLabel: enhancement?.conditionLabel || edge.conditionLabel,
            sequenceNumber: options.edges.addSequenceNumbers
                ? (enhancement?.sequenceNumber || index + 1)
                : undefined,
        };
    });

    // 6. 生成连线
    const edgesResult = generateProfessionalEdges(enhancedEdges, options, nodesResult.nodeIdMap, cellId, scheme);
    cells.push(edgesResult.xml);
    cellId = edgesResult.nextId;

    // 7. 生成图例
    const legend = data.legend || analysisResult?.legend || [];
    if (options.style.addLegend && legend.length > 0) {
        const legendResult = generateLegend(
            legend,
            scheme,
            cellId,
            PROFESSIONAL_LAYOUT.marginX + PROFESSIONAL_LAYOUT.swimlaneWidth + 50,
            PROFESSIONAL_LAYOUT.marginY
        );
        cells.push(legendResult.xml);
        cellId = legendResult.nextId;
    }

    // 组装完整 XML
    const pageWidth = PROFESSIONAL_LAYOUT.swimlaneWidth + (legend.length > 0 ? PROFESSIONAL_LAYOUT.legendWidth + 100 : 0) + PROFESSIONAL_LAYOUT.marginX * 2;
    const pageHeight = currentY + 200;

    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="SmartCanvas AI Professional" modified="${new Date().toISOString()}" agent="SmartCanvas AI" version="1.0" type="professional">
  <diagram name="Professional View" id="professional-diagram">
    <mxGraphModel dx="1000" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="1">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/**
 * 从 Excalidraw 元素生成专业版数据
 */
export function excalidrawToProfessionalData(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[],
    analysisResult?: AnalysisResult
): ProfessionalDiagramData {
    const nodes: ProfessionalNode[] = [];
    const edges: ProfessionalEdge[] = [];

    // 提取节点（形状元素）
    const shapeElements = elements.filter(el =>
        !el.isDeleted &&
        (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond")
    );

    // 提取连线（箭头元素）
    const arrowElements = elements.filter(el =>
        !el.isDeleted && el.type === "arrow"
    );

    // 提取文本元素，用于获取标签
    const textElements = elements.filter(el =>
        !el.isDeleted && el.type === "text"
    );

    // 映射形状到节点
    for (const shape of shapeElements) {
        // 查找绑定的文本（通过 containerId 或位置）
        let label = "";
        const boundText = textElements.find(t => t.containerId === shape.id);
        if (boundText) {
            label = boundText.text || "";
        } else {
            // 通过位置查找重叠的文本
            const overlapping = textElements.find(t =>
                t.x >= shape.x && t.x <= shape.x + (shape.width || 100) &&
                t.y >= shape.y && t.y <= shape.y + (shape.height || 60)
            );
            if (overlapping) label = overlapping.text || "";
        }

        // 确定节点类型
        let type = "process";
        if (shape.type === "ellipse") type = "start";
        if (shape.type === "diamond") type = "decision";

        nodes.push({
            id: shape.id,
            type,
            label: label || "未命名",
            row: Math.floor((shape.y || 0) / 100),
            column: Math.floor((shape.x || 0) / 150),
            x: shape.x,
            y: shape.y,
        });
    }

    // 映射箭头到连线
    for (const arrow of arrowElements) {
        const sourceId = arrow.startBinding?.elementId;
        const targetId = arrow.endBinding?.elementId;

        if (sourceId && targetId) {
            // 查找箭头上的文本标签
            let label = "";
            const boundText = textElements.find(t => t.containerId === arrow.id);
            if (boundText) label = boundText.text || "";

            edges.push({
                id: arrow.id,
                source: sourceId,
                target: targetId,
                label,
            });
        }
    }

    return {
        nodes,
        edges,
        title: analysisResult?.title || "流程图",
        legend: analysisResult?.legend,
        swimlanes: analysisResult?.swimlanes,
    };
}
