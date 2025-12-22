// IndexedDB 存储操作
export {
    getDB,
    closeDB,
    saveProject,
    getProject,
    getAllProjects,
    deleteProject,
    saveModule,
    getModule,
    getModulesByProject,
    deleteModule,
    saveNode,
    getNode,
    getNodesByModule,
    deleteNode,
    saveEdge,
    getEdge,
    getEdgesByModule,
    deleteEdge,
    saveSnapshot,
    getSnapshot,
    getSnapshotsByProject,
    deleteSnapshot,
    saveElements,
    getElements,
} from "./indexed-db";

// 影子模型管理
export {
    createProject,
    createModule,
    createNode,
    createEdge,
    getModuleWithContents,
    deleteModuleWithContents,
    inferNodeType,
    inferEdgeType,
} from "./shadow-manager";

// 元素映射管理
export {
    mapElementToNode,
    unmapElement,
    getNodeByElementId,
    getElementsByNodeId,
    batchMapElements,
    clearAllMappings,
    getAllMappings,
    restoreMappingsFromElements,
    injectMappingsToElements,
    findNodesForSelectedElements,
} from "./element-mapping";
