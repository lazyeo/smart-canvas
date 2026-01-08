export type {
    ModuleType,
    NodeType,
    EdgeType,
    ShadowNode,
    ShadowEdge,
    ShadowModule,
    ShadowProject,
    ElementNodeMapping,
    VersionSnapshot,
} from "./shadow-model";

export type {
    EnhancementLevel,
    ColorScheme,
    EnhancementOptions,
    VersionType,
    DiagramVersion,
    DiagramFile,
    FileManagerState,
    CreateFileParams,
    UpdateFileParams,
    CreateVersionParams,
} from "./diagram-file";

export {
    DEFAULT_ENHANCEMENT_OPTIONS,
    FILE_CONFIG,
    generateId,
    createNewFile,
    createNewVersion,
    getCurrentSimpleVersion,
    getCurrentProfessionalVersion,
    formatVersionTime,
} from "./diagram-file";
