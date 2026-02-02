<script setup lang="ts">
import { markRaw, provide } from 'vue'
import {
  VueFlow,
  useVueFlow,
  Panel,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@vue-flow/core'
import WorkflowNode from './WorkflowNode.vue'

const WORKFLOW_NODE_HANDLERS_KEY = 'workflow-node-handlers'

const WORKFLOW_ID = 'workflow-editor'

const flowStore = useVueFlow(WORKFLOW_ID)
const {
  nodes,
  edges,
  addNodes,
  addEdges,
  removeNodes,
  applyNodeChanges,
  applyEdgeChanges,
  screenToFlowCoordinate,
  zoomIn,
  zoomOut,
  fitView,
  getNodes,
  updateNodeData,
} = flowStore

const nodeTypes = {
  default: markRaw(WorkflowNode),
  workflow: markRaw(WorkflowNode),
}

function onNodesChange(changes: NodeChange[]) {
  applyNodeChanges(changes)
}

function onEdgesChange(changes: EdgeChange[]) {
  applyEdgeChanges(changes)
}

function onConnect(connection: Connection) {
  addEdges([connection])
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const data = event.dataTransfer?.getData('application/json')
  if (!data) return
  try {
    const { label } = JSON.parse(data) as { label: string }
    const position = screenToFlowCoordinate({
      x: event.clientX,
      y: event.clientY,
    })
    addNewNode(position.x, position.y, label ?? 'Node')
  } catch {
    // ignore
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
}

function addNewNode(x: number, y: number, label: string) {
  addNodes({
    id: `node-${Date.now()}`,
    type: 'workflow',
    position: { x, y },
    label,
    data: { label },
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

function onNodeSwitchOff(id: string) {
  console.log('Switch off node:', id)
}

function onNodeDelete(id: string) {
  removeNodes([id])
}

function onNodeOpen(id: string) {
  console.log('Open node:', id)
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
  addNewNode(pos.x + 180, pos.y + 100, `Copy of ${label}`)
}

function onNodeDuplicate(id: string) {
  const node = flowStore.findNode(id)
  if (!node) return
  const pos = node.position
  const label = (node.data?.label as string) ?? (node.label as string) ?? 'Node'
  addNewNode(pos.x + 200, pos.y, label)
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
</style>
