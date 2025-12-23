"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useCanvas } from "@/contexts";
import {
    SelectionContextService,
    createSelectionContextService,
    IncrementalEditService,
    createIncrementalEditService,
    IncrementalEditRequest,
    IncrementalEditResult,
    SelectionContext,
    generateExcalidrawElements,
} from "@/lib/ai";
import { getActiveApiKey } from "@/lib/storage";
import { ShadowNode, ShadowEdge } from "@/types";

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
    nodes: ShadowNode[];
    edges: ShadowEdge[];
}

export function EditModePanel({ isVisible, onClose, nodes, edges }: EditModePanelProps) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<EditMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentContext, setCurrentContext] = useState<SelectionContext | null>(null);
    const [estimatedTokens, setEstimatedTokens] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { updateScene, getElements, selectedElementIds } = useCanvas();

    // 服务实例
    const selectionServiceRef = useRef<SelectionContextService | null>(null);
    const editServiceRef = useRef<IncrementalEditService | null>(null);

    // 初始化服务
    useEffect(() => {
        if (!selectionServiceRef.current) {
            selectionServiceRef.current = createSelectionContextService();
        }
        if (!editServiceRef.current) {
            editServiceRef.current = createIncrementalEditService();
        }
    }, []);

    // 更新影子数据
    useEffect(() => {
        if (selectionServiceRef.current) {
            selectionServiceRef.current.updateShadowData(nodes, edges, []);
        }
    }, [nodes, edges]);

    // 监听选中变化
    useEffect(() => {
        if (selectionServiceRef.current && selectedElementIds.length > 0) {
            const elements = getElements();
            const context = selectionServiceRef.current.handleSelectionChange(
                selectedElementIds,
                elements
            );
            setCurrentContext(context);
        } else {
            setCurrentContext(null);
        }
    }, [selectedElementIds, getElements]);

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
        if (input.trim() === "" || isLoading || !currentContext) {
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

        // 检查 API Key
        const apiKey = getActiveApiKey();
        if (!apiKey) {
            setMessages((prev) => [
                ...prev,
                {
                    id: `edit-msg-${Date.now()}`,
                    role: "ai",
                    content: "请先在设置中配置 API Key",
                    status: "error",
                },
            ]);
            return;
        }

        // 添加 AI 消息占位
        const aiMsgId = `edit-msg-${Date.now() + 1}`;
        setMessages((prev) => [
            ...prev,
            { id: aiMsgId, role: "ai", content: "正在分析...", status: "streaming" },
        ]);
        setIsLoading(true);
        setEstimatedTokens(0);

        // 构建编辑请求
        const request: IncrementalEditRequest = {
            instruction: userMessage,
            context: currentContext,
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
                applyChanges(result);

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

    const applyChanges = (result: IncrementalEditResult) => {
        const currentElements = getElements();
        let newElements = [...currentElements];

        // 处理新增节点
        if (result.nodesToAdd.length > 0) {
            const diagramData = {
                nodes: result.nodesToAdd.map((n) => ({
                    id: n.id || `node-${Date.now()}`,
                    type: n.type || "process",
                    label: n.label || "新节点",
                    row: n.logicalPosition?.row || 0,
                    column: n.logicalPosition?.column || 0,
                })),
                edges: [],
            };
            const { elements } = generateExcalidrawElements(diagramData);
            newElements = [...newElements, ...elements];
        }

        // 处理新增连线
        if (result.edgesToAdd.length > 0) {
            // 获取节点位置信息
            const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
            for (const node of [...nodes, ...result.nodesToAdd as ShadowNode[]]) {
                if (node.position) {
                    nodePositions.set(node.id, node.position);
                }
            }

            const diagramData = {
                nodes: [],
                edges: result.edgesToAdd.map((e) => ({
                    id: e.id || `edge-${Date.now()}`,
                    source: e.sourceNodeId || "",
                    target: e.targetNodeId || "",
                    label: e.label,
                })),
            };
            // 连线需要节点位置，这里简化处理
        }

        // 处理删除
        if (result.nodesToDelete.length > 0 || result.edgesToDelete.length > 0) {
            const deleteNodeIds = new Set(result.nodesToDelete);
            const deleteEdgeIds = new Set(result.edgesToDelete);

            // 找到关联的元素 ID
            const elementIdsToDelete = new Set<string>();
            for (const node of nodes) {
                if (deleteNodeIds.has(node.id)) {
                    node.elementIds.forEach((id) => elementIdsToDelete.add(id));
                }
            }
            for (const edge of edges) {
                if (deleteEdgeIds.has(edge.id)) {
                    elementIdsToDelete.add(edge.elementId);
                }
            }

            newElements = newElements.filter((el) => !elementIdsToDelete.has(el.id));
        }

        // 更新画布
        updateScene({ elements: newElements });
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="absolute top-16 right-4 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl flex flex-col max-h-[70vh] z-50">
            {/* 头部 */}
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-white">增量编辑模式</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {currentContext
                            ? `已选中 ${currentContext.nodes.length} 个节点`
                            : "请先选中要编辑的元素"}
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
            {currentContext && currentContext.nodes.length > 0 && (
                <div className="p-3 border-b border-slate-700 bg-slate-800/50">
                    <div className="text-xs text-slate-400 mb-2">选中的节点:</div>
                    <div className="flex flex-wrap gap-1">
                        {currentContext.nodes.map((node) => (
                            <span
                                key={node.id}
                                className="px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded text-xs"
                            >
                                {node.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">
                        {currentContext
                            ? '输入编辑指令，如"修改标签为XXX"'
                            : "选中画布上的元素后开始编辑"}
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
                        placeholder={currentContext ? "输入编辑指令..." : "请先选中元素"}
                        disabled={isLoading || !currentContext}
                        className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || input.trim() === "" || !currentContext}
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
