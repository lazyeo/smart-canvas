"use client";

import React, { useState } from "react";

interface ChatPanelProps {
    onSendMessage?: (message: string) => void;
}

export function ChatPanel({ onSendMessage }: ChatPanelProps) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; content: string }>>([]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() === "") {
            return;
        }

        setMessages((prev) => [...prev, { role: "user", content: input }]);

        if (onSendMessage) {
            onSendMessage(input);
        }

        // 模拟 AI 响应
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: "收到您的请求，正在处理中..." },
            ]);
        }, 500);

        setInput("");
    };

    return (
        <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700">
                <h2 className="text-sm font-medium text-white">AI 助手</h2>
                <p className="text-xs text-slate-400 mt-1">描述您想要的图表，AI 将为您生成</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-slate-500 text-sm">
                            开始对话，描述您想要绘制的图表
                        </p>
                        <div className="mt-4 space-y-2">
                            <SuggestionButton text="画一个用户登录流程图" onClick={setInput} />
                            <SuggestionButton text="创建一个微服务架构图" onClick={setInput} />
                            <SuggestionButton text="设计一个数据库 ER 图" onClick={setInput} />
                        </div>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === "user"
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-800 text-slate-200"
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="描述您想要的图表..."
                        className="flex-1 bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 placeholder-slate-500"
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors"
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
