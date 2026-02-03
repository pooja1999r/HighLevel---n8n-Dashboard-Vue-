import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/** Serializable node shape for persistence and state */
export interface WorkflowNodeState {
  id: string
  type: string
  position: { x: number; y: number }
  label?: string
  data?: Record<string, unknown>
}

/** Serializable edge shape for persistence and state */
export interface WorkflowEdgeState {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

/** Canvas/viewport and editor configuration */
export interface WorkflowConfig {
  viewport?: { x: number; y: number; zoom: number }
  [key: string]: unknown
}

export const useWorkflowStore = defineStore('workflow', () => {
  const nodes = ref<WorkflowNodeState[]>([])
  const edges = ref<WorkflowEdgeState[]>([])
  const configuration = ref<WorkflowConfig>({})
  const selectedNodeId = ref<string | null>(null)
  const workflowName = ref('Untitled Workflow')
  /** Default config per template name (e.g. "Schedule Trigger" -> { Trigger on: "...", ... }). */
  const templateConfigs = ref<Record<string, Record<string, unknown>>>({})

  const hasSelection = computed(() => selectedNodeId.value != null)
  const nodeCount = computed(() => nodes.value.length)
  const edgeCount = computed(() => edges.value.length)

  /** True if the workflow has at least one trigger node (only lower edge, no incoming connections). */
  const hasTriggerNode = computed(() =>
    nodes.value.some((n) => n.data?.isTrigger === true)
  )

  function setSelectedNode(id: string | null) {
    selectedNodeId.value = id
  }

  function setWorkflowName(name: string) {
    workflowName.value = name
  }

  function clearSelection() {
    selectedNodeId.value = null
  }

  function setConfiguration(config: Partial<WorkflowConfig>) {
    configuration.value = { ...configuration.value, ...config }
  }

  /**
   * Sync store from Vue Flow's current state.
   * Call after: nodes added, nodes moved, edges created/removed.
   */
  function syncNodesFromFlow(flowNodes: Array<{ id: string; type?: string; position: { x: number; y: number }; label?: string; data?: Record<string, unknown> }>) {
    nodes.value = flowNodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'workflow',
      position: { x: n.position.x, y: n.position.y },
      label: typeof n.label === 'string' ? n.label : (n.data?.label as string) ?? undefined,
      data: n.data ? { ...n.data } : undefined,
    }))
  }

  function syncEdgesFromFlow(flowEdges: Array<{ id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }>) {
    edges.value = flowEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    }))
  }

  /** Sync both nodes and edges from Vue Flow (e.g. after any change). */
  function syncFromFlow(
    flowNodes: Array<{ id: string; type?: string; position: { x: number; y: number }; label?: string; data?: Record<string, unknown> }>,
    flowEdges: Array<{ id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }>
  ) {
    syncNodesFromFlow(flowNodes)
    syncEdgesFromFlow(flowEdges)
  }

  /** Set nodes and edges (e.g. when loading from Pinia into Vue Flow). */
  function setNodes(newNodes: WorkflowNodeState[]) {
    nodes.value = newNodes.map((n) => ({ ...n }))
  }

  function setEdges(newEdges: WorkflowEdgeState[]) {
    edges.value = newEdges.map((e) => ({ ...e }))
  }

  function resetWorkflow() {
    nodes.value = []
    edges.value = []
    selectedNodeId.value = null
    configuration.value = {}
  }

  function getTemplateConfig(templateName: string): Record<string, unknown> {
    return templateConfigs.value[templateName] ? { ...templateConfigs.value[templateName] } : {}
  }

  function setTemplateConfig(templateName: string, config: Record<string, unknown>) {
    templateConfigs.value[templateName] = { ...config }
  }

  function updateNodeData(nodeId: string, data: Record<string, unknown>) {
    const node = nodes.value.find((n) => n.id === nodeId)
    if (node) {
      node.data = { ...(node.data ?? {}), ...data }
    }
  }

  return {
    nodes,
    edges,
    configuration,
    templateConfigs,
    selectedNodeId,
    workflowName,
    hasSelection,
    nodeCount,
    edgeCount,
    hasTriggerNode,
    setSelectedNode,
    setWorkflowName,
    clearSelection,
    setConfiguration,
    syncNodesFromFlow,
    syncEdgesFromFlow,
    syncFromFlow,
    setNodes,
    setEdges,
    resetWorkflow,
    getTemplateConfig,
    setTemplateConfig,
    updateNodeData,
  }
})
