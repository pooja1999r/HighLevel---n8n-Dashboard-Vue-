<script setup lang="ts">
import { markRaw, provide, onMounted, onUnmounted, nextTick, ref, computed } from 'vue'
import {
  VueFlow,
  useVueFlow,
  Panel,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@vue-flow/core'
import { useWorkflowStore } from '../stores/workflow'
import { useExecutionLogStore } from '../stores/executionLog'
import { useNodeModalStore } from '../stores/nodeModal'
import type { Execution, ExecutionEntry } from '../stores/executionLog'
import WorkflowNode from './WorkflowNode.vue'
import NotificationBanner from './ui-components/NotificationBanner.vue'
import ConfirmModal from './modal/ConfirmModal.vue'
import { nodeActionType } from './constants'
import { 
  buildNodeConfig, 
  executeNode, 
  formatExecutedTime, 
  getScheduleIntervalMs, 
  msUntilTime 
} from '../services/nodeService'

const WORKFLOW_NODE_HANDLERS_KEY = 'workflow-node-handlers'

const WORKFLOW_ID = 'workflow-editor'

const flowStore = useVueFlow(WORKFLOW_ID)
const workflowStore = useWorkflowStore()
const executionLogStore = useExecutionLogStore()
const nodeModalStore = useNodeModalStore()
const {
  nodes,
  edges,
  addNodes,
  addEdges,
  removeNodes,
  applyNodeChanges,
  applyEdgeChanges,
  setNodes: setFlowNodes,
  setEdges: setFlowEdges,
  setViewport,
  viewport,
  screenToFlowCoordinate,
  zoomIn,
  zoomOut,
  fitView,
  getNodes,
  getEdges,
  updateNodeData,
} = flowStore

/** Hydrate Vue Flow from Pinia store (nodes, edges, positions, viewport). */
function hydrateFromStore() {
  const storeNodes = workflowStore.nodes
  const storeEdges = workflowStore.edges
  const config = workflowStore.configuration
  if (storeNodes.length > 0 || storeEdges.length > 0) {
    const flowNodes = storeNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { ...(n.data ?? {}), label: n.label },
    }))
    setFlowNodes(flowNodes)
    setFlowEdges([...storeEdges])
  }
  if (config.viewport && typeof config.viewport === 'object' && 'x' in config.viewport && 'y' in config.viewport && 'zoom' in config.viewport) {
    setViewport(config.viewport as { x: number; y: number; zoom: number })
  }
}

/** Persist current Vue Flow state to Pinia (after any nodes/edges change). */
function persistToStore() {
  const nodesToSync = getNodes.value.map(n => ({
    id: n.id,
    type: n.type,
    position: n.position,
    label: typeof n.label === 'string' ? n.label : (n.data?.label as string | undefined),
    data: n.data as Record<string, unknown> | undefined,
  }))
  workflowStore.syncFromFlow(nodesToSync, getEdges.value)
}

/** Persist viewport to store when pan/zoom ends. */
function onViewportChangeEnd() {
  const vp = viewport.value
  if (vp && typeof vp.x === 'number' && typeof vp.y === 'number' && typeof vp.zoom === 'number') {
    workflowStore.setConfiguration({ viewport: { x: vp.x, y: vp.y, zoom: vp.zoom } })
  }
}

onMounted(() => {
  nextTick(hydrateFromStore)
})

const nodeTypes = {
  default: markRaw(WorkflowNode),
  workflow: markRaw(WorkflowNode),
}

function onNodesChange(changes: NodeChange[]) {
  applyNodeChanges(changes)
  nextTick(persistToStore)
}

function onEdgesChange(changes: EdgeChange[]) {
  applyEdgeChanges(changes)
  nextTick(persistToStore)
}

