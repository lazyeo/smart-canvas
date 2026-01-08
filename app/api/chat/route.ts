/**
 * 系统级 Claude API 代理
 * 提供限流功能，允许未配置 API Key 的用户试用
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

// 每日限制
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY || "3", 10);
// 系统配置
const SYSTEM_API_KEY = process.env.SYSTEM_CLAUDE_API_KEY || "";
const SYSTEM_BASE_URL = process.env.SYSTEM_CLAUDE_BASE_URL || "https://api.anthropic.com";
const SYSTEM_MODEL = process.env.SYSTEM_CLAUDE_MODEL || "claude-sonnet-4-20250514";

// Cookie 配置
const COOKIE_NAME = "sc_usage";
const COOKIE_SECRET = SYSTEM_API_KEY || "fallback_secret_key_for_dev"; // 使用 API Key 作为签名密钥

interface UsageData {
    count: number;
    date: string;
}

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface ChatRequest {
    messages: ChatMessage[];
    fingerprint?: string;
    temperature?: number;
    maxTokens?: number;
}

/**
 * 生成签名
 */
function sign(data: string): string {
    return createHmac("sha256", COOKIE_SECRET).update(data).digest("hex");
}

/**
 * 验证签名并解析数据
 */
function verifyAndParse(value: string): UsageData | null {
    try {
        const [data, signature] = value.split(".");
        if (!data || !signature) return null;

        const expectedSignature = sign(data);
        if (signature !== expectedSignature) return null;

        const decoded = Buffer.from(data, "base64").toString();
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

/**
 * 编码并签名数据
 */
function encodeAndSign(usage: UsageData): string {
    const json = JSON.stringify(usage);
    const data = Buffer.from(json).toString("base64");
    const signature = sign(data);
    return `${data}.${signature}`;
}

/**
 * 检查并更新使用次数 (基于 Cookie)
 */
function checkUsageFromCookie(request: NextRequest): { allowed: boolean; remaining: number; nextCookie: string } {
    const today = new Date().toISOString().split("T")[0];
    const cookieValue = request.cookies.get(COOKIE_NAME)?.value;

    let usage: UsageData = { count: 0, date: today };

    if (cookieValue) {
        const parsed = verifyAndParse(cookieValue);
        if (parsed && parsed.date === today) {
            usage = parsed;
        }
    }

    const startCount = usage.count;

    if (startCount >= RATE_LIMIT) {
        return {
            allowed: false,
            remaining: 0,
            nextCookie: encodeAndSign({ count: startCount, date: today })
        };
    }

    const nextUsage = { count: startCount + 1, date: today };
    return {
        allowed: true,
        remaining: RATE_LIMIT - nextUsage.count,
        nextCookie: encodeAndSign(nextUsage)
    };
}

/**
 * 获取剩余次数 (只读)
 */
function getRemainingFromCookie(request: NextRequest): number {
    const today = new Date().toISOString().split("T")[0];
    const cookieValue = request.cookies.get(COOKIE_NAME)?.value;

    if (cookieValue) {
        const parsed = verifyAndParse(cookieValue);
        if (parsed && parsed.date === today) {
            return Math.max(0, RATE_LIMIT - parsed.count);
        }
    }

    return RATE_LIMIT;
}

/**
 * 调用 Anthropic API
 */
async function callAnthropic(
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number
): Promise<Response> {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const response = await fetch(`${SYSTEM_BASE_URL}/v1/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": SYSTEM_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: SYSTEM_MODEL,
            max_tokens: maxTokens,
            system: systemMessage?.content || "",
            messages: userMessages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
            })),
            stream: true,
        }),
    });

    return response;
}

/**
 * POST /api/chat
 * 处理聊天请求
 */
export async function POST(request: NextRequest) {
    // 检查系统 API Key 是否配置
    if (!SYSTEM_API_KEY) {
        return NextResponse.json(
            { error: "系统 API 未配置", code: "SYSTEM_API_NOT_CONFIGURED" },
            { status: 503 }
        );
    }

    try {
        const body: ChatRequest = await request.json();
        const { messages, temperature = 0.7, maxTokens = 4096 } = body;

        if (!messages || messages.length === 0) {
            return NextResponse.json(
                { error: "消息不能为空", code: "EMPTY_MESSAGES" },
                { status: 400 }
            );
        }

        // 检查使用限制 (Cookie)
        const { allowed, remaining, nextCookie } = checkUsageFromCookie(request);

        if (!allowed) {
            return NextResponse.json(
                {
                    error: `今日免费试用次数已用完（${RATE_LIMIT}次/天）。请配置您自己的 API Key 以继续使用。`,
                    code: "RATE_LIMIT_EXCEEDED",
                    remaining: 0,
                    limit: RATE_LIMIT,
                },
                { status: 429 }
            );
        }

        // 调用 Anthropic API 并转发流式响应
        const response = await callAnthropic(messages, temperature, maxTokens);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Anthropic API error:", errorText);
            return NextResponse.json(
                { error: "AI 服务暂时不可用，请稍后重试", code: "UPSTREAM_ERROR" },
                { status: 502 }
            );
        }

        // 创建流式响应
        const headers = new Headers();
        headers.set("Content-Type", "text/event-stream");
        headers.set("Cache-Control", "no-cache");
        headers.set("Connection", "keep-alive");
        headers.set("X-Remaining-Usage", String(remaining));
        headers.set("X-Rate-Limit", String(RATE_LIMIT));

        // 设置 Cookie
        headers.append("Set-Cookie", `${COOKIE_NAME}=${nextCookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);

        // 直接转发上游的流式响应
        return new Response(response.body, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json(
            { error: "请求处理失败", code: "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/chat
 * 获取当前用户的剩余使用次数
 */
export async function GET(request: NextRequest) {
    if (!SYSTEM_API_KEY) {
        return NextResponse.json({
            available: false,
            reason: "SYSTEM_API_NOT_CONFIGURED",
        });
    }

    const remaining = getRemainingFromCookie(request);

    return NextResponse.json({
        available: true,
        remaining,
        limit: RATE_LIMIT,
    });
}
