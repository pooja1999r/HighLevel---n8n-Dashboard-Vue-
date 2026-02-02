<script setup lang="ts">
import { markRaw, provide, onMounted, nextTick } from 'vue'
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

function addNewNode(x: number, y: number, label: string, isTrigger = false) {
  addNodes({
    id: `node-${Date.now()}`,
    type: 'workflow',
    position: { x, y },
    label,
    data: { label, isTrigger },
  })
}

function onAddNode() {
  const currentNodes = getNodes.value
  if (currentNodes.length > 0) {
    let maxX = -Infinity
    let maxY = -Infinity
    currentNodes.forEach((n) => {
      const pos = n.position
      if (pos.x > maxX) maxX = pos.x
      if (pos.y > maxY) maxY = pos.y
    })
    addNewNode(maxX + 220, maxY, 'New Node')
  } else {
    addNewNode(100, 100, 'New Node')
  }
}

function onNodeExecute(id: string) {
  console.log('Execute node:', id)
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

function runWorkflow() {
  executionLogStore.clearExecution()
  const order = getExecutionOrder()
  if (order.length === 0) return
  const startedAt = Date.now()
  const entries: ExecutionEntry[] = order.map((node, index) => {
    const durationMs = 3 + (index % 7)
    const output: Record<string, unknown> = index === 0 ? { myNewField: 1 } : { result: `output from ${node.label}`, index }
    return {
      id: `entry-${node.id}-${startedAt}`,
      nodeId: node.id,
      nodeName: node.label,
      output,
      durationMs,
      status: 'success' as const,
    }
  })
  const durationMs = Date.now() - startedAt
  const execution: Execution = {
    id: `exec-${startedAt}`,
    startedAt,
    durationMs,
    status: 'success',
    triggerDescription: "When clicking 'Execute workflow'",
    entries,
  }
  executionLogStore.setExecution(execution)
}

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
  addNewNode(pos.x + 180, pos.y + 100, `Copy of ${label}`, isTrigger)
}

function onNodeDuplicate(id: string) {
  const node = flowStore.findNode(id)
  if (!node) return
  const pos = node.position
  const label = (node.data?.label as string) ?? (node.label as string) ?? 'Node'
  const isTrigger = (node.data?.isTrigger as boolean) ?? false
  addNewNode(pos.x + 200, pos.y, label, isTrigger)
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
        <button type="button" class="workflow-controls__btn workflow-controls__btn--add" title="Add node" @click="onAddNode">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
        <button type="button" class="workflow-controls__btn" title="Zoom to fit" @click="fitView()">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 4h6v2H4v6H2V4c0-1.1.9-2 2-2zm16 0c1.1 0 2 .9 2 2v6h-2V6h-6V4h6zM4 18h6v2H4c-1.1 0-2-.9-2-2v-6h2v6zm14 0v-6h2v6c0 1.1-.9 2-2 2h-6v-2h6z" />
          </svg>
        </button>
        <button type="button" class="workflow-controls__btn" title="Zoom in" @click="zoomIn()">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
        <button type="button" class="workflow-controls__btn" title="Zoom out" @click="zoomOut()">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z" />
          </svg>
        </button>
      </Panel>
      <Panel position="bottom-center" class="workflow-execution-panel">
        <button
          type="button"
          class="workflow-controls__btn workflow-controls__btn--run"
          title="Execution workflow"
          @click="runWorkflow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span class="workflow-controls__btn-label">Execution workflow</span>
        </button>
      </Panel>
    </VueFlow>

  </div>
</template>

<style scoped>
.workflow-editor {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  background: #e2e8f0;
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
  gap: 6px;
  width: auto;
  padding: 8px 10px;
}

.workflow-controls__btn--run:hover {
  background: #dcfce7;
}

.workflow-controls__btn--run:hover svg {
  fill: #166534;
}

.workflow-execution-panel {
  display: flex;
  justify-content: center;
  padding: 8px;
}

.workflow-execution-panel .workflow-controls__btn--run {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #cbd5e1;
}
</style>
