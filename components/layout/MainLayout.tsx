"use client";

import React from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { CanvasContainer } from "./CanvasContainer";
import { ChatPanel } from "./ChatPanel";

interface MainLayoutProps {
    children?: React.ReactNode;
    onSettingsClick?: () => void;
    onEditModeClick?: () => void;
    isEditMode?: boolean;
    showSettings?: boolean;
}

export function MainLayout({
    children,
    onSettingsClick,
    onEditModeClick,
    isEditMode,
}: MainLayoutProps) {
    return (
        <div className="h-screen flex flex-col bg-slate-900">
            <Header
                onSettingsClick={onSettingsClick}
                onEditModeClick={onEditModeClick}
                isEditMode={isEditMode}
            />

            <div className="flex-1 flex overflow-hidden">
                <Sidebar />
                <CanvasContainer>{children}</CanvasContainer>
                <ChatPanel />
            </div>
        </div>
    );
}
