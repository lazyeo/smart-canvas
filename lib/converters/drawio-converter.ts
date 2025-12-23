/**
 * Draw.io XML 转换器
 * DiagramData → Draw.io mxGraph XML 格式
 */

interface DiagramNode {
    id: string;
    type: string;
    label: string;
    row: number;
    column: number;
}

interface DiagramEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
}

interface DiagramData {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
}

/**
 * 节点类型到 Draw.io 形状的映射
 */
const SHAPE_MAPPING: Record<string, string> = {
    start: "ellipse",
    end: "ellipse",
    process: "rounded=1",
    decision: "rhombus",
    data: "parallelogram",
    document: "document",
    database: "shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15",
    default: "rounded=1",
};

/**
 * 布局配置
 */
const LAYOUT = {
    nodeWidth: 120,
    nodeHeight: 60,
    horizontalSpacing: 160,
    verticalSpacing: 100,
    startX: 100,
    startY: 60,
};

/**
 * 生成 Draw.io XML
 */
export function generateDrawioXml(data: DiagramData): string {
    const cells: string[] = [];
    let cellId = 2; // 0 和 1 是 root 和 parent

    // 节点 ID 映射
    const nodeIdMap = new Map<string, number>();

    // 生成节点
    for (const node of data.nodes) {
        const id = cellId++;
        nodeIdMap.set(node.id, id);

        const x = LAYOUT.startX + node.column * LAYOUT.horizontalSpacing;
        const y = LAYOUT.startY + node.row * LAYOUT.verticalSpacing;
        const shape = SHAPE_MAPPING[node.type] || SHAPE_MAPPING.default;

        // 根据类型设置样式
        let style = `${shape};whiteSpace=wrap;html=1;`;

        if (node.type === "start" || node.type === "end") {
            style = "ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;";
        } else if (node.type === "decision") {
            style = "rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;";
        } else if (node.type === "process") {
            style = "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;";
        } else if (node.type === "data") {
            style = "shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;fillColor=#e1d5e7;strokeColor=#9673a6;";
        }

        cells.push(
            `<mxCell id="${id}" value="${escapeXml(node.label)}" style="${style}" vertex="1" parent="1">
        <mxGeometry x="${x}" y="${y}" width="${LAYOUT.nodeWidth}" height="${LAYOUT.nodeHeight}" as="geometry" />
      </mxCell>`
        );
    }

    // 生成连线
    for (const edge of data.edges) {
        const id = cellId++;
        const sourceId = nodeIdMap.get(edge.source);
        const targetId = nodeIdMap.get(edge.target);

        if (sourceId !== undefined && targetId !== undefined) {
            const label = edge.label ? `value="${escapeXml(edge.label)}"` : "";
            cells.push(
                `<mxCell id="${id}" ${label} style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;" edge="1" parent="1" source="${sourceId}" target="${targetId}">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>`
            );
        }
    }

    // 组装完整 XML
    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="SmartCanvas AI" modified="${new Date().toISOString()}" agent="SmartCanvas AI" version="1.0">
  <diagram name="Page-1" id="diagram-1">
    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">
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
 * 生成空白画布 XML
 */
export function generateEmptyDrawioXml(): string {
    return generateDrawioXml({ nodes: [], edges: [] });
}