function onConnect(connection: Connection) {
  addEdges([connection])
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const data = event.dataTransfer?.getData('application/json')
  if (!data) return
  try {
    const { label, isTrigger } = JSON.parse(data) as { label: string; isTrigger?: boolean }
    const position = screenToFlowCoordinate({
      x: event.clientX,
      y: event.clientY,
    })
    addNewNode(position.x, position.y, label ?? 'Node', isTrigger ?? false)
  } catch {
    // ignore
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
}

function addNewNode(x: number, y: number, label: string, isTrigger = false, config?: Record<string, unknown>) {
  const nodeConfig = buildNodeConfig(label, { x, y })
  
  const data = {
    ...nodeConfig,
    isTrigger: isTrigger || nodeConfig.isTrigger,
    ...(config ?? {}),
  }
  addNodes({
    id: `node-${Date.now()}`,
    type: 'workflow',
    position: { x, y },
    label,
    data,
  })
}

/** Tidy up nodes - arrange them in a clean tree layout based on connections */
function tidyUp() {
  const currentNodes = getNodes.value
  const currentEdges = getEdges.value
  if (currentNodes.length === 0) return

  const NODE_WIDTH = 180
  const HORIZONTAL_GAP = 80
  const VERTICAL_GAP = 100
  const TREE_GAP = 150 // Gap between separate trees

  // Build adjacency lists
  const children = new Map<string, string[]>()
  const parents = new Map<string, string[]>()
  
  currentNodes.forEach(n => {
    children.set(n.id, [])
    parents.set(n.id, [])
  })
  
  currentEdges.forEach(e => {
    if (children.has(e.source) && parents.has(e.target)) {
      children.get(e.source)!.push(e.target)
      parents.get(e.target)!.push(e.source)
    }
  })

  // Find root nodes (triggers first, then nodes with no parents)
  const triggers = currentNodes.filter(n => n.data?.isTrigger === true)
  const noParentNodes = currentNodes.filter(n => 
    parents.get(n.id)!.length === 0 && n.data?.isTrigger !== true
  )
  const roots = [...triggers, ...noParentNodes]

  // Track which nodes have been positioned
  const positioned = new Set<string>()
  const positions = new Map<string, { x: number; y: number }>()

  // Calculate subtree width recursively
  function getSubtreeWidth(nodeId: string, visited: Set<string>): number {
    if (visited.has(nodeId)) return NODE_WIDTH
    visited.add(nodeId)
    
    const nodeChildren = children.get(nodeId) ?? []
    if (nodeChildren.length === 0) return NODE_WIDTH
    
    let totalWidth = 0
    nodeChildren.forEach((childId, index) => {
      if (index > 0) totalWidth += HORIZONTAL_GAP
      totalWidth += getSubtreeWidth(childId, new Set(visited))
    })
    
    return Math.max(NODE_WIDTH, totalWidth)
  }

  // Position a subtree recursively
  function positionSubtree(nodeId: string, centerX: number, y: number, visited: Set<string>) {
    if (visited.has(nodeId) || positioned.has(nodeId)) return
    visited.add(nodeId)
    positioned.add(nodeId)
    
    // Position this node
    positions.set(nodeId, { x: centerX - NODE_WIDTH / 2, y })
    
    const nodeChildren = children.get(nodeId) ?? []
    if (nodeChildren.length === 0) return
    
    // Calculate total width needed for children
    const childWidths: number[] = []
    let totalChildrenWidth = 0
    nodeChildren.forEach((childId, index) => {
      const width = getSubtreeWidth(childId, new Set(visited))
      childWidths.push(width)
      if (index > 0) totalChildrenWidth += HORIZONTAL_GAP
      totalChildrenWidth += width
    })
    
    // Position children centered under this node
    let currentX = centerX - totalChildrenWidth / 2
    nodeChildren.forEach((childId, index) => {
      const childWidth = childWidths[index] ?? NODE_WIDTH
      const childCenterX = currentX + childWidth / 2
      positionSubtree(childId, childCenterX, y + VERTICAL_GAP, new Set(visited))
      currentX += childWidth + HORIZONTAL_GAP
    })
  }

  // Position each tree starting from roots
  let treeStartX = 0
  roots.forEach((root) => {
    if (positioned.has(root.id)) return
    
    const treeWidth = getSubtreeWidth(root.id, new Set())
    const treeCenterX = treeStartX + treeWidth / 2
    
    positionSubtree(root.id, treeCenterX, 50, new Set())
    
    treeStartX += treeWidth + TREE_GAP
  })

  // Handle any remaining disconnected nodes (shouldn't happen but just in case)
  let disconnectedX = treeStartX
  currentNodes.forEach(n => {
    if (!positioned.has(n.id)) {
      positions.set(n.id, { x: disconnectedX, y: 50 })
      disconnectedX += NODE_WIDTH + HORIZONTAL_GAP
    }
  })

  // Apply positions to nodes
  currentNodes.forEach(node => {
    const pos = positions.get(node.id)
    if (pos) {
      node.position = pos
    }
  })

  // Update the flow
  setFlowNodes([...currentNodes])
  nextTick(() => {
    persistToStore()
    fitView({ padding: 0.2 })
  })
}

/** Export workflow nodes and edges as JSON file */
function exportWorkflow() {
  const nodesToExport = workflowStore.nodes.map(node => ({
    id: node.id,
    label: node.label,
    position: node.position, // Include exact position
    data: node.data,
  }))
  
  if (nodesToExport.length === 0) {
    executionLogStore.setNotification('error', 'No nodes to export')
    return
  }
  
  // Export edges with source and target node IDs
  const edgesToExport = workflowStore.edges.map(edge => ({
    source: edge.source,
    target: edge.target,
  }))
  
  const exportData = {
    nodes: nodesToExport,
    edges: edgesToExport,
  }
  
  const jsonString = JSON.stringify(exportData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `workflow-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  executionLogStore.setNotification('success', `Exported ${nodesToExport.length} node(s) and ${edgesToExport.length} edge(s)`)
}

/** Hidden file input ref for import */
const fileInputRef = ref<HTMLInputElement | null>(null)

/** Trigger file input click */
function triggerImport() {
  fileInputRef.value?.click()
}

/** Validate imported node structure */
function isValidNodeData(node: unknown): node is { label: string; data: Record<string, unknown> } {
  if (typeof node !== 'object' || node === null) return false
  const n = node as Record<string, unknown>
  
  if (typeof n.label !== 'string' || !n.label) return false
  if (typeof n.data !== 'object' || n.data === null) return false
  
  const data = n.data as Record<string, unknown>
  // Check required fields in data
  if (typeof data.label !== 'string') return false
  if (typeof data.actionType !== 'string') return false
  if (typeof data.userInput !== 'object' || data.userInput === null) return false
  
  return true
}

/** Handle file import */
async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) return
  
  try {
    const text = await file.text()
    let parsed: unknown
    
    try {
      parsed = JSON.parse(text)
    } catch {
      executionLogStore.setNotification('error', 'Invalid JSON format')
      input.value = ''
      return
    }
    
    // Determine format: new format { nodes: [], edges: [] } or old format (array of nodes)
    let nodesToImport: Array<{ id?: string; label: string; position?: { x: number; y: number }; data: Record<string, unknown> }> = []
    let edgesToImport: Array<{ source: string; target: string }> = []
    
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      // New format with nodes and edges
      if (Array.isArray(obj.nodes)) {
        nodesToImport = obj.nodes as typeof nodesToImport
      }
      if (Array.isArray(obj.edges)) {
        edgesToImport = obj.edges as typeof edgesToImport
      }
    } else if (Array.isArray(parsed)) {
      // Old format: array of nodes
      nodesToImport = parsed as typeof nodesToImport
    } else {
      // Single node
      nodesToImport = [parsed as typeof nodesToImport[0]]
    }
    
    // Validate all nodes
    const invalidNodes = nodesToImport.filter(n => !isValidNodeData(n))
    if (invalidNodes.length > 0) {
      executionLogStore.setNotification('error', `Invalid node format. Required: label, data.label, data.actionType, data.userInput`)
      input.value = ''
      return
    }
    
    // Create ID mapping (old ID -> new ID) for edge connections
    const idMapping = new Map<string, string>()
    
    // Add nodes to the flow
    let startX = 100
    let startY = 100
    let addedCount = 0
    
    for (const nodeData of nodesToImport) {
      // Use top-level position first, then fallback to data.position, then default
      const position = nodeData.position 
        ?? (nodeData.data.position as { x: number; y: number } | undefined) 
        ?? { x: startX, y: startY }
      const oldId = nodeData.id ?? `temp-${addedCount}`
      const newId = `node-${Date.now()}-${addedCount}`
      
      // Store ID mapping for edges
      idMapping.set(oldId, newId)
      
      addNodes({
        id: newId,
        type: 'workflow',
        position: { x: position.x, y: position.y },
        label: nodeData.label,
        data: {
          ...nodeData.data,
          label: nodeData.label,
        },
      })
      
      startX += 200
      if (startX > 600) {
        startX = 100
        startY += 150
      }
      addedCount++
    }
    
    // Add edges based on the mapping
    let edgesAdded = 0
    for (const edge of edgesToImport) {
      const newSource = idMapping.get(edge.source)
      const newTarget = idMapping.get(edge.target)
      
      if (newSource && newTarget) {
        addEdges({
          id: `edge-${Date.now()}-${edgesAdded}`,
          source: newSource,
          target: newTarget,
        })
        edgesAdded++
      }
    }
    
    nextTick(() => {
      persistToStore()
      fitView({ padding: 0.2 })
    })
    
    const edgeMsg = edgesAdded > 0 ? ` and ${edgesAdded} edge(s)` : ''
    executionLogStore.setNotification('success', `Imported ${addedCount} node(s)${edgeMsg}`)
  } catch (err) {
    console.error('Import error:', err)
    executionLogStore.setNotification('error', 'Failed to import workflow')
  }
  
  // Reset input
  input.value = ''
}

async function onNodeExecute(id: string) {
  const node = workflowStore.nodes.find((n) => n.id === id)
  if (!node) return
  
  executionLogStore.clearExecution()
  executionLogStore.clearNotification()
  
  const startedAt = Date.now()
  const config = node.data ?? {}
  const label = node.label ?? (node.data?.label as string) ?? 'Node'
  
  const execResult = await executeNode(config)
  
  const entry: ExecutionEntry = {
    id: `entry-${id}-${startedAt}`,
    nodeId: id,
    nodeName: label,
    input: config,
    output: execResult.output,
    durationMs: Date.now() - startedAt,
    status: execResult.status,
  }
  
  const execution: Execution = {
    id: `exec-${startedAt}`,
    startedAt,
    durationMs: Date.now() - startedAt,
    status: execResult.status,
    triggerDescription: `Single node execution: ${label}`,
    executedAtFormatted: formatExecutedTime(startedAt),
    entries: [entry],
  }
  
  executionLogStore.setExecution(execution)
  
  if (execResult.status === 'error') {
    const errorMessage = execResult.output?.error 
      ? String(execResult.output.error)
      : 'Node execution failed.'
    executionLogStore.setNotification('error', errorMessage)
  } else {
    executionLogStore.setNotification('success', `${label} executed successfully.`)
  }
}

/** Get nodes in execution order: triggers first, then nodes in topological order by edges. */
function getExecutionOrder(): { id: string; label: string }[] {
  const nodes = workflowStore.nodes
  const edges = workflowStore.edges
  if (nodes.length === 0) return []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const targetsBySource = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  nodes.forEach((n) => inDegree.set(n.id, 0))
  edges.forEach((e) => {
    if (!byId.has(e.source) || !byId.has(e.target)) return
    const list = targetsBySource.get(e.source) ?? []
    list.push(e.target)
    targetsBySource.set(e.source, list)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  })
  const queue: string[] = nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id)
  const order: { id: string; label: string }[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = byId.get(id)
    if (node) order.push({ id: node.id, label: node.label ?? (node.data?.label as string) ?? 'Node' })
    ;(targetsBySource.get(id) ?? []).forEach((tid) => {
      const d = (inDegree.get(tid) ?? 1) - 1
      inDegree.set(tid, d)
      if (d === 0) queue.push(tid)
    })
  }
  return order
}


/** Build execution entries and run the workflow. */
async function executeWorkflowNow() {
  const order = getExecutionOrder()
  if (order.length === 0) return
  executionLogStore.clearExecution()
  const startedAt = Date.now()
  const nodesById = new Map(workflowStore.nodes.map((n) => [n.id, n]))
  const entries: ExecutionEntry[] = []
  let hasError = false
  for (const node of order) {
    const workflowNode = nodesById.get(node.id)
    const config = workflowNode?.data ?? {}
    
    // Skip muted nodes
    if (config.muted === true) {
      entries.push({
        id: `entry-${node.id}-${startedAt}`,
        nodeId: node.id,
        nodeName: node.label,
        input: config,
        output: { skipped: true, reason: 'Node is disabled' },
        durationMs: 0,
        status: 'skipped' as const,
      })
      continue
    }
    
    const nodeStartedAt = Date.now()
    const execResult = workflowNode
      ? await executeNode(config)
      : { output: { error: 'Node not found' }, status: 'error' as const }
    if (execResult.status === 'error') hasError = true
    const output = execResult.output
    entries.push({
      id: `entry-${node.id}-${startedAt}`,
      nodeId: node.id,
      nodeName: node.label,
      input: config,
      output,
      durationMs: Date.now() - nodeStartedAt,
      status: execResult.status,
    })
  }
  const durationMs = Date.now() - startedAt
  const execution: Execution = {
    id: `exec-${startedAt}`,
    startedAt,
    durationMs,
    status: hasError ? 'error' : 'success',
    triggerDescription: "When clicking 'Execute workflow'",
    executedAtFormatted: formatExecutedTime(startedAt),
    entries,
  }
  executionLogStore.setExecution(execution)
  if (hasError) {
    // Find the first error message from failed entries
    const failedEntry = entries.find(e => e.status === 'error')
    const failedOutput = failedEntry?.output as Record<string, unknown> | undefined
    const errorMessage = failedOutput?.error 
      ? String(failedOutput.error)
      : 'Execution failed for one or more nodes.'
    executionLogStore.setNotification('error', errorMessage)
  } else {
    executionLogStore.setNotification('success', 'Execution completed successfully.')
  }
} 

let scheduleTimerId: ReturnType<typeof setInterval> | null = null
let scheduleTimeoutId: ReturnType<typeof setTimeout> | null = null
const isScheduleActive = ref(false)

/** Check if there are nodes on the canvas */
const hasNodes = computed(() => nodes.value.length > 0)

/** Delete all modal state */
const showDeleteAllModal = ref(false)
const deleteAllNodeCount = ref(0)

/** Rename modal state */
const showRenameModal = ref(false)
const renameNodeId = ref('')
const renameNodeName = ref('')

function clearSchedule() {
  if (scheduleTimerId) {
    clearInterval(scheduleTimerId)
    scheduleTimerId = null
  }
  if (scheduleTimeoutId) {
    clearTimeout(scheduleTimeoutId)
    scheduleTimeoutId = null
  }
  isScheduleActive.value = false
}

function abortExecution() {
  clearSchedule()
}

/** Show delete all confirmation modal */
function deleteAllNodes() {
  const nodeCount = getNodes.value.length
  if (nodeCount === 0) return
  
  deleteAllNodeCount.value = nodeCount
  showDeleteAllModal.value = true
}

/** Handle delete all confirmation */
function confirmDeleteAll() {
  const nodeCount = deleteAllNodeCount.value
  
  // Clear schedule if running
  clearSchedule()
  
  // Remove all nodes (edges will be removed automatically)
  const nodeIds = getNodes.value.map(n => n.id)
  removeNodes(nodeIds)
  
  // Clear execution logs
  executionLogStore.clearExecution()
  
  // Persist to store
  nextTick(persistToStore)
  
  executionLogStore.setNotification('success', `Deleted ${nodeCount} node(s)`)
}

async function runWorkflow() {
  executionLogStore.clearExecution()
  executionLogStore.clearNotification()

  clearSchedule()

  const order = getExecutionOrder()
  if (order.length === 0) {
    executionLogStore.setNotification('error', 'Trigger node is required')
    return
  }

  const hasTrigger = workflowStore.nodes.some((n) => n.data?.isTrigger === true)
  if (!hasTrigger) {
    executionLogStore.setNotification('error', 'Trigger node is required')
    return
  }

  const triggerNodeData = workflowStore.nodes.find((n) => n.data?.isTrigger === true)
  const triggerLabel = (triggerNodeData?.label ?? triggerNodeData?.data?.label) as string | undefined
  const triggerActionType =
    (triggerNodeData?.data?.actionType as string | undefined) ||
    (triggerLabel === 'Schedule Trigger'
      ? nodeActionType.SCHEDULE_TRIGGER
      : triggerLabel === 'Manual Trigger'
        ? nodeActionType.MANUAL_TRIGGER
        : '')

  if (triggerActionType === nodeActionType.MANUAL_TRIGGER) {
    await executeWorkflowNow()
    return
  }

  if (triggerActionType === nodeActionType.SCHEDULE_TRIGGER) {
    const data = (triggerNodeData?.data ?? {}) as Record<string, unknown>
    // Get values from userInput (using labelType keys) or fallback to data directly
    const userInput = (data.userInput as Record<string, unknown>) ?? data
    
    // TRIGGER_ON stores the value like 'sec', 'min', 'hour', 'day', 'week', 'month'
    const triggerOn = String(userInput['TRIGGER_ON'] ?? 'min')
    // INTERVAL_BETWEEN_TRIGGER stores the interval number
    const between = Number(userInput['INTERVAL_BETWEEN_TRIGGER'] ?? 1) || 1
    // TIME_TO_TRIGGER stores the time string like '00:00'
    const timeStr = String(userInput['TIME_TO_TRIGGER'] ?? '00:00')

    const intervalMs = getScheduleIntervalMs(triggerOn, between)
    const firstRunMs = msUntilTime(timeStr)

    let isExecuting = false
    const runScheduled = async () => {
      if (isExecuting) return
      isExecuting = true
      await executeWorkflowNow()
      isExecuting = false
    }

    isScheduleActive.value = true
    if (firstRunMs <= 1000) {
      runScheduled()
      scheduleTimerId = setInterval(runScheduled, intervalMs)
    } else {
      scheduleTimeoutId = setTimeout(() => {
        scheduleTimeoutId = null
        runScheduled()
        scheduleTimerId = setInterval(runScheduled, intervalMs)
      }, firstRunMs)
    }
    return
  }

  await executeWorkflowNow()
}

onUnmounted(clearSchedule)

function onNodeSwitchOff(id: string) {
  const node = workflowStore.nodes.find((n) => n.id === id)
  if (!node) return
  const currentMuted = node.data?.muted === true
  // Toggle muted state
  workflowStore.updateNodeData(id, { muted: !currentMuted })
  updateNodeData(id, { muted: !currentMuted })
  nextTick(persistToStore)
}

function onNodeDelete(id: string) {
  removeNodes([id])
}

function onNodeOpen(id: string) {
  const node = workflowStore.nodes.find((n) => n.id === id)
  if (node) nodeModalStore.openWorkflow(node)
}

/** Handle node click - open the node info modal */
function onNodeClick({ node }: { node: { id: string } }) {
  onNodeOpen(node.id)
}

/** Show rename modal */
function onNodeRename(id: string) {
  const node = workflowStore.nodes.find((n) => n.id === id)
  const currentName = node?.label ?? (node?.data?.label as string) ?? 'Node'
  
  renameNodeId.value = id
  renameNodeName.value = currentName
  showRenameModal.value = true
}

/** Handle rename confirmation */
function confirmRename(newName?: string) {
  if (!newName || !newName.trim()) return
  
  const name = newName.trim()
  const id = renameNodeId.value
  
  // Update workflow store label
  workflowStore.updateNodeLabel(id, name)
  // Update Vue Flow node - both label and data.label
  const flowNode = getNodes.value.find((n) => n.id === id)
  if (flowNode) {
    flowNode.label = name
    flowNode.data = { ...flowNode.data, label: name }
  }
  // Trigger reactivity by setting nodes
  setFlowNodes([...getNodes.value])
  nextTick(persistToStore)
}

async function onNodeCopy(id: string) {
  const node = workflowStore.nodes.find((n) => n.id === id)
  if (!node) return
  
  // Copy node data to clipboard
  const nodeData = {
    label: node.label,
    data: node.data,
  }
  
  try {
    await navigator.clipboard.writeText(JSON.stringify(nodeData, null, 2))
    executionLogStore.setNotification('success', 'Node data copied to clipboard')
  } catch (err) {
    console.error('Failed to copy:', err)
    executionLogStore.setNotification('error', 'Failed to copy node data')
  }
}

function onNodeDuplicate(id: string) {
  const node = flowStore.findNode(id)
  if (!node) return
  
  const pos = node.position
  const label = (node.data?.label as string) ?? (node.label as string) ?? 'Node'
  const isTrigger = (node.data?.isTrigger as boolean) ?? false
  // Copy all data except muted state for fresh duplicate
  const { label: _l, isTrigger: _t, muted: _m, ...config } = (node.data ?? {}) as Record<string, unknown>
  
  addNewNode(pos.x + 50, pos.y + 80, label, isTrigger, config)
}

provide(WORKFLOW_NODE_HANDLERS_KEY, {
  onExecute: onNodeExecute,
  onSwitchOff: onNodeSwitchOff,
  onDelete: onNodeDelete,
  onOpen: onNodeOpen,
  onRename: onNodeRename,
  onCopy: onNodeCopy,
  onDuplicate: onNodeDuplicate,
})
</script>

<template>
  <div class="workflow-editor">
    <VueFlow
      :id="WORKFLOW_ID"
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :delete-key-code="['Backspace', 'Delete']"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :elements-selectable="true"
      fit-view-on-init
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @viewport-change-end="onViewportChangeEnd"
      @connect="onConnect"
      @drop="onDrop"
      @dragover="onDragOver"
      @node-click="onNodeClick"
    >
      <Panel position="top-right" class="workflow-controls">
        <button type="button" class="workflow-controls__btn workflow-controls__btn--tooltip" data-tooltip="Zoom to fit" @click="fitView({ padding: 0.2 })">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 6V2h4v2H4v2H2zm20 0V2h-4v2h2v2h2zM2 18v4h4v-2H4v-2H2zm20 0v4h-4v-2h2v-2h2zM9 7h6v2H9V7zm0 8h6v2H9v-2zm-2-4h2v2H7v-2zm8 0h2v2h-2v-2z" />
          </svg>
        </button>
        <button type="button" class="workflow-controls__btn workflow-controls__btn--tooltip" data-tooltip="Zoom in" @click="zoomIn()">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
        <button type="button" class="workflow-controls__btn workflow-controls__btn--tooltip" data-tooltip="Zoom out" @click="zoomOut()">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z" />
          </svg>
        </button>
        <button type="button" class="workflow-controls__btn workflow-controls__btn--tooltip" data-tooltip="Tidy up" @click="tidyUp">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3h8v2H5v6H3V3zm18 0h-8v2h6v6h2V3zM3 21h8v-2H5v-6H3v8zm18 0h-8v-2h6v-6h2v8zM8 8h8v8H8V8zm2 2v4h4v-4h-4z" />
          </svg>
        </button>
        <button type="button" class="workflow-controls__btn workflow-controls__btn--tooltip workflow-controls__btn--delete-all" data-tooltip="Delete all nodes" @click="deleteAllNodes">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>
      </Panel>
      <!-- Hidden file input for import -->
      <input
        ref="fileInputRef"
        type="file"
        accept=".json"
        style="display: none"
        @change="handleImport"
      />
      
      <Panel position="bottom-left" class="workflow-execution-panel">
        <!-- Import button - visible when NO nodes -->
        <button
          v-if="!hasNodes"
          type="button"
          class="workflow-controls__btn workflow-controls__btn--tooltip workflow-controls__btn--import"
          data-tooltip="Import workflow"
          @click="triggerImport"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
          </svg>
        </button>
        
        <!-- Export and Execution buttons - visible when there ARE nodes -->
        <template v-if="hasNodes">
          <button
            type="button"
            class="workflow-controls__btn workflow-controls__btn--tooltip workflow-controls__btn--export"
            data-tooltip="Export workflow"
            @click="exportWorkflow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
          </button>
          
          <button
            v-if="!isScheduleActive"
            type="button"
            class="workflow-controls__btn workflow-controls__btn--run"
            title="Execution workflow"
            @click="runWorkflow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span class="workflow-controls__btn-label">Execution workflow</span>
          </button>
          <button
            v-else
            type="button"
            class="workflow-controls__btn workflow-controls__btn--abort workflow-controls__btn--in-progress"
            title="Abort execution"
            @click="abortExecution"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
            <span class="workflow-controls__btn-label">Abort execution</span>
          </button>
        </template>
      </Panel>
    </VueFlow>

    <!-- Notification banner positioned at bottom-right, above execution logs -->
    <div class="workflow-editor__notification">
      <NotificationBanner
        v-if="executionLogStore.notification"
        :message="executionLogStore.notification.message"
        :type="executionLogStore.notification.type"
        :model-value="!!executionLogStore.notification"
        :auto-dismiss-ms="5000"
        @dismiss="executionLogStore.clearNotification()"
      />
    </div>

    <!-- Delete All Confirmation Modal -->
    <ConfirmModal
      v-model="showDeleteAllModal"
      title="Delete All Nodes"
      :message="`Are you sure you want to delete all ${deleteAllNodeCount} node(s)? This action cannot be undone.`"
      type="confirm"
      confirm-text="Delete All"
      cancel-text="Cancel"
      :danger="true"
      @confirm="confirmDeleteAll"
    />

    <!-- Rename Node Modal -->
    <ConfirmModal
      v-model="showRenameModal"
      title="Rename Node"
      message="Enter a new name for this node:"
      type="prompt"
      confirm-text="Rename"
      cancel-text="Cancel"
      input-placeholder="Node name"
      :input-value="renameNodeName"
      @confirm="confirmRename"
    />
  </div>
</template>

<style scoped>
.workflow-editor {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  background: #e2e8f0;
  position: relative;
}


.workflow-editor :deep(.vue-flow) {
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: #e2e8f0;
}

.workflow-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #cbd5e1;
  z-index: 10;
  pointer-events: auto;
}

.workflow-controls__btn-label {
  font-size: 11px;
  white-space: nowrap;
}

.workflow-controls__btn {
  width: 36px;
  height: 36px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workflow-controls__btn svg {
  flex-shrink: 0;
  fill: #334155;
}

.workflow-controls__btn:hover {
  background: #f1f5f9;
}

.workflow-controls__btn:hover svg {
  fill: #0f172a;
}

.workflow-controls__btn--add:hover {
  background: #dcfce7;
}

.workflow-controls__btn--add:hover svg {
  fill: #166534;
}

.workflow-controls__btn--delete-all:hover {
  background: #fee2e2;
}

.workflow-controls__btn--delete-all:hover svg {
  fill: #991b1b;
}

.workflow-controls__btn--run {
  flex-direction: row;
  gap: 8px;
  width: auto;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.workflow-controls__btn--run:hover {
  background: #dcfce7;
  transform: translateY(-1px);
}

.workflow-controls__btn--run:hover svg {
  fill: #166534;
}

.workflow-controls__btn--run:active {
  background: #bbf7d0;
  transform: translateY(1px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.workflow-controls__btn--abort {
  flex-direction: row;
  gap: 8px;
  width: auto;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.workflow-controls__btn--abort.workflow-controls__btn--in-progress {
  background: #fee2e2;
  border-color: #f87171;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
  animation: workflow-abort-pulse 1.5s ease-in-out infinite;
}

@keyframes workflow-abort-pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2); }
}

.workflow-controls__btn--abort:hover {
  background: #fecaca;
}

.workflow-controls__btn--abort:hover svg {
  fill: #991b1b;
}

.workflow-execution-panel {
  display: flex;
  justify-content: flex-start;
  padding: 8px;
  gap: 8px;
  margin-left: 30px;
}

.workflow-editor__notification {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 100;
}

.workflow-execution-panel .workflow-controls__btn--run,
.workflow-execution-panel .workflow-controls__btn--abort {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #cbd5e1;
}

/* Tooltip styles */
.workflow-controls__btn--tooltip {
  position: relative;
}

.workflow-controls__btn--tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  padding: 6px 10px;
  background: #1e293b;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 6px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
  pointer-events: none;
  z-index: 100;
}

.workflow-controls__btn--tooltip::before {
  content: '';
  position: absolute;
  right: calc(100% + 2px);
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-left-color: #1e293b;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
  pointer-events: none;
  z-index: 100;
}

.workflow-controls__btn--tooltip:hover::after,
.workflow-controls__btn--tooltip:hover::before {
  opacity: 1;
  visibility: visible;
}

/* Export/Import button styles */
.workflow-controls__btn--export,
.workflow-controls__btn--import {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.workflow-controls__btn--export:hover {
  background: #dbeafe;
}

.workflow-controls__btn--export:hover svg {
  fill: #1d4ed8;
}

.workflow-controls__btn--import:hover {
  background: #dcfce7;
}

.workflow-controls__btn--import:hover svg {
  fill: #166534;
}

/* Bottom panel tooltips - appear above */
.workflow-execution-panel .workflow-controls__btn--tooltip::after {
  right: auto;
  left: 50%;
  top: auto;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
}

.workflow-execution-panel .workflow-controls__btn--tooltip::before {
  right: auto;
  left: 50%;
  top: auto;
  bottom: calc(100% + 2px);
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1e293b;
  border-left-color: transparent;
}
</style>
