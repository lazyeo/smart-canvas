/**
 * 系统级 Claude API 代理
 * 提供限流功能，允许未配置 API Key 的用户试用
 */

import { NextRequest, NextResponse } from "next/server";

// 每日使用记录（内存存储）
// 注意：服务重启后会重置，生产环境可考虑使用 Redis/KV
const usageMap = new Map<string, { count: number; date: string }>();

// 从环境变量获取配置
const SYSTEM_API_KEY = process.env.SYSTEM_CLAUDE_API_KEY || "";
const SYSTEM_BASE_URL = process.env.SYSTEM_CLAUDE_BASE_URL || "https://api.anthropic.com";
const SYSTEM_MODEL = process.env.SYSTEM_CLAUDE_MODEL || "claude-sonnet-4-20250514";
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY || "3", 10);

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
 * 获取用户标识符
 * 组合 IP 地址和设备指纹
 */
function getUserId(request: NextRequest, fingerprint: string): string {
    // 获取真实 IP（考虑反向代理）
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

    // 组合 IP 和指纹生成用户标识
    return `${ip}_${fingerprint}`;
}

/**
 * 检查并更新使用次数
 * 返回是否允许继续使用
 */
function checkAndUpdateUsage(userId: string): { allowed: boolean; remaining: number } {
    const today = new Date().toISOString().split("T")[0];
    const usage = usageMap.get(userId);

    if (!usage || usage.date !== today) {
        // 新的一天或新用户
        usageMap.set(userId, { count: 1, date: today });
        return { allowed: true, remaining: RATE_LIMIT - 1 };
    }

    if (usage.count >= RATE_LIMIT) {
        return { allowed: false, remaining: 0 };
    }

    usage.count++;
    return { allowed: true, remaining: RATE_LIMIT - usage.count };
}

/**
 * 获取剩余使用次数（不消耗）
 */
function getRemainingUsage(userId: string): number {
    const today = new Date().toISOString().split("T")[0];
    const usage = usageMap.get(userId);

    if (!usage || usage.date !== today) {
        return RATE_LIMIT;
    }

    return Math.max(0, RATE_LIMIT - usage.count);
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
        const { messages, fingerprint = "unknown", temperature = 0.7, maxTokens = 4096 } = body;

        if (!messages || messages.length === 0) {
            return NextResponse.json(
                { error: "消息不能为空", code: "EMPTY_MESSAGES" },
                { status: 400 }
            );
        }

        // 获取用户标识并检查使用限制
        const userId = getUserId(request, fingerprint);
        const { allowed, remaining } = checkAndUpdateUsage(userId);

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

    const fingerprint = request.nextUrl.searchParams.get("fingerprint") || "unknown";
    const userId = getUserId(request, fingerprint);
    const remaining = getRemainingUsage(userId);

    return NextResponse.json({
        available: true,
        remaining,
        limit: RATE_LIMIT,
    });
}
