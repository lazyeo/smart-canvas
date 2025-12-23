"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import { useCanvas } from "@/contexts";
import {
    chatStream,
    SYSTEM_PROMPT,
    buildDiagramPrompt,
    parseDiagramJSON,
    generateExcalidrawElements,
    DiagramType,
} from "@/lib/ai";
import { getActiveApiKey } from "@/lib/storage";

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
        };
    }, [selectedElementIds, getElements]);

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

        // 检测图表类型
        const diagramType = detectDiagramType(userMessage);
        const prompt = buildDiagramPrompt(userMessage, diagramType);

        // 流式调用 LLM
        await chatStream(
            [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt },
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
                onComplete: (fullContent) => {
                    // 输出标军。
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
