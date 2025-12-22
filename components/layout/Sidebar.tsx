"use client";

import React from "react";

interface SidebarProps {
    children?: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
    return (
        <aside className="w-16 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-4 gap-2">
            <SidebarButton icon="pencil" title="绘图" active />
            <SidebarButton icon="shapes" title="形状" />
            <SidebarButton icon="arrow" title="连线" />
            <SidebarButton icon="text" title="文本" />

            <div className="flex-1" />

            <SidebarButton icon="history" title="历史" />
            <SidebarButton icon="layers" title="图层" />

            {children}
        </aside>
    );
}

interface SidebarButtonProps {
    icon: "pencil" | "shapes" | "arrow" | "text" | "history" | "layers";
    title: string;
    active?: boolean;
    onClick?: () => void;
}

function SidebarButton({ icon, title, active, onClick }: SidebarButtonProps) {
    const iconMap = {
        pencil: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
        ),
        shapes: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
        ),
        arrow: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
        ),
        text: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16m-7 6h7"
            />
        ),
        history: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        ),
        layers: (
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
        ),
    };

    return (
        <button
            onClick={onClick}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${active
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
            title={title}
        >
            <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                {iconMap[icon]}
            </svg>
        </button>
    );
}
