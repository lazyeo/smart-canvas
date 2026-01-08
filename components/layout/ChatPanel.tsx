"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useCanvas, useEngine } from "@/contexts";
import { useFile } from "@/contexts/FileContext";
import { ExcalidrawElement } from "@/components/canvas/ExcalidrawWrapper";
import { generateDrawioXml, containsMermaidCode, extractMermaidCode, convertMermaidToElements } from "@/lib/converters";
import {
    chatStream,
    SYSTEM_PROMPT,
    getMermaidSystemPrompt,
    buildDiagramPrompt,
    buildMermaidPrompt,
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
    const { autoSave, currentFile, saveChatHistory } = useFile();

    // 对话历史管理
    const conversationHistoryRef = useRef<ConversationHistory>(createConversationHistory());

    // 当前文件 ID 跟踪（用于检测文件切换）
    const currentFileIdRef = useRef<string | null>(null);

    // 当文件切换时，加载该文件的对话历史
    useEffect(() => {
        const newFileId = currentFile?.id ?? null;

        // 如果文件 ID 发生变化
        if (currentFileIdRef.current !== newFileId) {
            // 更新当前文件 ID
            currentFileIdRef.current = newFileId;

            if (currentFile?.chatHistory && currentFile.chatHistory.length > 0) {
                // 从文件加载对话历史
                const loadedMessages: Message[] = currentFile.chatHistory.map(msg => ({
                    id: msg.id,
                    role: msg.role === "assistant" ? "ai" : "user",
                    content: msg.content,
                    status: "success" as const,
                }));
                setMessages(loadedMessages);
                // 重建对话历史上下文
                conversationHistoryRef.current = createConversationHistory();
                for (const msg of currentFile.chatHistory) {
                    conversationHistoryRef.current = addMessage(
                        conversationHistoryRef.current,
                        msg.role === "assistant" ? "assistant" : "user",
                        msg.content
                    );
                }
                console.log("[ChatPanel] Loaded", loadedMessages.length, "messages from file");
            } else {
                // 新文件或无历史，清空对话
                setMessages([]);
                conversationHistoryRef.current = createConversationHistory();
                console.log("[ChatPanel] File changed, conversation cleared");
            }
        }
    }, [currentFile?.id, currentFile?.chatHistory]);

    // 当消息变化时，保存到文件（防抖）
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        // 只有在有消息且文件存在时才保存
        if (messages.length === 0 || !currentFile) return;

        // 防抖保存
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = setTimeout(() => {
            const chatHistory = messages
                // 用户消息没有 status，AI 消息需要是 success 状态
                .filter(msg => msg.role === "user" || msg.status === "success")
                .map(msg => ({
                    id: msg.id,
                    role: (msg.role === "ai" ? "assistant" : "user") as "user" | "assistant",
                    content: msg.content,
                    timestamp: Date.now(),
                }));
            saveChatHistory(chatHistory);
        }, 1000);

        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, [messages, currentFile, saveChatHistory]);

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

    // 估算文字尺寸并更新元素
    const updateTextDimensions = (
        textEl: ExcalidrawElement,
        newText: string,
        containerEl?: ExcalidrawElement
    ): { text: ExcalidrawElement; container?: ExcalidrawElement } => {
        // 估算文字宽度（简单估算：英文字符约 8px，中文约 14px）
        const fontSize = (textEl as { fontSize?: number }).fontSize || 16;
        const fontFamily = (textEl as { fontFamily?: number }).fontFamily || 1;

        // 计算文字宽度
        let charWidth = fontSize * 0.6; // 默认
        if (fontFamily === 1) { // Hand-drawn style
            charWidth = fontSize * 0.55;
        }

        // 计算每个字符的宽度（中文更宽）
        let totalWidth = 0;
        for (const char of newText) {
            if (/[\u4e00-\u9fa5]/.test(char)) {
                totalWidth += fontSize * 0.9; // 中文
            } else if (/[A-Z]/.test(char)) {
                totalWidth += charWidth * 1.1; // 大写字母
            } else {
                totalWidth += charWidth * 0.9; // 其他字符
            }
        }

        // 添加一些边距
        const textWidth = totalWidth + 10;
        const textHeight = fontSize * 1.4;

        // 更新文字元素
        const updatedText = {
            ...textEl,
            text: newText,
            originalText: newText,
            width: textWidth,
            height: textHeight,
            version: (textEl.version || 0) + 1,
        };

        // 如果有容器，检查是否需要扩展容器
        if (containerEl) {
            const containerWidth = containerEl.width || 100;
            const containerHeight = containerEl.height || 50;
            const minPadding = 20;

            const requiredWidth = textWidth + minPadding * 2;
            const requiredHeight = textHeight + minPadding * 2;

            if (requiredWidth > containerWidth || requiredHeight > containerHeight) {
                const newWidth = Math.max(containerWidth, requiredWidth);
                const newHeight = Math.max(containerHeight, requiredHeight);

                // 保持中心点不变
                const dx = (newWidth - containerWidth) / 2;
                const dy = (newHeight - containerHeight) / 2;

                return {
                    text: updatedText,
                    container: {
                        ...containerEl,
                        x: containerEl.x - dx,
                        y: containerEl.y - dy,
                        width: newWidth,
                        height: newHeight,
                        version: (containerEl.version || 0) + 1,
                    }
                };
            }
        }

        return { text: updatedText };
    };

    // 获取所有箭头及其标签
    const getArrowLabels = (elements: readonly ExcalidrawElement[]): Array<{
        arrow: ExcalidrawElement;
        textEl?: ExcalidrawElement;
        label: string;
    }> => {
        const results: Array<{ arrow: ExcalidrawElement; textEl?: ExcalidrawElement; label: string }> = [];

        for (const el of elements) {
            if (el.type === "arrow" && !el.isDeleted) {
                // 查找绑定的文字
                let textEl: ExcalidrawElement | undefined;
                let label = "";

                // 方式1: containerId
                textEl = elements.find(t => t.type === "text" && (t as { containerId?: string }).containerId === el.id) as ExcalidrawElement | undefined;

                // 方式2: boundElements
                if (!textEl && el.boundElements) {
                    const boundText = el.boundElements.find((b: { type: string }) => b.type === "text");
                    if (boundText) {
                        textEl = elements.find(t => t.id === boundText.id) as ExcalidrawElement | undefined;
                    }
                }

                if (textEl && (textEl as { text?: string }).text) {
                    label = (textEl as { text: string }).text;
                }

                results.push({ arrow: el, textEl, label });
            }
        }

        return results;
    };

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

    // 检测全局编辑意图（修改整个流程图）
    const detectGlobalEditIntent = (message: string): boolean => {
        const globalKeywords = [
            "全部", "全流程", "整个", "所有", "全改", "都改",
            "翻译", "转换", "中文", "英文", "改为中文", "改为英文",
        ];
        return globalKeywords.some((kw) => message.includes(kw)) && detectEditIntent(message);
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
            { id: userMsgId, role: "user", content: userMessage, status: "success" },
        ]);

        // 添加 AI 思考中消息
        const aiMsgId = `msg-${Date.now() + 1}`;
        setMessages((prev) => [
            ...prev,
            { id: aiMsgId, role: "ai", content: "正在思考...", status: "streaming" },
        ]);
        setIsLoading(true);
        setStreamingContent("");

        // 判断是编辑模式还是生成模式
        const hasSelection = selectionInfo && selectionInfo.count > 0;
        const isEditMode = hasSelection && detectEditIntent(userMessage);
        const isGlobalEditMode = !hasSelection && detectGlobalEditIntent(userMessage);

        if (isEditMode && editServiceRef.current) {
            // === 编辑模式（选中元素）===
            await handleEditMode(userMessage, aiMsgId);
        } else if (isGlobalEditMode && editServiceRef.current) {
            // === 全局编辑模式（未选中但要修改整个流程）===
            await handleGlobalEditMode(userMessage, aiMsgId);
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

    // 全局编辑模式处理（修改整个流程图）
    const handleGlobalEditMode = async (userMessage: string, aiMsgId: string) => {
        if (!editServiceRef.current) return;

        const allElements = getElements();

        // 获取所有形状元素
        const allShapes = allElements.filter(
            (el) => !el.isDeleted && (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond")
        );

        if (allShapes.length === 0) {
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === aiMsgId
                        ? { ...msg, content: "画布上没有可修改的元素", status: "error" }
                        : msg
                )
            );
            setIsLoading(false);
            return;
        }

        // 计算整体边界
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of allShapes) {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + (el.width || 0));
            maxY = Math.max(maxY, el.y + (el.height || 0));
        }

        // 构建全局编辑上下文
        const context: SelectionContext = {
            elementIds: allShapes.map(el => el.id),
            nodes: allShapes.map((el, idx) => ({
                id: el.id,
                type: el.type === "diamond" ? "decision" : el.type === "ellipse" ? "start" : "process",
                label: getShapeLabel(el, allElements),
                elementIds: [el.id],
                logicalPosition: { row: idx, column: 0 },
                position: { x: el.x, y: el.y, width: el.width || 150, height: el.height || 60 },
                properties: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
            } as ShadowNode)),
            relatedEdges: [],
            modules: [],
            bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
            description: `全局编辑：共 ${allShapes.length} 个节点: ${allShapes.map(el => getShapeLabel(el, allElements)).join(", ")}`,
            timestamp: Date.now(),
        };

        console.log("[GlobalEditMode] Context:", context.description);

        const result = await editServiceRef.current.edit(
            { instruction: userMessage, context },
            (tokens) => {
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMsgId
                            ? { ...msg, content: `正在分析全部节点... (~${tokens} tokens)` }
                            : msg
                    )
                );
            }
        );

        if (result.success) {
            // 应用编辑结果（使用全局形状列表）
            applyGlobalEditResult(result, allShapes, allElements);
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === aiMsgId
                        ? { ...msg, content: result.explanation, status: "success" }
                        : msg
                )
            );
        } else {
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === aiMsgId
                        ? { ...msg, content: result.error || "全局编辑失败", status: "error" }
                        : msg
                )
            );
        }

        setIsLoading(false);
        setStreamingContent("");
        setTimeout(scrollToBottom, 100);
    };

    // 应用全局编辑结果
    const applyGlobalEditResult = (
        result: IncrementalEditResult,
        allShapes: ExcalidrawElement[],
        allElements: readonly ExcalidrawElement[]
    ) => {
        let newElements = [...allElements];

        // 修改节点文字
        if (result.nodesToUpdate.length > 0) {
            for (let idx = 0; idx < result.nodesToUpdate.length; idx++) {
                const update = result.nodesToUpdate[idx];

                // 找到目标形状
                let targetShape: ExcalidrawElement | undefined;

                // 1. 尝试 ID 匹配
                targetShape = allShapes.find(el => el.id === update.id);

                // 2. 尝试按索引匹配
                if (!targetShape && idx < allShapes.length) {
                    targetShape = allShapes[idx];
                }

                if (targetShape && update.changes.label) {
                    // 查找绑定的文本元素
                    let textIndex = newElements.findIndex(
                        el => el.type === "text" && (el as { containerId?: string }).containerId === targetShape!.id
                    );

                    if (textIndex === -1 && targetShape.boundElements) {
                        const boundTextRef = targetShape.boundElements.find((b: { type: string }) => b.type === "text");
                        if (boundTextRef) {
                            textIndex = newElements.findIndex(el => el.id === boundTextRef.id);
                        }
                    }

                    if (textIndex === -1) {
                        const groupId = targetShape.groupIds?.[0];
                        if (groupId) {
                            textIndex = newElements.findIndex(el => el.type === "text" && el.groupIds?.includes(groupId));
                        }
                    }

                    if (textIndex !== -1) {
                        console.log("[GlobalEdit] Updating node:", getShapeLabel(targetShape, allElements), "->", update.changes.label);

                        // 使用尺寸计算更新
                        const shapeIndex = newElements.findIndex(el => el.id === targetShape!.id);
                        const { text: updatedText, container: updatedContainer } = updateTextDimensions(
                            newElements[textIndex],
                            update.changes.label,
                            shapeIndex !== -1 ? newElements[shapeIndex] : undefined
                        );

                        newElements[textIndex] = updatedText;
                        if (updatedContainer && shapeIndex !== -1) {
                            newElements[shapeIndex] = updatedContainer;
                        }
                    }
                }
            }
        }

        // 修改连线文字（如果有 edgesToUpdate）
        if (result.edgesToUpdate && result.edgesToUpdate.length > 0) {
            const arrowLabels = getArrowLabels(newElements);

            for (let idx = 0; idx < result.edgesToUpdate.length; idx++) {
                const edgeUpdate = result.edgesToUpdate[idx];
                if (!edgeUpdate.changes?.label) continue;

                // 找到对应的箭头
                let targetArrow = arrowLabels.find(a => a.arrow.id === edgeUpdate.id);

                // 按索引匹配
                if (!targetArrow && idx < arrowLabels.length) {
                    targetArrow = arrowLabels[idx];
                }

                if (targetArrow?.textEl) {
                    console.log("[GlobalEdit] Updating edge:", targetArrow.label, "->", edgeUpdate.changes.label);
                    const textIndex = newElements.findIndex(el => el.id === targetArrow!.textEl!.id);
                    if (textIndex !== -1) {
                        const { text: updatedText } = updateTextDimensions(
                            newElements[textIndex],
                            edgeUpdate.changes.label
                        );
                        newElements[textIndex] = updatedText;
                    }
                }
            }
        }

        // 如果没有 edgesToUpdate 但有全局翻译意图，尝试同步翻译所有连线文字
        // 通过检查 nodesToUpdate 中的变化模式来推断翻译
        if ((!result.edgesToUpdate || result.edgesToUpdate.length === 0) && result.nodesToUpdate.length > 0) {
            const arrowLabels = getArrowLabels(newElements).filter(a => a.label);

            if (arrowLabels.length > 0) {
                // 检查是否是翻译场景（中->英 或 英->中）
                const firstUpdate = result.nodesToUpdate[0];
                const originalLabel = getShapeLabel(allShapes[0], allElements);
                const isChineseToEnglish = /[\u4e00-\u9fa5]/.test(originalLabel) && !/[\u4e00-\u9fa5]/.test(firstUpdate.changes.label || "");
                const isEnglishToChinese = !/[\u4e00-\u9fa5]/.test(originalLabel) && /[\u4e00-\u9fa5]/.test(firstUpdate.changes.label || "");

                if (isChineseToEnglish || isEnglishToChinese) {
                    console.log("[GlobalEdit] Detected translation, also updating edge labels");
                    // 构建简单的翻译映射（基于已翻译的节点）
                    // 这里只是示例，实际可能需要调用 AI 翻译
                }
            }
        }

        updateScene({ elements: newElements });
        syncToDrawio(newElements);

        // 自动保存到当前文件
        if (currentFile) {
            autoSave(newElements as ExcalidrawElement[]);
        }
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

            // 创建带标签的形状列表，用于匹配
            const shapesWithLabels = selectedShapes.map(el => ({
                el,
                label: getShapeLabel(el, currentElements)
            }));

            // 调试日志：显示选中的形状及其标签
            console.log("[applyEditResult] Selected shapes:", shapesWithLabels.map(s => ({
                id: s.el.id,
                label: s.label
            })));
            console.log("[applyEditResult] Updates to apply:", result.nodesToUpdate);

            // 跟踪已经匹配的形状，避免重复匹配
            const matchedShapeIds = new Set<string>();

            for (let idx = 0; idx < result.nodesToUpdate.length; idx++) {
                const update = result.nodesToUpdate[idx];

                // ID 匹配或顺序匹配逻辑
                let targetElIndex = -1;
                let targetShape: ExcalidrawElement | undefined;

                // 1. 尝试直接 ID 匹配
                targetElIndex = newElements.findIndex(el => el.id === update.id);

                // 2. 如果是简化 ID（A, B, C...），按字母顺序映射到未匹配的形状
                if (targetElIndex === -1 && /^[A-Z]$/.test(update.id)) {
                    const letterIdx = update.id.charCodeAt(0) - 65; // A=0, B=1...
                    // 找到第 letterIdx 个未匹配的形状
                    let count = 0;
                    for (const s of shapesWithLabels) {
                        if (!matchedShapeIds.has(s.el.id)) {
                            if (count === letterIdx) {
                                targetShape = s.el;
                                targetElIndex = newElements.findIndex(el => el.id === targetShape!.id);
                                console.log(`[applyEditResult] Mapped ${update.id} -> shape[${letterIdx}]:`, s.label, targetShape?.id);
                                break;
                            }
                            count++;
                        }
                    }
                }

                // 3. 如果还是没找到，按顺序匹配选中的 Shape
                if (targetElIndex === -1 && idx < selectedShapes.length) {
                    // 找到第 idx 个未匹配的形状
                    let count = 0;
                    for (const s of shapesWithLabels) {
                        if (!matchedShapeIds.has(s.el.id)) {
                            if (count === idx) {
                                targetShape = s.el;
                                targetElIndex = newElements.findIndex(el => el.id === targetShape!.id);
                                console.log(`[applyEditResult] Fallback to idx ${idx}:`, s.label, targetShape?.id);
                                break;
                            }
                            count++;
                        }
                    }
                }

                // 标记已匹配
                if (targetShape) {
                    matchedShapeIds.add(targetShape.id);
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
                // 处理各种 ID 占位符映射到实际选中的元素 ID
                let sourceId = edge.sourceNodeId;
                let targetId = edge.targetNodeId;

                // 映射函数：将简化 ID 转换为实际元素 ID
                const mapToActualId = (id: string | undefined): string | undefined => {
                    if (!id) return undefined;

                    // selected-0, selected-1 占位符
                    if (id === "selected-0" && selectedShapes.length > 0) return selectedShapes[0].id;
                    if (id === "selected-1" && selectedShapes.length > 1) return selectedShapes[1].id;
                    if (id === "selected" && selectedShapes.length > 0) return selectedShapes[0].id;

                    // A, B, C... 简化 ID（按字母顺序映射到选中元素）
                    if (/^[A-Z]$/.test(id)) {
                        const idx = id.charCodeAt(0) - 65; // A=0, B=1, C=2...
                        if (idx < selectedShapes.length) return selectedShapes[idx].id;
                    }

                    // node-0, node-1... 数字索引
                    const nodeMatch = id.match(/^node-(\d+)$/);
                    if (nodeMatch) {
                        const idx = parseInt(nodeMatch[1], 10);
                        if (idx < selectedShapes.length) return selectedShapes[idx].id;
                    }

                    // 尝试直接作为实际 ID 使用
                    const existingEl = currentElements.find(el => el.id === id);
                    if (existingEl) return id;

                    return undefined;
                };

                sourceId = mapToActualId(sourceId);
                targetId = mapToActualId(targetId);

                console.log("[applyEditResult] Creating edge from", edge.sourceNodeId, "->", sourceId, "to", edge.targetNodeId, "->", targetId);

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

                        // 更新源和目标元素的 boundElements，使连线能跟随形状移动
                        const sourceIdx = newElements.findIndex(el => el.id === sourceId);
                        const targetIdx = newElements.findIndex(el => el.id === targetId);

                        if (sourceIdx !== -1) {
                            const sourceBoundElements = newElements[sourceIdx].boundElements || [];
                            newElements[sourceIdx] = {
                                ...newElements[sourceIdx],
                                boundElements: [...sourceBoundElements, { id: arrowId, type: "arrow" }],
                                version: (newElements[sourceIdx].version || 0) + 1,
                            };
                        }

                        if (targetIdx !== -1) {
                            const targetBoundElements = newElements[targetIdx].boundElements || [];
                            newElements[targetIdx] = {
                                ...newElements[targetIdx],
                                boundElements: [...targetBoundElements, { id: arrowId, type: "arrow" }],
                                version: (newElements[targetIdx].version || 0) + 1,
                            };
                        }

                        newElements = [...newElements, arrow];
                        console.log("Created arrow between", sourceId, "and", targetId, "with bindings");
                    }
                }
            }
        }

        updateScene({ elements: newElements });
        // 关键修复：显式触发同步，确保 Draw.io 数据是最新的
        syncToDrawio(newElements);

        // 自动保存到当前文件
        if (currentFile) {
            autoSave(newElements as ExcalidrawElement[]);
        }
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

        // 第二遍：收集所有边（箭头）及其标签
        for (const el of elements) {
            if (el.isDeleted) continue;

            if (el.type === "arrow" && el.startBinding && el.endBinding) {
                // 尝试获取箭头上的文本标签
                let edgeLabel = "";

                // 方式1：通过 containerId 查找
                const boundTextEl = elements.find(
                    (e) => e.type === "text" && e.containerId === el.id
                );
                if (boundTextEl?.text) {
                    edgeLabel = boundTextEl.text;
                }

                // 方式2：通过 boundElements 查找
                if (!edgeLabel && el.boundElements) {
                    const boundTextRef = el.boundElements.find((b: { type: string }) => b.type === "text");
                    if (boundTextRef) {
                        const textEl = elements.find((e) => e.id === boundTextRef.id);
                        if (textEl?.text) {
                            edgeLabel = textEl.text;
                        }
                    }
                }

                edges.push({
                    id: el.id,
                    source: el.startBinding.elementId,
                    target: el.endBinding.elementId,
                    label: edgeLabel,
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
        // 使用 Mermaid prompt 替代 JSON prompt
        const prompt = buildMermaidPrompt(userMessage, diagramType);

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

                                // 自动保存到当前文件
                                if (currentFile) {
                                    autoSave(allElements);
                                }

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

                        const allElements = [...currentElements, ...adjustedElements];
                        updateScene({ elements: allElements });

                        // 同步生成 Draw.io XML
                        setDrawioXml(generateDrawioXml(diagramData));

                        // 自动保存到当前文件
                        if (currentFile) {
                            autoSave(allElements);
                        }

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

    // 手动清空对话
    const handleClearConversation = () => {
        setMessages([]);
        conversationHistoryRef.current = createConversationHistory();
    };

    return (
        <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-white">AI 助手</h2>
                    {messages.length > 0 && (
                        <button
                            onClick={handleClearConversation}
                            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                            title="清空对话"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
                {currentFile && (
                    <p className="text-xs text-blue-400 mt-1 truncate" title={currentFile.name}>
                        {currentFile.name}
                    </p>
                )}
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
