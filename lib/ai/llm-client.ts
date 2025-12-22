/**
 * LLM 客户端 - 支持多 Provider
 * OpenAI, Anthropic, Gemini 统一接口
 */

import { getActiveApiKey, LLMProvider } from "@/lib/storage";

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

// 默认模型配置
const DEFAULT_MODELS: Record<LLMProvider, string> = {
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-20241022",
    gemini: "gemini-1.5-pro",
};

/**
 * 调用 OpenAI 兼容 API
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
 * 调用 Anthropic API
 */
async function callAnthropic(
    messages: LLMMessage[],
    apiKey: string,
    baseUrl: string,
    options: LLMOptions
): Promise<LLMResponse> {
    // 分离 system 消息
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
 * 调用 Google Gemini API
 */
async function callGemini(
    messages: LLMMessage[],
    apiKey: string,
    baseUrl: string,
    options: LLMOptions
): Promise<LLMResponse> {
    const model = options.model || DEFAULT_MODELS.gemini;

    // 转换消息格式
    const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

    // system 消息作为第一条 user 消息的前缀
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
 * 统一的 LLM 调用接口
 */
export async function chat(
    messages: LLMMessage[],
    options: LLMOptions = {}
): Promise<LLMResponse> {
    const activeKey = getActiveApiKey();
    if (!activeKey) {
        throw new Error("未配置 API Key，请在设置中添加");
    }

    const { provider, key, baseUrl, model } = activeKey;

    // 使用配置中的模型，除非 options 中显式指定
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
