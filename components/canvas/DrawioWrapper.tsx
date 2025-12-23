"use client";

import React, { useRef, useImperativeHandle, forwardRef, useState, useCallback } from "react";
import { DrawIoEmbed, DrawIoEmbedRef, EventExport, EventSave } from "react-drawio";

/**
 * Draw.io 画布 API 接口
 */
export interface DrawioAPI {
    getXml: () => string;
    setXml: (xml: string) => void;
    exportPng: () => Promise<string>;
}

export interface DrawioWrapperProps {
    initialXml?: string;
    onSave?: (xml: string) => void;
    onChange?: (xml: string) => void;
}

/**
 * Draw.io 画布封装组件
 */
export const DrawioWrapper = forwardRef<DrawioAPI, DrawioWrapperProps>(
    function DrawioWrapper({ initialXml, onSave, onChange }, ref) {
        const drawioRef = useRef<DrawIoEmbedRef>(null);
        const [currentXml, setCurrentXml] = useState(initialXml || "");

        // 暴露 API
        useImperativeHandle(ref, () => ({
            getXml: () => currentXml,
            setXml: (xml: string) => {
                setCurrentXml(xml);
            },
            exportPng: async () => {
                return "";
            },
        }), [currentXml]);

        const handleExport = useCallback((data: EventExport) => {
            if (data.xml) {
                setCurrentXml(data.xml);
                if (onChange) {
                    onChange(data.xml);
                }
            }
        }, [onChange]);

        const handleSave = useCallback((data: EventSave) => {
            if (data.xml) {
                setCurrentXml(data.xml);
                if (onSave) {
                    onSave(data.xml);
                }
            }
        }, [onSave]);

        return (
            <div className="w-full h-full">
                <DrawIoEmbed
                    ref={drawioRef}
                    xml={currentXml}
                    onExport={handleExport}
                    onSave={handleSave}
                    urlParameters={{
                        ui: "dark",
                        spin: true,
                        noSaveBtn: false,
                        saveAndExit: false,
                        noExitBtn: true,
                    }}
                />
            </div>
        );
    }
);
