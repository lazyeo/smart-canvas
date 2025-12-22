"use client";

import React from "react";

interface CanvasContainerProps {
    children?: React.ReactNode;
}

export function CanvasContainer({ children }: CanvasContainerProps) {
    return (
        <div className="flex-1 bg-slate-100 relative overflow-hidden">
            {children ? (
                children
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-slate-500">
                        <svg
                            className="w-16 h-16 mx-auto mb-4 text-slate-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                        <p className="text-lg font-medium mb-2">画布区域</p>
                        <p className="text-sm">在右侧输入描述，让 AI 为您生成图表</p>
                    </div>
                </div>
            )}
        </div>
    );
}
