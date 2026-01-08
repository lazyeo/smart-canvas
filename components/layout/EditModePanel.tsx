"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useCanvas } from "@/contexts";
import {
    IncrementalEditService,
    createIncrementalEditService,
    IncrementalEditRequest,
    IncrementalEditResult,
    SelectionContext,
    generateExcalidrawElements,
} from "@/lib/ai";
import { useTranslation } from "@/lib/i18n";
import { ShadowNode, ShadowEdge } from "@/types";
import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";

interface EditMessage {
    id: string;
    role: "user" | "ai";
    content: string;
    status?: "pending" | "streaming" | "success" | "error";
    result?: IncrementalEditResult;
    isResultExpanded?: boolean;
}

interface EditModePanelProps {
    isVisible: boolean;
    onClose: () => void;
}

/**
 * 从 Excalidraw 元素的 customData 中提取节点信息
 */
function extractNodesFromElements(
    elementIds: string[],
    elements: readonly ExcalidrawElement[]
): { nodes: ShadowNode[]; nodeLabels: string[] } {
    const nodes: ShadowNode[] = [];
    const nodeLabels: string[] = [];
    const seenNodeIds = new Set<string>();

    for (const element of elements) {
        if (!elementIds.includes(element.id)) continue;
        if (element.isDeleted) continue;

        const customData = element.customData;

        // 检查是否有节点信息
        if (customData && customData.nodeId && !seenNodeIds.has(customData.nodeId as string)) {
            seenNodeIds.add(customData.nodeId as string);

            const label = (customData.label as string) || "未命名节点";
            nodeLabels.push(label);

            nodes.push({
                id: customData.nodeId as string,
                type: "process",
                label: label,
                elementIds: [element.id],
                logicalPosition: { row: 0, column: 0 },
                position: {
                    x: element.x,
                    y: element.y,
                    width: element.width || 150,
                    height: element.height || 60,
                },
                properties: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }

        // 如果没有 customData，检查是否是形状或文本
        if (!customData && (element.type === "rectangle" || element.type === "ellipse" || element.type === "diamond")) {
            nodeLabels.push(`[${element.type}]`);
        }

        // 文本元素
        if (element.type === "text" && element.text) {
            if (!nodeLabels.includes(element.text as string)) {
                nodeLabels.push(element.text as string);
            }
        }
    }

    return { nodes, nodeLabels };
}

/**
 * 创建简化的选中上下文
 */
function createSimpleContext(
    elementIds: string[],
    elements: readonly ExcalidrawElement[]
): SelectionContext {
    const { nodes, nodeLabels } = extractNodesFromElements(elementIds, elements);

    // 计算选中区域边界
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const selectedElements = elements.filter((el) => elementIds.includes(el.id) && !el.isDeleted);

    for (const el of selectedElements) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + (el.width || 0));
        maxY = Math.max(maxY, el.y + (el.height || 0));
    }

    const bounds = selectedElements.length > 0
        ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
        : null;

    // 生成描述
    const description = nodeLabels.length > 0
        ? `选中的元素 (${nodeLabels.length}个): ${nodeLabels.join(", ")}`
        : `选中了 ${elementIds.length} 个元素`;

    return {
        elementIds,
        nodes,
        relatedEdges: [],
        modules: [],
        bounds,
        description,
        timestamp: Date.now(),
    };
}

