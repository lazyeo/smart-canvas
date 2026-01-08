/**
 * 获取系统配置的 API
 */

import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        rateLimit: parseInt(process.env.RATE_LIMIT_PER_DAY || "3", 10),
    });
}
