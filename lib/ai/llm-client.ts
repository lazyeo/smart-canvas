/**
 * LLM 客户端 - 支持多 Provider 和流式输出
 * OpenAI, Anthropic, Gemini 统一接口
 */

import { getActiveApiKey, LLMProvider } from "@/lib/storage";
import { getFingerprint } from "@/lib/utils/fingerprint";

export interface LLMMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface LLMOptions {
    temperature?: number;
    maxTokens?: number;
    model?: string;
}

export interface StreamCallbacks {
    onToken: (token: string, accumulated: string) => void;
    onComplete: (fullContent: string) => void;
    onError: (error: Error) => void;
}

// 默认模型配置
const DEFAULT_MODELS: Record<LLMProvider, string> = {
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-20241022",
    gemini: "gemini-1.5-pro",
};

/**
 * 流式调用 OpenAI 兼容 API
 */
async function streamOpenAI(
    messages: LLMMessage[],
    apiKey: string,
    baseUrl: string,
    options: LLMOptions,
    callbacks: StreamCallbacks
): Promise<void> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: options.model || DEFAULT_MODELS.openai,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
            stream: true,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let accumulated = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter((line) => line.trim() !== "");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    if (data === "[DONE]") continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || "";
                        if (content) {
                            accumulated += content;
                            callbacks.onToken(content, accumulated);
                        }
                    } catch {
                        // 忽略解析错误
                    }
                }
            }
        }
        callbacks.onComplete(accumulated);
    } catch (error) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * 流式调用 Anthropic API
 */
async function streamAnthropic(
    messages: LLMMessage[],
    apiKey: string,
    baseUrl: string,
    options: LLMOptions,
    callbacks: StreamCallbacks
): Promise<void> {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: options.model || DEFAULT_MODELS.anthropic,
            max_tokens: options.maxTokens ?? 4096,
            system: systemMessage?.content || "",
            messages: userMessages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
            })),
            stream: true,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let accumulated = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter((line) => line.trim() !== "");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.type === "content_block_delta") {
                            const content = parsed.delta?.text || "";
                            if (content) {
                                accumulated += content;
                                callbacks.onToken(content, accumulated);
                            }
                        }
                    } catch {
                        // 忽略解析错误
                    }
                }
            }
        }
        callbacks.onComplete(accumulated);
    } catch (error) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * 流式调用 Gemini API (Gemini 使用不同的流式格式)
 */
async function streamGemini(
    messages: LLMMessage[],
    apiKey: string,
    baseUrl: string,
    options: LLMOptions,
    callbacks: StreamCallbacks
): Promise<void> {
    const model = options.model || DEFAULT_MODELS.gemini;

    const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

    const systemMessage = messages.find((m) => m.role === "system");
    if (systemMessage && contents.length > 0 && contents[0].role === "user") {
        contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    const response = await fetch(
        `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: options.temperature ?? 0.7,
                    maxOutputTokens: options.maxTokens ?? 4096,
                },
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let accumulated = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter((line) => line.trim() !== "");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (content) {
                            accumulated += content;
                            callbacks.onToken(content, accumulated);
                        }
                    } catch {
                        // 忽略解析错误
                    }
                }
            }
        }
        callbacks.onComplete(accumulated);
    } catch (error) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * 非流式调用 OpenAI 兼容 API
 */
async function callOpenAI(
    messages: LLMMessage[],
    apiKey: string,
    baseUrl: string,
    options: LLMOptions
): Promise<LLMResponse> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: options.model || DEFAULT_MODELS.openai,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
        content: data.choices[0]?.message?.content || "",
        usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            }
            : undefined,
    };
}

/**
 * 非流式调用 Anthropic API
 */
async function callAnthropic(
    messages: LLMMessage[],
    apiKey: string,
    baseUrl: string,
    options: LLMOptions
): Promise<LLMResponse> {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: options.model || DEFAULT_MODELS.anthropic,
            max_tokens: options.maxTokens ?? 4096,
            system: systemMessage?.content || "",
            messages: userMessages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
            })),
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
        content: data.content?.[0]?.text || "",
        usage: data.usage
            ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            }
            : undefined,
    };
}

/**
 * 非流式调用 Gemini API
 */
async function callGemini(
    messages: LLMMessage[],
    apiKey: string,
    baseUrl: string,
    options: LLMOptions
): Promise<LLMResponse> {
    const model = options.model || DEFAULT_MODELS.gemini;

    const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

    const systemMessage = messages.find((m) => m.role === "system");
    if (systemMessage && contents.length > 0 && contents[0].role === "user") {
        contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    const response = await fetch(
        `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature: options.temperature ?? 0.7,
                    maxOutputTokens: options.maxTokens ?? 4096,
                },
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        usage: data.usageMetadata
            ? {
                promptTokens: data.usageMetadata.promptTokenCount || 0,
                completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount || 0,
            }
            : undefined,
    };
}