export function EditModePanel({ isVisible, onClose }: EditModePanelProps) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<EditMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [estimatedTokens, setEstimatedTokens] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { updateScene, getElements, selectedElementIds } = useCanvas();
    const { t } = useTranslation();

    // 服务实例
    const editServiceRef = useRef<IncrementalEditService | null>(null);

    // 初始化服务
    useEffect(() => {
        if (!editServiceRef.current) {
            editServiceRef.current = createIncrementalEditService();
        }
    }, []);

    // 当前选中上下文
    const currentContext = useMemo(() => {
        if (selectedElementIds.length === 0) {
            return null;
        }
        const elements = getElements();
        return createSimpleContext(selectedElementIds, elements);
    }, [selectedElementIds, getElements]);

    // 提取选中节点标签
    const selectedLabels = useMemo(() => {
        if (!currentContext) return [];
        const { nodeLabels } = extractNodesFromElements(
            currentContext.elementIds,
            getElements()
        );
        return nodeLabels;
    }, [currentContext, getElements]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const toggleResult = useCallback((msgId: string) => {
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === msgId
                    ? { ...msg, isResultExpanded: !msg.isResultExpanded }
                    : msg
            )
        );
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() === "" || isLoading) {
            return;
        }

        // 获取最新的选中上下文
        const elements = getElements();
        const context = selectedElementIds.length > 0
            ? createSimpleContext(selectedElementIds, elements)
            : null;

        if (!context || context.elementIds.length === 0) {
            setMessages((prev) => [
                ...prev,
                {
                    id: `edit-msg-${Date.now()}`,
                    role: "ai",
                    content: t("editMode.noSelection"),
                    status: "error",
                },
            ]);
            return;
        }

        const userMessage = input.trim();
        setInput("");

        // 添加用户消息
        const userMsgId = `edit-msg-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            { id: userMsgId, role: "user", content: userMessage },
        ]);

        // 添加 AI 消息占位
        const aiMsgId = `edit-msg-${Date.now() + 1}`;
        setMessages((prev) => [
            ...prev,
            { id: aiMsgId, role: "ai", content: t("editMode.analyzing"), status: "streaming" },
        ]);
        setIsLoading(true);
        setEstimatedTokens(0);

        // 增强上下文描述
        const enhancedContext: SelectionContext = {
            ...context,
            description: `${context.description}\n\n选中元素的位置信息：\n${context.bounds
                ? `x: ${Math.round(context.bounds.x)}, y: ${Math.round(context.bounds.y)}, 宽: ${Math.round(context.bounds.width)}, 高: ${Math.round(context.bounds.height)}`
                : "无"
                }`,
        };

        // 构建编辑请求
        const request: IncrementalEditRequest = {
            instruction: userMessage,
            context: enhancedContext,
        };

        // 执行增量编辑
        if (editServiceRef.current) {
            const result = await editServiceRef.current.edit(request, (tokens) => {
                setEstimatedTokens(tokens);
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMsgId
                            ? { ...msg, content: `正在分析... (~${tokens} tokens)` }
                            : msg
                    )
                );
            });

            if (result.success) {
                // 应用变更到画布
                applyChanges(result, context);

                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMsgId
                            ? {
                                ...msg,
                                content: result.explanation,
                                status: "success",
                                result,
                                isResultExpanded: false,
                            }
                            : msg
                    )
                );
            } else {
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMsgId
                            ? {
                                ...msg,
                                content: result.error || "操作失败",
                                status: "error",
                            }
                            : msg
                    )
                );
            }
        }

        setIsLoading(false);
        setTimeout(scrollToBottom, 100);
    };

    const applyChanges = (result: IncrementalEditResult, context: SelectionContext) => {
        const currentElements = getElements();
        let newElements = [...currentElements];

        // 计算新节点的位置（基于选中区域）
        const baseX = context.bounds?.x ?? 100;
        const baseY = context.bounds?.y ?? 100;
        const offsetX = (context.bounds?.width ?? 150) + 100;

        // 构建元素位置映射
        const elementPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
        for (const el of currentElements) {
            if (!el.isDeleted && (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond")) {
                elementPositions.set(el.id, {
                    x: el.x,
                    y: el.y,
                    width: el.width || 150,
                    height: el.height || 60,
                });
            }
        }

        // 处理新增节点
        if (result.nodesToAdd.length > 0) {
            const diagramData = {
                nodes: result.nodesToAdd.map((n, idx) => ({
                    id: n.id || `node-${Date.now()}-${idx}`,
                    type: n.type || "process",
                    label: n.label || "新节点",
                    row: 0,
                    column: idx,
                })),
                edges: [],
            };

            const { elements } = generateExcalidrawElements(diagramData);

            // 调整位置到选中区域附近
            const adjustedElements = elements.map((el) => ({
                ...el,
                x: el.x + baseX + offsetX,
                y: el.y + baseY,
            }));

            newElements = [...newElements, ...adjustedElements];

            // 更新位置映射
            for (const el of adjustedElements) {
                if (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond") {
                    elementPositions.set(el.id, {
                        x: el.x,
                        y: el.y,
                        width: el.width || 150,
                        height: el.height || 60,
                    });
                }
            }
        }

        // 处理节点更新（修改标签等）
        if (result.nodesToUpdate.length > 0) {
            for (const update of result.nodesToUpdate) {
                // 找到选中元素中的文本并更新
                if (update.changes.label) {
                    // 直接在选中元素中找文本元素
                    for (let i = 0; i < newElements.length; i++) {
                        const el = newElements[i];
                        if (el.type === "text" && context.elementIds.includes(el.id)) {
                            newElements[i] = {
                                ...el,
                                text: update.changes.label,
                                originalText: update.changes.label,
                                version: (el.version || 0) + 1,
                            };
                            break; // 只更新第一个匹配的
                        }
                    }
                }
            }
        }

        // 处理新增连线
        if (result.edgesToAdd.length > 0) {
            for (const edge of result.edgesToAdd) {
                // 找到源和目标节点的位置
                let sourcePos = elementPositions.get(edge.sourceNodeId || "");
                let targetPos = elementPositions.get(edge.targetNodeId || "");

                // 如果找不到，使用选中元素的位置
                if (!sourcePos && context.elementIds.length > 0) {
                    const firstSelected = currentElements.find((el) =>
                        context.elementIds.includes(el.id) &&
                        (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond")
                    );
                    if (firstSelected) {
                        sourcePos = {
                            x: firstSelected.x,
                            y: firstSelected.y,
                            width: firstSelected.width || 150,
                            height: firstSelected.height || 60,
                        };
                    }
                }

                if (!targetPos) {
                    // 使用选中元素右侧的位置
                    targetPos = {
                        x: baseX + offsetX,
                        y: baseY,
                        width: 150,
                        height: 60,
                    };
                }

                if (sourcePos && targetPos) {
                    // 创建箭头元素
                    const arrowId = edge.id || `arrow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const startX = sourcePos.x + sourcePos.width;
                    const startY = sourcePos.y + sourcePos.height / 2;
                    const endX = targetPos.x;
                    const endY = targetPos.y + targetPos.height / 2;

                    const arrowElement = {
                        id: arrowId,
                        type: "arrow" as const,
                        x: startX,
                        y: startY,
                        width: endX - startX,
                        height: endY - startY,
                        angle: 0,
                        strokeColor: "#1e1e1e",
                        backgroundColor: "transparent",
                        fillStyle: "solid" as const,
                        strokeWidth: 2,
                        strokeStyle: "solid" as const,
                        roughness: 1,
                        opacity: 100,
                        groupIds: [],
                        frameId: null,
                        index: `a${Date.now()}` as const,
                        roundness: { type: 2 },
                        seed: Math.floor(Math.random() * 2000000000),
                        version: 1,
                        versionNonce: Math.floor(Math.random() * 2000000000),
                        isDeleted: false,
                        boundElements: null,
                        updated: Date.now(),
                        link: null,
                        locked: false,
                        points: [[0, 0], [endX - startX, endY - startY]] as [number, number][],
                        lastCommittedPoint: null,
                        startBinding: null,
                        endBinding: null,
                        startArrowhead: null,
                        endArrowhead: "arrow" as const,
                        elbowed: false,
                    };

                    newElements.push(arrowElement as unknown as ExcalidrawElement);

                    // 如果有标签，添加文本
                    if (edge.label) {
                        const labelX = (startX + endX) / 2;
                        const labelY = (startY + endY) / 2 - 15;

                        const labelElement = {
                            id: `label-${arrowId}`,
                            type: "text" as const,
                            x: labelX,
                            y: labelY,
                            width: edge.label.length * 12,
                            height: 24,
                            angle: 0,
                            strokeColor: "#1e1e1e",
                            backgroundColor: "transparent",
                            fillStyle: "solid" as const,
                            strokeWidth: 1,
                            strokeStyle: "solid" as const,
                            roughness: 1,
                            opacity: 100,
                            groupIds: [],
                            frameId: null,
                            index: `a${Date.now() + 1}` as const,
                            roundness: null,
                            seed: Math.floor(Math.random() * 2000000000),
                            version: 1,
                            versionNonce: Math.floor(Math.random() * 2000000000),
                            isDeleted: false,
                            boundElements: null,
                            updated: Date.now(),
                            link: null,
                            locked: false,
                            text: edge.label,
                            fontSize: 16,
                            fontFamily: 1,
                            textAlign: "center" as const,
                            verticalAlign: "middle" as const,
                            containerId: null,
                            originalText: edge.label,
                            autoResize: true,
                            lineHeight: 1.25,
                        };

                        newElements.push(labelElement as unknown as ExcalidrawElement);
                    }
                }
            }
        }

        // 处理连线更新（修改标签）
        if (result.edgesToUpdate && result.edgesToUpdate.length > 0) {
            for (const update of result.edgesToUpdate) {
                if (update.changes.label) {
                    // 查找选中的连线相关的文本
                    for (let i = 0; i < newElements.length; i++) {
                        const el = newElements[i];
                        if (el.type === "text" && el.id.startsWith("label-")) {
                            newElements[i] = {
                                ...el,
                                text: update.changes.label,
                                originalText: update.changes.label,
                                version: (el.version || 0) + 1,
                            };
                        }
                    }
                }
            }
        }

        // 处理删除节点
        if (result.nodesToDelete.length > 0) {
            // 直接删除选中的元素
            const selectedIds = new Set(context.elementIds);

            // 也找到连接到这些元素的箭头
            const arrowsToDelete = new Set<string>();
            for (const el of currentElements) {
                if (el.type === "arrow") {
                    // 检查箭头是否连接到被删除的元素
                    if (el.startBinding && selectedIds.has(el.startBinding.elementId)) {
                        arrowsToDelete.add(el.id);
                    }
                    if (el.endBinding && selectedIds.has(el.endBinding.elementId)) {
                        arrowsToDelete.add(el.id);
                    }
                }
            }

            // 合并要删除的 ID
            const allIdsToDelete = new Set([...selectedIds, ...arrowsToDelete]);

            // 也删除关联的文本元素
            for (const el of currentElements) {
                if (el.customData?.parentId && allIdsToDelete.has(el.customData.parentId as string)) {
                    allIdsToDelete.add(el.id);
                }
                // 删除箭头标签
                if (el.type === "text" && el.id.startsWith("label-")) {
                    const arrowId = el.id.replace("label-", "");
                    if (arrowsToDelete.has(arrowId)) {
                        allIdsToDelete.add(el.id);
                    }
                }
            }

            newElements = newElements.filter((el) => !allIdsToDelete.has(el.id));
        }

        // 处理删除连线
        if (result.edgesToDelete && result.edgesToDelete.length > 0) {
            const edgeIdsToDelete = new Set(result.edgesToDelete);

            // 找到选中的箭头元素
            const arrowIdsToDelete = new Set<string>();
            for (const el of currentElements) {
                if (el.type === "arrow" && context.elementIds.includes(el.id)) {
                    arrowIdsToDelete.add(el.id);
                }
            }

            // 也删除箭头标签
            const allIdsToDelete = new Set<string>(arrowIdsToDelete);
            for (const arrowId of arrowIdsToDelete) {
                allIdsToDelete.add(`label-${arrowId}`);
            }

            newElements = newElements.filter((el) => !allIdsToDelete.has(el.id));
        }

        // 更新画布
        updateScene({ elements: newElements });
    };

    if (!isVisible) {
        return null;
    }

    const hasSelection = selectedElementIds.length > 0;

    return (
        <div className="absolute top-16 right-4 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col max-h-[70vh] z-50">
            {/* 头部 */}
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-white">{t("editMode.title")}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {hasSelection
                            ? t("editMode.elementsSelected", { count: selectedElementIds.length })
                            : t("editMode.selectElementsFirst")}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white p-1"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* 选中上下文 */}
            {hasSelection && selectedLabels.length > 0 && (
                <div className="p-3 border-b border-slate-700 bg-slate-800/50">
                    <div className="text-xs text-slate-400 mb-2">选中的内容:</div>
                    <div className="flex flex-wrap gap-1">
                        {selectedLabels.slice(0, 5).map((label, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded text-xs truncate max-w-[120px]"
                                title={label}
                            >
                                {label}
                            </span>
                        ))}
                        {selectedLabels.length > 5 && (
                            <span className="px-2 py-0.5 bg-slate-700 text-slate-400 rounded text-xs">
                                +{selectedLabels.length - 5} 更多
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">
                        {hasSelection
                            ? t("editMode.hint")
                            : t("editMode.hintNoSelection")}
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div key={msg.id} className="space-y-1">
                                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div
                                        className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${msg.role === "user"
                                            ? "bg-blue-600 text-white"
                                            : msg.status === "error"
                                                ? "bg-red-900/50 text-red-300"
                                                : msg.status === "streaming"
                                                    ? "bg-slate-800 text-slate-400"
                                                    : "bg-slate-800 text-slate-200"
                                            }`}
                                    >
                                        {msg.status === "streaming" && (
                                            <span className="inline-block w-3 h-3 mr-2 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                        )}
                                        {msg.status === "success" && (
                                            <span className="text-green-400 mr-1">✓</span>
                                        )}
                                        {msg.content}
                                    </div>
                                </div>

                                {/* 编辑结果详情 */}
                                {msg.result && (
                                    <div className="ml-2">
                                        <button
                                            onClick={() => toggleResult(msg.id)}
                                            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                                        >
                                            <svg
                                                className={`w-3 h-3 transition-transform ${msg.isResultExpanded ? "rotate-90" : ""}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            查看变更详情
                                        </button>
                                        {msg.isResultExpanded && (
                                            <EditResultView result={msg.result} />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* 输入区 */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={hasSelection ? t("editMode.placeholder") : t("editMode.placeholderNoSelection")}
                        disabled={isLoading}
                        className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || input.trim() === ""}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg px-3 py-2 transition-colors disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
}

/**
 * 编辑结果视图组件
 */
interface EditResultViewProps {
    result: IncrementalEditResult;
}

function EditResultView({ result }: EditResultViewProps) {
    return (
        <div className="mt-2 p-2 bg-slate-950 rounded border border-slate-700 text-xs space-y-2">
            {result.nodesToAdd.length > 0 && (
                <div>
                    <span className="text-green-400">+ 新增节点:</span>
                    <span className="text-slate-400 ml-1">
                        {result.nodesToAdd.map((n) => n.label).join(", ")}
                    </span>
                </div>
            )}
            {result.nodesToUpdate.length > 0 && (
                <div>
                    <span className="text-yellow-400">~ 修改节点:</span>
                    <span className="text-slate-400 ml-1">
                        {result.nodesToUpdate.map((n) => n.id).join(", ")}
                    </span>
                </div>
            )}
            {result.nodesToDelete.length > 0 && (
                <div>
                    <span className="text-red-400">- 删除节点:</span>
                    <span className="text-slate-400 ml-1">
                        {result.nodesToDelete.join(", ")}
                    </span>
                </div>
            )}
            {result.edgesToAdd.length > 0 && (
                <div>
                    <span className="text-green-400">+ 新增连线:</span>
                    <span className="text-slate-400 ml-1">{result.edgesToAdd.length} 条</span>
                </div>
            )}
            {result.edgesToDelete.length > 0 && (
                <div>
                    <span className="text-red-400">- 删除连线:</span>
                    <span className="text-slate-400 ml-1">{result.edgesToDelete.length} 条</span>
                </div>
            )}
        </div>
    );
}
