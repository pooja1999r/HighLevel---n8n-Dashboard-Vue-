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
import { nodeActionType, triggerNode, supportedNodeList } from './constants'
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
  workflowStore.syncFromFlow(getNodes.value, getEdges.value)
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

/** Tidy up nodes - arrange them in a clean layout based on connections */
function tidyUp() {
  const currentNodes = getNodes.value
  const currentEdges = getEdges.value
  if (currentNodes.length === 0) return

  const NODE_WIDTH = 180
  const NODE_HEIGHT = 80
  const HORIZONTAL_GAP = 100
  const VERTICAL_GAP = 60

  // Build adjacency list and find root nodes (no incoming edges)
  const incomingCount = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  
  currentNodes.forEach(n => {
    incomingCount.set(n.id, 0)
    outgoing.set(n.id, [])
  })
  
  currentEdges.forEach(e => {
    incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1)
    const list = outgoing.get(e.source) ?? []
    list.push(e.target)
    outgoing.set(e.source, list)
  })

  // Find root nodes (triggers or nodes with no incoming edges)
  const roots = currentNodes.filter(n => 
    n.data?.isTrigger === true || incomingCount.get(n.id) === 0
  )

  // BFS to assign levels
  const levels = new Map<string, number>()
  const queue: { id: string; level: number }[] = roots.map(n => ({ id: n.id, level: 0 }))
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { id, level } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    levels.set(id, Math.max(levels.get(id) ?? 0, level))
    
    const children = outgoing.get(id) ?? []
    children.forEach(childId => {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: level + 1 })
      }
    })
  }

  // Handle disconnected nodes
  currentNodes.forEach(n => {
    if (!levels.has(n.id)) {
      levels.set(n.id, 0)
    }
  })

  // Group nodes by level
  const nodesByLevel = new Map<number, typeof currentNodes>()
  currentNodes.forEach(n => {
    const level = levels.get(n.id) ?? 0
    const list = nodesByLevel.get(level) ?? []
    list.push(n)
    nodesByLevel.set(level, list)
  })

  // Calculate positions
  const maxLevel = Math.max(...Array.from(levels.values()))
  const updates: { id: string; position: { x: number; y: number } }[] = []

  for (let level = 0; level <= maxLevel; level++) {
    const nodesAtLevel = nodesByLevel.get(level) ?? []
    const totalWidth = nodesAtLevel.length * NODE_WIDTH + (nodesAtLevel.length - 1) * HORIZONTAL_GAP
    const startX = -totalWidth / 2 + NODE_WIDTH / 2

    nodesAtLevel.forEach((node, index) => {
      updates.push({
        id: node.id,
        position: {
          x: startX + index * (NODE_WIDTH + HORIZONTAL_GAP),
          y: level * (NODE_HEIGHT + VERTICAL_GAP) + 50,
        },
      })
    })
  }

  // Apply position updates
  updates.forEach(({ id, position }) => {
    const node = currentNodes.find(n => n.id === id)
    if (node) {
      node.position = position
    }
  })

  // Update the flow
  setFlowNodes([...currentNodes])
  nextTick(() => {
    persistToStore()
    fitView({ padding: 0.2 })
  })
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
    const errorMessage = failedEntry?.output?.error 
      ? String(failedEntry.output.error)
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
    const triggerOn = String(data['Trigger on'] ?? 'min')
    const between = Number(data[' between trigger'] ?? 1) || 1
    const timeStr = String(data['Time'] ?? '00:00')

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
  console.log('Switch off node:', id)
}

function onNodeDelete(id: string) {
  removeNodes([id])
}

function onNodeOpen(id: string) {
  const node = workflowStore.nodes.find((n) => n.id === id)
  if (node) nodeModalStore.openWorkflow(node)
}

function onNodeRename(id: string) {
  const name = window.prompt('Rename node')
  if (name != null && name.trim()) {
    updateNodeData(id, { label: name.trim() })
  }
}

function onNodeCopy(id: string) {
  const node = flowStore.findNode(id)
  if (!node) return
  const pos = node.position
  const label = (node.data?.label as string) ?? (node.label as string) ?? 'Node'
  const isTrigger = (node.data?.isTrigger as boolean) ?? false
  const { label: _l, isTrigger: _t, ...config } = (node.data ?? {}) as Record<string, unknown>
  addNewNode(pos.x + 180, pos.y + 100, `Copy of ${label}`, isTrigger, config)
}

function onNodeDuplicate(id: string) {
  const node = flowStore.findNode(id)
  if (!node) return
  const pos = node.position
  const label = (node.data?.label as string) ?? (node.label as string) ?? 'Node'
  const isTrigger = (node.data?.isTrigger as boolean) ?? false
  const { label: _l, isTrigger: _t, ...config } = (node.data ?? {}) as Record<string, unknown>
  addNewNode(pos.x + 200, pos.y, label, isTrigger, config)
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
      </Panel>
      <Panel v-if="hasNodes" position="bottom-center" class="workflow-execution-panel">
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
  justify-content: center;
  padding: 8px;
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
</style>
