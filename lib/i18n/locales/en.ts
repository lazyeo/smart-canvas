/**
 * English Language Pack
 */
export const en = {
    // Common
    common: {
        loading: "Loading...",
        loadingCanvas: "Loading canvas...",
        export: "Export",
        import: "Import",
        save: "Save",
        cancel: "Cancel",
        confirm: "Confirm",
        delete: "Delete",
        edit: "Edit",
        add: "Add",
        close: "Close",
        settings: "Settings",
        help: "Help",
    },

    // Welcome Guide
    welcome: {
        title: "Welcome to SmartCanvas AI",
        subtitle: "AI-powered intelligent diagram tool",
        features: {
            aiGenerate: {
                title: "AI Generate",
                description: "Describe your needs in the chat panel, AI generates flowcharts, architecture diagrams, etc.",
            },
            selectEdit: {
                title: "Select & Edit",
                description: "Select nodes and use AI to modify, delete, or add elements",
            },
            autoLayout: {
                title: "Auto Layout",
                description: "Click the 'Layout' button to automatically arrange nodes",
            },
        },
        shortcuts: "Shortcuts",
        undo: "Undo",
        redo: "Redo",
        copy: "Copy",
        paste: "Paste",
        dontShowAgain: "Don't show again",
        getStarted: "Get Started",
    },

    // Header
    header: {
        autoLayout: "Layout",
        engineExcalidraw: "Excalidraw",
        engineDrawio: "Draw.io",
    },

    // Chat Panel
    chat: {
        placeholder: "Describe the diagram you want, or select elements to edit...",
        placeholderSelected: "{count} element(s) selected, enter edit command...",
        thinking: "Thinking...",
        generating: "Generating... (~{tokens} tokens)",
        success: {
            generated: "Generated {nodes} nodes and {edges} edges",
            modified: "Modified",
            deleted: "Deleted selected elements",
            connected: "Added connection",
        },
        error: {
            noApiKey: "Please configure API Key in settings first",
            parseFailed: "Failed to parse AI response",
            editFailed: "Edit failed",
            networkError: "Network error, please retry",
        },
        selectedElements: "{count} element(s) selected",
    },

    // Export Import
    exportImport: {
        exportJson: "Export JSON",
        exportPng: "Export PNG",
        exportSvg: "Export SVG",
        importFailed: "Import failed: Invalid file format",
    },

    // Module Panel
    module: {
        title: "Modules",
        ungrouped: "Ungrouped",
        modulePrefix: "Module",
        noModules: "No modules",
        selectAll: "Select All",
        regenerate: "Regenerate",
        nodeCount: "nodes",
    },

    // API Key Management
    apiKey: {
        title: "API Key Settings",
        description: "Configure your LLM API Key, with support for custom Base URL and model name.",
        provider: "Provider",
        apiKey: "API Key",
        apiKeyPlaceholder: "Enter {provider} API Key",
        baseUrl: "Base URL (optional, leave empty for official endpoint)",
        baseUrlPlaceholder: "Optional, leave empty for default",
        baseUrlHint: "Supports third-party API proxies or locally deployed compatible services",
        model: "Model Name",
        modelPlaceholder: "Optional, leave empty for default",
        advancedSettings: "Advanced Settings",
        save: "Save",
        cancel: "Cancel",
        close: "Close",
        modify: "Modify",
        delete: "Delete",
        addApiKey: "+ Add API Key",
        saveFailed: "Save failed",
        saveSuccess: "Saved successfully",
        deleteFailed: "Delete failed",
        deleteSuccess: "Deleted successfully",
        setDefault: "Set as default",
        currentlyUsing: "Currently using",
        switchedTo: "Switched to {provider}",
        apiKeyEmpty: "API Key cannot be empty",
    },

    // AI Prompts
    ai: {
        systemPrompt: `You are a professional diagram generation assistant. Generate structured diagram data based on user descriptions.

## Output Format
Return diagram data in JSON format:
\`\`\`json
{
  "nodes": [
    {"id": "1", "type": "process", "label": "Node Name", "row": 0, "column": 0}
  ],
  "edges": [
    {"id": "e1", "source": "1", "target": "2", "label": "optional label"}
  ]
}
\`\`\`

## Node Types
- start: Start node (ellipse)
- end: End node (ellipse)
- process: Process step (rectangle)
- decision: Decision branch (diamond)
- data: Data (parallelogram)

## Rules
1. Use row/column for logical positioning
2. Ensure all nodes have meaningful labels
3. Edge source/target must reference valid node ids
4. Return only JSON, no other content`,

        incrementalEditPrompt: `You are a professional diagram editing assistant. The user will provide selected node/edge information and editing instructions.
Analyze the user's intent and return incremental update JSON data.

## Return Format
Return the following JSON format:
\`\`\`json
{
  "operation": "modify|add|delete|connect|disconnect|restyle",
  "explanation": "Brief explanation of the operation",
  "nodesToAdd": [],
  "nodesToUpdate": [],
  "nodesToDelete": [],
  "edgesToAdd": [],
  "edgesToUpdate": [],
  "edgesToDelete": []
}
\`\`\`

## Rules
1. Only return changed parts
2. Always explain operations in English
3. Return only JSON, no other content`,

        mermaidSystemPrompt: `You are a professional diagram generation assistant. Output diagrams using Mermaid syntax.

## Supported Diagram Types
- flowchart TD (flowchart, top to bottom)
- flowchart LR (flowchart, left to right)
- sequenceDiagram (sequence diagram)
- classDiagram (class diagram)
- stateDiagram-v2 (state diagram)

## Node Shapes
- [text] rectangle
- (text) rounded rectangle
- {text} diamond
- ((text)) circle
- [[text]] subprocess

## Example
\`\`\`mermaid
flowchart TD
    A[Start] --> B{Condition}
    B -->|Yes| C[Process]
    B -->|No| D[Other]
    C --> E[End]
    D --> E
\`\`\`

## Rules
1. Output only Mermaid code block
2. Use English labels
3. Flowcharts default to TD (top to bottom)
4. Do not add any explanations`,
    },
};
