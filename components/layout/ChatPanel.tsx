"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useCanvas, useEngine } from "@/contexts";
import { generateDrawioXml, containsMermaidCode, extractMermaidCode, convertMermaidToElements } from "@/lib/converters";
import {
    chatStream,
    SYSTEM_PROMPT,
    getMermaidSystemPrompt,
    buildDiagramPrompt,
    parseDiagramJSON,
    generateExcalidrawElements,
    DiagramType,
    createIncrementalEditService,
    IncrementalEditService,
    IncrementalEditResult,
    SelectionContext,
    createConversationHistory,
    addMessage,
    historyToMessages,
    ConversationHistory,
} from "@/lib/ai";
import { getActiveApiKey } from "@/lib/storage";
import { ShadowNode } from "@/types";

interface DiagramNode {
    id: string;
    type: string;
    label: string;
}

interface DiagramEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
}

interface Message {
    id: string;
    role: "user" | "ai";
    content: string;
    status?: "pending" | "streaming" | "success" | "error";
    parsedNodes?: DiagramNode[];
    parsedEdges?: DiagramEdge[];
    isThinkingExpanded?: boolean;
    nodeCount?: number;
    edgeCount?: number;
}

interface ChatPanelProps {
    onSendMessage?: (message: string) => void;
}

export function ChatPanel({ onSendMessage }: ChatPanelProps) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [streamingContent, setStreamingContent] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { updateScene, getElements, selectedElementIds } = useCanvas();
    const { setDrawioXml } = useEngine();

    // 对话历史管理
    const conversationHistoryRef = useRef<ConversationHistory>(createConversationHistory());

    // 计算选中状态和位置
    const selectionInfo = useMemo(() => {
        if (selectedElementIds.length === 0) {
            return null;
        }
        const elements = getElements();
        const selectedElements = elements.filter(
            (el) => selectedElementIds.includes(el.id) && !el.isDeleted
        );

        if (selectedElements.length === 0) return null;

        // 计算选中区域边界
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const labels: string[] = [];

        for (const el of selectedElements) {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + (el.width || 0));
            maxY = Math.max(maxY, el.y + (el.height || 0));

            // 提取文本标签
            if (el.type === "text" && el.text) {
                labels.push(el.text as string);
            }
        }

        return {
            count: selectedElementIds.length,
            labels: labels.slice(0, 3),
            bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
            selectedElements,
        };
    }, [selectedElementIds, getElements]);

    // 增量编辑服务
    const editServiceRef = useRef<IncrementalEditService | null>(null);
    useEffect(() => {
        if (!editServiceRef.current) {
            editServiceRef.current = createIncrementalEditService();
        }
    }, []);

    // 检测编辑意图
    const detectEditIntent = (message: string): boolean => {
        const editKeywords = [
            "修改", "改为", "改成", "更改", "替换",
            "删除", "移除", "去掉",
            "添加", "新增", "增加", "插入",
            "连接", "连线", "指向",
            "重命名", "改名",
        ];
        return editKeywords.some((kw) => message.includes(kw));
    };

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const toggleThinking = useCallback((msgId: string) => {
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === msgId
                    ? { ...msg, isThinkingExpanded: !msg.isThinkingExpanded }
                    : msg
            )
        );
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() === "" || isLoading) {
            return;
        }

        const userMessage = input.trim();
        setInput("");

        // 添加用户消息
        const userMsgId = `msg-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            { id: userMsgId, role: "user", content: userMessage },
        ]);

        // 检查 API Key
        const apiKey = getActiveApiKey();
        if (!apiKey) {
            setMessages((prev) => [
                ...prev,
                {
                    id: `msg-${Date.now()}`,
                    role: "ai",
                    content: "请先在设置中配置 API Key",
                    status: "error",
                },
            ]);
            return;
        }

        // 添加 AI 思考中消息
        const aiMsgId = `msg-${Date.now() + 1}`;
        setMessages((prev) => [
            ...prev,
            { id: aiMsgId, role: "ai", content: "正在思考...", status: "streaming" },
        ]);
        setIsLoading(true);
        setStreamingContent("");

        // 判断是编辑模式还是生成模式
        const isEditMode = selectionInfo && selectionInfo.count > 0 && detectEditIntent(userMessage);

        if (isEditMode && editServiceRef.current) {
            // === 编辑模式 ===
            await handleEditMode(userMessage, aiMsgId);
        } else {
            // === 生成模式 ===
            await handleGenerateMode(userMessage, aiMsgId);
        }
    };

    // 辅助函数：获取形状元素绑定的文本标签
    const getShapeLabel = (shapeEl: ExcalidrawElement, allElements: readonly ExcalidrawElement[]): string => {
        // 方式1：通过 containerId 查找
        const boundText = allElements.find(
            (e) => e.type === "text" && e.containerId === shapeEl.id
        );
        if (boundText?.text) return boundText.text;

        // 方式2：通过 boundElements 查找
        if (shapeEl.boundElements) {
            const boundTextRef = shapeEl.boundElements.find((b: { type: string }) => b.type === "text");
            if (boundTextRef) {
                const textEl = allElements.find((e) => e.id === boundTextRef.id);
                if (textEl?.text) return textEl.text;
            }
        }

        // 方式3：通过 groupIds 查找
        const groupId = shapeEl.groupIds?.[0];
        if (groupId) {
            const textEl = allElements.find((e) => e.type === "text" && e.groupIds?.includes(groupId));
            if (textEl?.text) return textEl.text;
        }

        return "节点";
    };

    // 编辑模式处理
    const handleEditMode = async (userMessage: string, aiMsgId: string) => {
        if (!selectionInfo || !editServiceRef.current) return;

        const allElements = getElements();

        // 构建选中上下文 - 为每个选中的形状获取其实际标签
        const selectedShapes = selectionInfo.selectedElements
            .filter((el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond");

        const context: SelectionContext = {
            elementIds: selectedElementIds,
            nodes: selectedShapes.map((el, idx) => ({
                id: el.id,
                type: el.type === "diamond" ? "decision" : el.type === "ellipse" ? "start" : "process",
                label: getShapeLabel(el, allElements),  // 获取每个形状的实际标签
                elementIds: [el.id],
                logicalPosition: { row: idx, column: 0 },
                position: { x: el.x, y: el.y, width: el.width || 150, height: el.height || 60 },
                properties: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
            } as ShadowNode)),
            relatedEdges: [],
            modules: [],
            bounds: selectionInfo.bounds,
            description: `选中了 ${selectedShapes.length} 个节点: ${selectedShapes.map(el => getShapeLabel(el, allElements)).join(", ")}`,
            timestamp: Date.now(),
        };

        const result = await editServiceRef.current.edit(
            { instruction: userMessage, context },
            (tokens) => {
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMsgId
                            ? { ...msg, content: `正在分析... (~${tokens} tokens)` }
                            : msg
                    )
                );
            }
        );

        if (result.success) {
            // 应用编辑结果
            applyEditResult(result);
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === aiMsgId
                        ? {
                            ...msg,
                            content: result.explanation,
                            status: "success",
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
                            content: result.error || "编辑失败",
                            status: "error",
                        }
                        : msg
                )
            );
        }

        setIsLoading(false);
        setStreamingContent("");
        setTimeout(scrollToBottom, 100);
    };

    // 应用编辑结果
    const applyEditResult = (result: IncrementalEditResult) => {
        const currentElements = getElements();
        let newElements = [...currentElements];

        // 修改文字（支持多节点）
        if (result.nodesToUpdate.length > 0) {
            // 获取选中的形状元素
            const selectedShapes = selectionInfo?.selectedElements?.filter(
                (el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond"
            ) || [];

            // 获取选中的文本元素
            const selectedTexts = newElements.filter(
                (el) => el.type === "text" && selectedElementIds.includes(el.id)
            );

            for (let idx = 0; idx < result.nodesToUpdate.length; idx++) {
                const update = result.nodesToUpdate[idx];

                // ID 匹配或顺序匹配逻辑
                let targetElIndex = -1;

                // 1. 尝试直接 ID 匹配
                targetElIndex = newElements.findIndex(el => el.id === update.id);

                // 2. 如果 ID 不匹配（AI 返回了简化 ID 如 "A", "B"），尝试按顺序匹配选中的 Shape
                if (targetElIndex === -1 && idx < selectedShapes.length) {
                    targetElIndex = newElements.findIndex(el => el.id === selectedShapes[idx].id);
                }

                if (targetElIndex !== -1) {
                    const targetEl = newElements[targetElIndex];

                    // 修改 Label：如果是 Text 元素直接改，如果是 Shape 找绑定的 Text
                    if (update.changes.label) {
                        if (targetEl.type === "text") {
                            newElements[targetElIndex] = {
                                ...targetEl,
                                text: update.changes.label,
                                originalText: update.changes.label,
                                version: (targetEl.version || 0) + 1,
                            };
                        } else {
                            // 查找绑定的 Text（支持多种绑定方式）
                            let textIndex = -1;

                            // 方式1：通过 containerId 查找（convertToExcalidrawElements 使用这种方式）
                            textIndex = newElements.findIndex(
                                el => el.type === "text" && el.containerId === targetEl.id
                            );

                            // 方式2：通过 boundElements 查找
                            if (textIndex === -1 && targetEl.boundElements) {
                                const boundTextRef = targetEl.boundElements.find((b: { type: string }) => b.type === "text");
                                if (boundTextRef) {
                                    textIndex = newElements.findIndex(el => el.id === boundTextRef.id);
                                }
                            }

                            // 方式3：通过 groupIds 查找（旧版兼容）
                            if (textIndex === -1) {
                                const groupId = targetEl.groupIds?.[0];
                                if (groupId) {
                                    textIndex = newElements.findIndex(el => el.type === "text" && el.groupIds?.includes(groupId));
                                }
                            }

                            if (textIndex !== -1) {
                                console.log("[applyEditResult] Updating text at index", textIndex, "to:", update.changes.label);
                                newElements[textIndex] = {
                                    ...newElements[textIndex],
                                    text: update.changes.label,
                                    originalText: update.changes.label,
                                    version: (newElements[textIndex].version || 0) + 1,
                                };
                            } else {
                                console.warn("[applyEditResult] Could not find bound text for shape:", targetEl.id);
                            }
                        }
                    }

                    // 修改形状类型
                    if (update.changes.type) {
                        const typeMap: Record<string, string> = {
                            process: "rectangle",
                            decision: "diamond",
                            start: "ellipse",
                            end: "ellipse",
                            data: "rectangle",
                        };
                        const newType = typeMap[update.changes.type] || update.changes.type;
                        if (["rectangle", "ellipse", "diamond"].includes(newType)) {
                            newElements[targetElIndex] = {
                                ...targetEl,
                                type: newType as "rectangle" | "ellipse" | "diamond",
                                version: (targetEl.version || 0) + 1,
                            };
                        }
                    }
                }
            }
        }

        // 删除节点
        if (result.nodesToDelete.length > 0) {
            const idsToDelete = new Set(selectedElementIds);
            // 也删除关联的箭头和文本
            for (const el of currentElements) {
                if (el.type === "arrow") {
                    if (el.startBinding && idsToDelete.has(el.startBinding.elementId)) {
                        idsToDelete.add(el.id);
                    }
                    if (el.endBinding && idsToDelete.has(el.endBinding.elementId)) {
                        idsToDelete.add(el.id);
                    }
                }
            }
            newElements = newElements.filter((el) => !idsToDelete.has(el.id));
        }

        // 添加节点和连线
        if (result.nodesToAdd.length > 0) {
            const baseX = selectionInfo?.bounds?.x ?? 100;
            const baseY = (selectionInfo?.bounds?.y ?? 100) + (selectionInfo?.bounds?.height ?? 60) + 50;

            // 构建完整的图表数据（包含节点和连线）
            const nodeIds = result.nodesToAdd.map((n, idx) => n.id || `node-${Date.now()}-${idx}`);

            // 获取第一个选中的形状元素作为连接起点
            const firstSelectedShape = selectionInfo?.selectedElements?.find(
                (el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond"
            );

            const diagramData = {
                nodes: result.nodesToAdd.map((n, idx) => ({
                    id: nodeIds[idx],
                    type: n.type || "process",
                    label: n.label || "新节点",
                    row: idx,  // 垂直布局
                    column: 0,
                })),
                edges: [
                    // 从选中节点连接到第一个新节点
                    ...(firstSelectedShape ? [{
                        id: `edge-start-${Date.now()}`,
                        source: firstSelectedShape.id,
                        target: nodeIds[0],
                        label: "",
                    }] : []),
                    // AI 返回的连线
                    ...result.edgesToAdd.map((e, idx) => ({
                        id: e.id || `edge-${Date.now()}-${idx}`,
                        source: e.sourceNodeId || nodeIds[idx] || "",
                        target: e.targetNodeId || nodeIds[idx + 1] || "",
                        label: e.label || "",
                    })),
                    // 如果 AI 没有返回连线，自动生成节点间的连线
                    ...(result.edgesToAdd.length === 0 && result.nodesToAdd.length > 1
                        ? nodeIds.slice(0, -1).map((sourceId, idx) => ({
                            id: `edge-auto-${Date.now()}-${idx}`,
                            source: sourceId,
                            target: nodeIds[idx + 1],
                            label: "",
                        }))
                        : []),
                ],
            };

            const { elements } = generateExcalidrawElements(diagramData);

            // 调整位置到选中区域下方
            const adjustedElements = elements.map((el) => ({
                ...el,
                x: el.x + baseX,
                y: el.y + baseY,
            }));

            newElements = [...newElements, ...adjustedElements];
        }

        // 添加连线（无新节点时）
        if (result.edgesToAdd.length > 0 && result.nodesToAdd.length === 0) {
            // 获取选中的形状元素
            const selectedShapes = selectionInfo?.selectedElements?.filter(
                (el) => el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond"
            ) || [];

            for (const edge of result.edgesToAdd) {
                // 处理 selected-0, selected-1 占位符
                let sourceId = edge.sourceNodeId;
                let targetId = edge.targetNodeId;

                if (sourceId === "selected-0" && selectedShapes.length > 0) {
                    sourceId = selectedShapes[0].id;
                }
                if (targetId === "selected-1" && selectedShapes.length > 1) {
                    targetId = selectedShapes[1].id;
                }
                if (sourceId === "selected" && selectedShapes.length > 0) {
                    sourceId = selectedShapes[0].id;
                }
                if (targetId === "selected" && selectedShapes.length > 1) {
                    targetId = selectedShapes[1].id;
                }

                if (sourceId && targetId) {
                    // 创建箭头元素
                    const sourceEl = currentElements.find((el) => el.id === sourceId);
                    const targetEl = currentElements.find((el) => el.id === targetId);

                    if (sourceEl && targetEl) {
                        const arrowId = `arrow-${Date.now()}`;
                        const startX = sourceEl.x + (sourceEl.width || 150) / 2;
                        const startY = sourceEl.y + (sourceEl.height || 60);
                        const endX = targetEl.x + (targetEl.width || 150) / 2;
                        const endY = targetEl.y;

                        const arrow = {
                            id: arrowId,
                            type: "arrow" as const,
                            x: startX,
                            y: startY,
                            width: endX - startX,
                            height: endY - startY,
                            angle: 0,
                            strokeColor: "#1e1e1e",
                            backgroundColor: "transparent",
                            fillStyle: "hachure",
                            strokeWidth: 2,
                            strokeStyle: "solid",
                            roughness: 1,
                            opacity: 100,
                            groupIds: [],
                            frameId: null,
                            roundness: { type: 2 },
                            seed: Math.floor(Math.random() * 100000),
                            version: 1,
                            versionNonce: Math.floor(Math.random() * 100000),
                            isDeleted: false,
                            boundElements: null,
                            updated: Date.now(),
                            link: null,
                            locked: false,
                            points: [[0, 0], [endX - startX, endY - startY]] as [number, number][],
                            lastCommittedPoint: null,
                            startBinding: {
                                elementId: sourceId,
                                focus: 0,
                                gap: 1,
                            },
                            endBinding: {
                                elementId: targetId,
                                focus: 0,
                                gap: 1,
                            },
                            startArrowhead: null,
                            endArrowhead: "arrow",
                        };

                        newElements = [...newElements, arrow];
                        console.log("Created arrow between", sourceId, "and", targetId);
                    }
                }
            }
        }

        updateScene({ elements: newElements });
        // 关键修复：显式触发同步，确保 Draw.io 数据是最新的
        syncToDrawio(newElements);
    };

    // 同步 Excalidraw 元素到 Draw.io
    const syncToDrawio = (elements: typeof currentElements) => {
        // 从 Excalidraw 元素提取节点和边
        const nodes: Array<{ id: string; type: string; label: string; row: number; column: number; x: number; y: number }> = [];
        const edges: Array<{ id: string; source: string; target: string; label?: string }> = [];

        // 第一遍：收集所有形状元素及其位置
        const shapeElements: Array<{ el: typeof elements[0]; label: string }> = [];

        for (const el of elements) {
            if (el.isDeleted) continue;

            if (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond") {
                // 尝试找到关联的文本（支持多种绑定方式）
                let label = "";

                // 方式1：通过 containerId 查找（convertToExcalidrawElements 使用这种方式）
                const boundTextEl = elements.find(
                    (e) => e.type === "text" && e.containerId === el.id
                );
                if (boundTextEl && boundTextEl.text) {
                    label = boundTextEl.text;
                }

                // 方式2：通过 boundElements 查找
                if (!label && el.boundElements) {
                    const boundTextRef = el.boundElements.find((b: { type: string }) => b.type === "text");
                    if (boundTextRef) {
                        const textEl = elements.find((e) => e.id === boundTextRef.id);
                        if (textEl && textEl.text) {
                            label = textEl.text;
                        }
                    }
                }

                // 方式3：通过 groupIds 查找（旧版兼容）
                if (!label) {
                    const groupId = el.groupIds?.[0];
                    if (groupId) {
                        const textEl = elements.find((e) => e.type === "text" && e.groupIds?.includes(groupId));
                        if (textEl && textEl.text) {
                            label = textEl.text;
                        }
                    }
                }

                shapeElements.push({ el, label: label || "节点" });
            }
        }

        // 根据 Excalidraw 中的实际位置计算 row/column
        // 使用网格化布局：将连续的 x/y 坐标映射到离散的 row/column
        if (shapeElements.length > 0) {
            // 收集所有唯一的 y 坐标（用于计算 row）和 x 坐标（用于计算 column）
            const yCoords = [...new Set(shapeElements.map(s => Math.round(s.el.y / 80) * 80))].sort((a, b) => a - b);
            const xCoords = [...new Set(shapeElements.map(s => Math.round(s.el.x / 160) * 160))].sort((a, b) => a - b);

            for (const { el, label } of shapeElements) {
                // 根据元素位置计算 row 和 column
                const normalizedY = Math.round(el.y / 80) * 80;
                const normalizedX = Math.round(el.x / 160) * 160;
                const row = yCoords.indexOf(normalizedY);
                const column = xCoords.indexOf(normalizedX);

                nodes.push({
                    id: el.id,
                    type: el.type === "diamond" ? "decision" : el.type === "ellipse" ? "start" : "process",
                    label,
                    row: row >= 0 ? row : 0,
                    column: column >= 0 ? column : 0,
                    x: el.x,
                    y: el.y,
                });
            }
        }

        // 第二遍：收集所有边（箭头）
        for (const el of elements) {
            if (el.isDeleted) continue;

            if (el.type === "arrow" && el.startBinding && el.endBinding) {
                edges.push({
                    id: el.id,
                    source: el.startBinding.elementId,
                    target: el.endBinding.elementId,
                    label: "",
                });
            }
        }

        if (nodes.length > 0) {
            console.log("[syncToDrawio] Syncing nodes:", nodes.map(n => ({ id: n.id, label: n.label, row: n.row, column: n.column })));
            console.log("[syncToDrawio] Syncing edges:", edges.length);
            setDrawioXml(generateDrawioXml({ nodes, edges }));
        }
    };

    // 获取当前元素的引用（用于 syncToDrawio）
    const currentElements = getElements();

    // 生成模式处理
    const handleGenerateMode = async (userMessage: string, aiMsgId: string) => {
        // 检测图表类型
        const diagramType = detectDiagramType(userMessage);
        const prompt = buildDiagramPrompt(userMessage, diagramType);

        // 添加用户消息到历史
        conversationHistoryRef.current = addMessage(conversationHistoryRef.current, "user", userMessage);

        // 构建包含历史的消息列表
        const historyMessages = historyToMessages(conversationHistoryRef.current);

        // 流式调用 LLM（包含历史）
        await chatStream(
            [
                { role: "system", content: getMermaidSystemPrompt() },
                ...historyMessages.slice(0, -1), // 历史消息（不含当前）
                { role: "user", content: prompt }, // 当前请求使用完整 prompt
            ],
            {
                onToken: (token, accumulated) => {
                    setStreamingContent(accumulated);
                    // 更新消息显示流式进度（估算 token 数：字符数 / 4）
                    const estimatedTokens = Math.ceil(accumulated.length / 4);
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === aiMsgId
                                ? {
                                    ...msg,
                                    content: `正在生成... (~${estimatedTokens} tokens)`,
                                    status: "streaming",
                                }
                                : msg
                        )
                    );
                },
                onComplete: async (fullContent) => {
                    // 优先尝试 Mermaid 解析（Token 更省）
                    if (containsMermaidCode(fullContent)) {
                        const mermaidCode = extractMermaidCode(fullContent);
                        if (mermaidCode) {
                            const mermaidResult = await convertMermaidToElements(mermaidCode);
                            if (mermaidResult.success && mermaidResult.elements.length > 0) {
                                const currentElements = getElements();
                                let adjustedElements = mermaidResult.elements;

                                if (selectionInfo && selectionInfo.bounds) {
                                    const offsetX = selectionInfo.bounds.x + selectionInfo.bounds.width + 100;
                                    const offsetY = selectionInfo.bounds.y;
                                    adjustedElements = mermaidResult.elements.map((el) => ({
                                        ...el,
                                        x: (el.x || 0) + offsetX,
                                        y: (el.y || 0) + offsetY,
                                    }));
                                }

                                const allElements = [...currentElements, ...adjustedElements];
                                updateScene({ elements: allElements });

                                // 同步到 Draw.io
                                syncToDrawio(allElements);

                                // 统计节点和边数量
                                const nodeCount = adjustedElements.filter(el =>
                                    el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond"
                                ).length;
                                const edgeCount = adjustedElements.filter(el =>
                                    el.type === "arrow" || el.type === "line"
                                ).length;

                                setMessages((prev) =>
                                    prev.map((msg) =>
                                        msg.id === aiMsgId
                                            ? {
                                                ...msg,
                                                content: `已生成 ${nodeCount} 个节点和 ${edgeCount} 条连线 (Mermaid)`,
                                                status: "success",
                                                isThinkingExpanded: false,
                                                nodeCount,
                                                edgeCount,
                                            }
                                            : msg
                                    )
                                );

                                conversationHistoryRef.current = addMessage(
                                    conversationHistoryRef.current,
                                    "assistant",
                                    fullContent // 保存完整生成的 Mermaid 代码，以便后续基于上下文修改
                                );

                                if (onSendMessage) {
                                    onSendMessage(userMessage);
                                }

                                setIsLoading(false);
                                setStreamingContent("");
                                setTimeout(scrollToBottom, 100);
                                return;
                            }
                        }
                    }

                    // Fallback: JSON 解析
                    const diagramData = parseDiagramJSON(fullContent);

                    if (diagramData) {
                        // 生成 Excalidraw 元素
                        const { elements } = generateExcalidrawElements(diagramData);
                        // 更新画布 - 基于选中位置偏移
                        const currentElements = getElements();
                        let adjustedElements = elements;

                        if (selectionInfo && selectionInfo.bounds) {
                            // 如果有选中元素，将新内容放在选中区域右侧
                            const offsetX = selectionInfo.bounds.x + selectionInfo.bounds.width + 100;
                            const offsetY = selectionInfo.bounds.y;

                            adjustedElements = elements.map((el) => ({
                                ...el,
                                x: el.x + offsetX,
                                y: el.y + offsetY,
                            }));
                        }

                        updateScene({ elements: [...currentElements, ...adjustedElements] });

                        // 同步生成 Draw.io XML
                        setDrawioXml(generateDrawioXml(diagramData));

                        // 更新消息，存储解析后的数据
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === aiMsgId
                                    ? {
                                        ...msg,
                                        content: `已生成 ${diagramData.nodes.length} 个节点和 ${diagramData.edges.length} 条连线`,
                                        status: "success",
                                        parsedNodes: diagramData.nodes.map((n) => ({
                                            id: n.id,
                                            type: n.type,
                                            label: n.label,
                                        })),
                                        parsedEdges: diagramData.edges.map((e) => ({
                                            id: e.id,
                                            source: e.source,
                                            target: e.target,
                                            label: e.label,
                                        })),
                                        isThinkingExpanded: false,
                                        nodeCount: diagramData.nodes.length,
                                        edgeCount: diagramData.edges.length,
                                    }
                                    : msg
                            )
                        );

                        // 添加 AI 响应到历史
                        const aiResponse = `已生成 ${diagramData.nodes.length} 个节点和 ${diagramData.edges.length} 条连线`;
                        conversationHistoryRef.current = addMessage(conversationHistoryRef.current, "assistant", aiResponse);

                        if (onSendMessage) {
                            onSendMessage(userMessage);
                        }
                    } else {
                        // 解析失败
                        setMessages((prev) =>
                            prev.map((msg) =>
                                msg.id === aiMsgId
                                    ? {
                                        ...msg,
                                        content: "无法解析 AI 返回的图表数据",
                                        status: "error",
                                        isThinkingExpanded: false,
                                    }
                                    : msg
                            )
                        );
                    }

                    setIsLoading(false);
                    setStreamingContent("");
                    setTimeout(scrollToBottom, 100);
                },
                onError: (error) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === aiMsgId
                                ? {
                                    ...msg,
                                    content: `生成失败: ${error.message}`,
                                    status: "error",
                                }
                                : msg
                        )
                    );
                    setIsLoading(false);
                    setStreamingContent("");
                },
            }
        );
    };

    const handleSuggestionClick = (text: string) => {
        setInput(text);
    };

    return (
        <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700">
                <h2 className="text-sm font-medium text-white">AI 助手</h2>
                <p className="text-xs text-slate-400 mt-1">
                    {selectionInfo
                        ? `已选中 ${selectionInfo.count} 个元素，新内容将添加到其右侧`
                        : "描述您想要的图表，AI 将为您生成"}
                </p>
            </div>

            {/* 选中状态提示 */}
            {selectionInfo && selectionInfo.labels.length > 0 && (
                <div className="px-4 py-2 bg-blue-900/30 border-b border-slate-700">
                    <div className="text-xs text-blue-300 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        选中: {selectionInfo.labels.join(", ")}
                        {selectionInfo.labels.length < selectionInfo.count && ` +${selectionInfo.count - selectionInfo.labels.length}`}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-slate-500 text-sm">
                            开始对话，描述您想要绘制的图表
                        </p>
                        <div className="mt-4 space-y-2">
                            <SuggestionButton text="画一个用户登录流程图" onClick={handleSuggestionClick} />
                            <SuggestionButton text="创建一个微服务架构图" onClick={handleSuggestionClick} />
                            <SuggestionButton text="设计一个用户管理系统ER图" onClick={handleSuggestionClick} />
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div key={msg.id} className="space-y-2">
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

                                {/* 可折叠的图表结构展示 */}
                                {(msg.parsedNodes || msg.parsedEdges) && (
                                    <div className="ml-2">
                                        <button
                                            onClick={() => toggleThinking(msg.id)}
                                            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                                        >
                                            <svg
                                                className={`w-3 h-3 transition-transform ${msg.isThinkingExpanded ? "rotate-90" : ""}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            查看图表结构
                                        </button>
                                        {msg.isThinkingExpanded && (
                                            <DiagramStructureView nodes={msg.parsedNodes || []} edges={msg.parsedEdges || []} />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}

                {/* 流式内容预览 */}
                {streamingContent && (
                    <div className="p-2 bg-slate-950 rounded border border-slate-700">
                        <div className="text-xs text-slate-500 mb-1">实时响应:</div>
                        <div className="text-xs text-slate-400 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                            {streamingContent.slice(-500)}
                            <span className="animate-pulse">▌</span>
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="描述您想要的图表..."
                        disabled={isLoading}
                        className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || input.trim() === ""}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg px-4 py-2 transition-colors disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
}

interface SuggestionButtonProps {
    text: string;
    onClick: (text: string) => void;
}

function SuggestionButton({ text, onClick }: SuggestionButtonProps) {
    return (
        <button
            onClick={() => onClick(text)}
            className="w-full text-left text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-2 transition-colors"
        >
            {text}
        </button>
    );
}

/**
 * 图表结构可视化组件
 */
interface DiagramStructureViewProps {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
}

function DiagramStructureView({ nodes, edges }: DiagramStructureViewProps) {
    // 创建节点 ID 到标签的映射
    const nodeLabels = new Map(nodes.map((n) => [n.id, n.label]));

    return (
        <div className="mt-2 p-3 bg-slate-950 rounded border border-slate-700 text-xs max-h-64 overflow-y-auto space-y-3">
            {/* 节点列表 */}
            <div>
                <div className="text-slate-400 font-medium mb-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                    </svg>
                    节点 ({nodes.length})
                </div>
                <div className="space-y-1">
                    {nodes.map((node, idx) => (
                        <div key={node.id} className="flex items-center gap-2 text-slate-300">
                            <span className="text-slate-500 w-4">{idx + 1}.</span>
                            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 text-[10px]">
                                {node.type}
                            </span>
                            <span className="truncate">{node.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 连线列表 */}
            {edges.length > 0 && (
                <div>
                    <div className="text-slate-400 font-medium mb-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        连线 ({edges.length})
                    </div>
                    <div className="space-y-1">
                        {edges.map((edge, idx) => (
                            <div key={edge.id} className="flex items-center gap-1 text-slate-300 text-[11px]">
                                <span className="text-slate-500 w-4">{idx + 1}.</span>
                                <span className="truncate max-w-[80px]" title={nodeLabels.get(edge.source)}>
                                    {nodeLabels.get(edge.source) || edge.source}
                                </span>
                                <span className="text-slate-500">→</span>
                                <span className="truncate max-w-[80px]" title={nodeLabels.get(edge.target)}>
                                    {nodeLabels.get(edge.target) || edge.target}
                                </span>
                                {edge.label && (
                                    <span className="text-slate-500 italic truncate">({edge.label})</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * 检测用户输入的图表类型
 */
function detectDiagramType(input: string): DiagramType {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes("流程") || lowerInput.includes("flow")) {
        return "flowchart";
    }
    if (lowerInput.includes("架构") || lowerInput.includes("architecture") || lowerInput.includes("微服务")) {
        return "architecture";
    }
    if (lowerInput.includes("时序") || lowerInput.includes("sequence")) {
        return "sequence";
    }
    if (lowerInput.includes("思维导图") || lowerInput.includes("mindmap")) {
        return "mindmap";
    }
    if (lowerInput.includes("er") || lowerInput.includes("实体") || lowerInput.includes("关系图")) {
        return "er";
    }
    if (lowerInput.includes("类图") || lowerInput.includes("class")) {
        return "class";
    }

    return "generic";
}
