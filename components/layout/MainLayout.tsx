"use client";

import React from "react";
import { Header } from "./Header";
import { CanvasContainer } from "./CanvasContainer";
import { ChatPanel } from "./ChatPanel";

interface MainLayoutProps {
    children?: React.ReactNode;
    onSettingsClick?: () => void;
}

export function MainLayout({
    children,
    onSettingsClick,
}: MainLayoutProps) {
    return (
        <div className="h-screen flex flex-col bg-slate-900">
            <Header onSettingsClick={onSettingsClick} />

            <div className="flex-1 flex overflow-hidden">
                <CanvasContainer>{children}</CanvasContainer>
                <ChatPanel />
            </div>
        </div>
    );
}
