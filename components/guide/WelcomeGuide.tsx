"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

const WELCOME_GUIDE_KEY = "smartcanvas_welcome_dismissed";

interface WelcomeGuideProps {
    onClose?: () => void;
}

export function WelcomeGuide({ onClose }: WelcomeGuideProps) {
    const [isVisible, setIsVisible] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        const dismissed = localStorage.getItem(WELCOME_GUIDE_KEY);
        if (!dismissed) {
            setIsVisible(true);
        }
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        if (onClose) {
            onClose();
        }
    };

    const handleDontShowAgain = () => {
        localStorage.setItem(WELCOME_GUIDE_KEY, "true");
        handleClose();
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="p-6 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white">
                        {t("welcome.title")}
                    </h2>
                    <p className="text-slate-400 mt-1 text-sm">
                        {t("welcome.subtitle")}
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <FeatureItem
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        }
                        title={t("welcome.features.aiGenerate.title")}
                        description={t("welcome.features.aiGenerate.description")}
                    />

                    <FeatureItem
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        }
                        title={t("welcome.features.selectEdit.title")}
                        description={t("welcome.features.selectEdit.description")}
                    />

                    <FeatureItem
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                            </svg>
                        }
                        title={t("welcome.features.autoLayout.title")}
                        description={t("welcome.features.autoLayout.description")}
                    />

                    <div className="bg-slate-900/50 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-slate-300 mb-2">{t("welcome.shortcuts")}</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <KeyboardShortcut keys={["Ctrl", "Z"]} action={t("welcome.undo")} />
                            <KeyboardShortcut keys={["Ctrl", "Shift", "Z"]} action={t("welcome.redo")} />
                            <KeyboardShortcut keys={["Ctrl", "C"]} action={t("welcome.copy")} />
                            <KeyboardShortcut keys={["Ctrl", "V"]} action={t("welcome.paste")} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 flex justify-between items-center">
                    <button
                        onClick={handleDontShowAgain}
                        className="text-sm text-slate-400 hover:text-slate-300"
                    >
                        {t("welcome.dontShowAgain")}
                    </button>
                    <button
                        onClick={handleClose}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        {t("welcome.getStarted")}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface FeatureItemProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
    return (
        <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-600/20 text-blue-400 rounded-lg flex items-center justify-center">
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-medium text-white">{title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
        </div>
    );
}

interface KeyboardShortcutProps {
    keys: string[];
    action: string;
}

function KeyboardShortcut({ keys, action }: KeyboardShortcutProps) {
    return (
        <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
                {keys.map((key, idx) => (
                    <React.Fragment key={key}>
                        {idx > 0 && <span className="text-slate-500">+</span>}
                        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">
                            {key}
                        </kbd>
                    </React.Fragment>
                ))}
            </div>
            <span className="text-slate-400">{action}</span>
        </div>
    );
}
