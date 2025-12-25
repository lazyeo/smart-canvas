/**
 * 对话历史管理
 * - 保留最近 N 轮对话
 * - 超出后自动摘要压缩
 */

import { LLMMessage } from "./llm-client";

export interface ConversationMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

export interface ConversationHistory {
    messages: ConversationMessage[];
    summary: string | null;
}

// 配置
const MAX_RECENT_TURNS = 5;  // 保留最近 5 轮（10 条消息）
const MAX_MESSAGES = MAX_RECENT_TURNS * 2;

/**
 * 创建新的对话历史
 */
export function createConversationHistory(): ConversationHistory {
    return {
        messages: [],
        summary: null,
    };
}

/**
 * 添加消息到历史
 */
export function addMessage(
    history: ConversationHistory,
    role: "user" | "assistant",
    content: string
): ConversationHistory {
    const newMessage: ConversationMessage = {
        role,
        content,
        timestamp: Date.now(),
    };

    const newMessages = [...history.messages, newMessage];

    // 如果超出限制，需要压缩
    if (newMessages.length > MAX_MESSAGES) {
        // 保留最近的消息，将旧消息加入待摘要
        const toSummarize = newMessages.slice(0, newMessages.length - MAX_MESSAGES);
        const recentMessages = newMessages.slice(-MAX_MESSAGES);

        // 生成摘要文本（同步版本，只是合并）
        const summaryText = summarizeMessages(toSummarize, history.summary);

        return {
            messages: recentMessages,
            summary: summaryText,
        };
    }

    return {
        ...history,
        messages: newMessages,
    };
}

/**
 * 同步摘要消息（简单版本）
 */
function summarizeMessages(
    messages: ConversationMessage[],
    existingSummary: string | null
): string {
    const parts: string[] = [];

    if (existingSummary) {
        parts.push(existingSummary);
    }

    // 提取关键操作
    for (const msg of messages) {
        if (msg.role === "user") {
            // 用户请求简化
            const simplified = msg.content.length > 50
                ? msg.content.substring(0, 50) + "..."
                : msg.content;
            parts.push(`用户: ${simplified}`);
        } else {
            // AI 响应只保留结果
            if (msg.content.includes("已生成") || msg.content.includes("已修改")) {
                parts.push(`AI: ${msg.content.substring(0, 30)}`);
            }
        }
    }

    return parts.join("\n");
}

/**
 * 将历史转换为 LLM 消息格式
 */
export function historyToMessages(history: ConversationHistory): LLMMessage[] {
    const messages: LLMMessage[] = [];

    // 添加摘要（如果有）
    if (history.summary) {
        messages.push({
            role: "user",
            content: `[对话历史摘要]\n${history.summary}`,
        });
        messages.push({
            role: "assistant",
            content: "我了解之前的对话内容，请继续。",
        });
    }

    // 添加最近消息
    for (const msg of history.messages) {
        messages.push({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content,
        });
    }

    return messages;
}

/**
 * 获取历史消息数量
 */
export function getMessageCount(history: ConversationHistory): number {
    return history.messages.length;
}

/**
 * 是否有摘要
 */
export function hasSummary(history: ConversationHistory): boolean {
    return history.summary !== null;
}

/**
 * 清空历史
 */
export function clearHistory(): ConversationHistory {
    return createConversationHistory();
}