/**
 * 通过系统 API 代理进行流式调用（带限流）
 */
async function streamSystemApi(
    messages: LLMMessage[],
    options: LLMOptions,
    callbacks: StreamCallbacks
): Promise<void> {
    const fingerprint = getFingerprint();

    const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messages,
            fingerprint,
            temperature: options.temperature ?? 0.7,
            maxTokens: options.maxTokens ?? 4096,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "请求失败" }));
        if (response.status === 429) {
            throw new Error(errorData.error || "今日免费试用次数已用完，请配置您自己的 API Key");
        }
        throw new Error(errorData.error || `系统 API 错误: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let accumulated = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter((line) => line.trim() !== "");

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6);
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.type === "content_block_delta") {
                            const content = parsed.delta?.text || "";
                            if (content) {
                                accumulated += content;
                                callbacks.onToken(content, accumulated);
                            }
                        }
                    } catch {
                        // 忽略解析错误
                    }
                }
            }
        }
        callbacks.onComplete(accumulated);
    } catch (error) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * 通过系统 API 代理进行非流式调用（带限流）
 */
async function callSystemApi(
    messages: LLMMessage[],
    options: LLMOptions
): Promise<LLMResponse> {
    const fingerprint = getFingerprint();

    // 先检查是否有剩余次数
    const checkResponse = await fetch(`/api/chat?fingerprint=${fingerprint}`);
    const checkData = await checkResponse.json();

    if (!checkData.available) {
        throw new Error("系统试用 API 未配置，请配置您自己的 API Key");
    }

    if (checkData.remaining <= 0) {
        throw new Error(`今日免费试用次数已用完（${checkData.limit}次/天），请配置您自己的 API Key`);
    }

    // 调用流式 API 并收集完整响应
    return new Promise((resolve, reject) => {
        let fullContent = "";

        streamSystemApi(messages, options, {
            onToken: (_, accumulated) => {
                fullContent = accumulated;
            },
            onComplete: (content) => {
                resolve({ content });
            },
            onError: (error) => {
                reject(error);
            },
        });
    });
}

/**
 * 检查系统 API 是否可用及剩余次数
 */
export async function checkSystemApiStatus(): Promise<{
    available: boolean;
    remaining: number;
    limit: number;
}> {
    try {
        const fingerprint = getFingerprint();
        const response = await fetch(`/api/chat?fingerprint=${fingerprint}`);
        return await response.json();
    } catch {
        return { available: false, remaining: 0, limit: 0 };
    }
}

/**
 * 统一的流式 LLM 调用接口
 * 当用户未配置 API Key 时，自动使用系统代理（带限流）
 */
export async function chatStream(
    messages: LLMMessage[],
    callbacks: StreamCallbacks,
    options: LLMOptions = {}
): Promise<void> {
    const activeKey = getActiveApiKey();

    // 如果用户没有配置 API Key，使用系统 API
    if (!activeKey) {
        try {
            await streamSystemApi(messages, options, callbacks);
        } catch (error) {
            callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
        return;
    }

    const { provider, key, baseUrl, model } = activeKey;

    const finalOptions = {
        ...options,
        model: options.model || model,
    };

    switch (provider) {
        case "openai":
            return streamOpenAI(messages, key, baseUrl, finalOptions, callbacks);
        case "anthropic":
            return streamAnthropic(messages, key, baseUrl, finalOptions, callbacks);
        case "gemini":
            return streamGemini(messages, key, baseUrl, finalOptions, callbacks);
        default:
            callbacks.onError(new Error(`不支持的 Provider: ${provider}`));
    }
}

/**
 * 统一的非流式 LLM 调用接口
 * 当用户未配置 API Key 时，自动使用系统代理（带限流）
 */
export async function chat(
    messages: LLMMessage[],
    options: LLMOptions = {}
): Promise<LLMResponse> {
    const activeKey = getActiveApiKey();

    // 如果用户没有配置 API Key，使用系统 API
    if (!activeKey) {
        return callSystemApi(messages, options);
    }

    const { provider, key, baseUrl, model } = activeKey;

    const finalOptions = {
        ...options,
        model: options.model || model,
    };

    switch (provider) {
        case "openai":
            return callOpenAI(messages, key, baseUrl, finalOptions);
        case "anthropic":
            return callAnthropic(messages, key, baseUrl, finalOptions);
        case "gemini":
            return callGemini(messages, key, baseUrl, finalOptions);
        default:
            throw new Error(`不支持的 Provider: ${provider}`);
    }
}

/**
 * 简化的单轮对话接口
 */
export async function ask(
    prompt: string,
    systemPrompt?: string,
    options: LLMOptions = {}
): Promise<string> {
    const messages: LLMMessage[] = [];

    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await chat(messages, options);
    return response.content;
}
