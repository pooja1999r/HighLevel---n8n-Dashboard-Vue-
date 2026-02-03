<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { Handle, Position, type NodeProps } from '@vue-flow/core'
import { triggerNode } from './constants'

const WORKFLOW_NODE_HANDLERS_KEY = 'workflow-node-handlers'

const props = defineProps<NodeProps<{ label?: string; isTrigger?: boolean; muted?: boolean }>>()

/** Trigger nodes have only a lower edge (output); they cannot have incoming connections. */
const isTriggerNode = computed(() => {
  if (props.data?.isTrigger === true) return true
  const label = props.label ?? props.data?.label
  return typeof label === 'string' && triggerNode.some((t) => t.name === label)
})

/** Whether this node is muted (will not execute in workflow run) */
const isMuted = computed(() => props.data?.muted === true)

type Handlers = {
  onExecute: (id: string) => void
  onSwitchOff: (id: string) => void
  onDelete: (id: string) => void
  onOpen: (id: string) => void
  onRename: (id: string) => void
  onCopy: (id: string) => void
  onDuplicate: (id: string) => void
}

const handlers = inject<Handlers>(WORKFLOW_NODE_HANDLERS_KEY as string)

const showMenu = ref(false)
const showActions = ref(false)

const labelText = computed(() => {
  const l = props.label ?? props.data?.label
  return typeof l === 'string' ? l : 'Node'
})

function stopPropagation(e: Event) {
  e.stopPropagation()
}

function run(fn: keyof Handlers) {
  handlers?.[fn]?.(props.id)
}
</script>

<template>
  <div class="workflow-node">
    <!-- Trigger nodes: no upper edge (no target handle); only lower edge (children). -->
    <Handle v-if="!isTriggerNode" type="target" :position="Position.Top" :connectable="connectable" class="node-handle" />
    <Handle type="source" :position="Position.Bottom" :connectable="connectable" class="node-handle" />

    <div
      class="workflow-node__hover-zone"
      @mouseenter="showActions = true"
      @mouseleave="showActions = false; showMenu = false"
    >
      <!-- Invisible bridge + action bar above the node so cursor can move from node to buttons without leaving the zone -->
      <template v-if="showActions">
        <div class="workflow-node__bridge" aria-hidden="true" />
        <div class="workflow-node__actions" @mousedown="stopPropagation">
        <button
          type="button"
          class="workflow-node__btn workflow-node__btn--run"
          title="Execute"
          @click="run('onExecute')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <button
          v-if="!isTriggerNode"
          type="button"
          class="workflow-node__btn workflow-node__btn--switch"
          :class="{ 'workflow-node__btn--muted': isMuted }"
          :title="isMuted ? 'Enable node' : 'Disable node'"
          @click="run('onSwitchOff')"
        >
          <svg v-if="!isMuted" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0119 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.05.88-3.89 2.29-5.17L5.88 5.41A8.96 8.96 0 003 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.65-1.15-5.03-2.97-6.68l-.2-.15z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.902 7.902 0 014 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.902 7.902 0 0120 12c0 4.42-3.58 8-8 8z" />
          </svg>
        </button>
        <button
          type="button"
          class="workflow-node__btn workflow-node__btn--delete"
          title="Delete"
          @click="run('onDelete')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </button>

        <div class="workflow-node__menu-wrap">
          <button
            type="button"
            class="workflow-node__btn workflow-node__btn--dots"
            title="More"
            @click="showMenu = !showMenu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
          <div v-show="showMenu" class="workflow-node__dropdown" @click="showMenu = false">
            <button type="button" class="workflow-node__dropdown-item" @click="run('onOpen')">Open</button>
            <button type="button" class="workflow-node__dropdown-item" @click="run('onRename')">Rename</button>
            <button v-if="!isTriggerNode" type="button" class="workflow-node__dropdown-item" @click="run('onCopy')">Copy</button>
            <button v-if="!isTriggerNode" type="button" class="workflow-node__dropdown-item" @click="run('onDuplicate')">Duplicate</button>
          </div>
        </div>
        </div>
      </template>

      <div class="workflow-node__body" :class="{ 'workflow-node__body--muted': isMuted }">
        <span class="workflow-node__label">{{ labelText }}</span>
        <span v-if="isMuted" class="workflow-node__muted-badge">Disabled</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workflow-node {
  position: relative;
  min-width: 140px;
}

/* Hover zone: node body + invisible bridge + action bar. Cursor can stay in zone when moving to buttons. */
.workflow-node__hover-zone {
  position: relative;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Invisible bridge between node and action bar so we don't leave the zone when moving cursor up */
.workflow-node__bridge {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  height: 10px;
}

.workflow-node__body {
  position: relative;
}

.workflow-node__label {
  font-size: 13px;
  color: #334155;
  display: block;
}

.workflow-node__actions {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 5;
}

.workflow-node__btn {
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 4px;
  background: #f8fafc;
  color: #334155;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.workflow-node__btn svg {
  flex-shrink: 0;
  fill: #334155;
  width: 8px;
  height: 8px;
}

.workflow-node__btn:hover {
  background: #e2e8f0;
}

.workflow-node__btn:hover svg {
  fill: #0f172a;
}

.workflow-node__btn--run:hover {
  background: #dcfce7;
}

.workflow-node__btn--run:hover svg {
  fill: #166534;
}

.workflow-node__btn--delete:hover {
  background: #fee2e2;
}

.workflow-node__btn--delete:hover svg {
  fill: #991b1b;
}

.workflow-node__menu-wrap {
  position: relative;
}

.workflow-node__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 90px;
  z-index: 10;
}

.workflow-node__dropdown-item {
  display: block;
  width: 100%;
  padding: 4px 8px;
  border: none;
  background: none;
  text-align: left;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
}

.workflow-node__dropdown-item:hover {
  background: #f1f5f9;
}

.node-handle {
  width: 8px;
  height: 8px;
  background: #64748b;
  border: 2px solid #fff;
}

/* Muted node styles */
.workflow-node__body--muted {
  opacity: 0.5;
}

.workflow-node__btn--muted {
  background: #fef3c7;
}

.workflow-node__btn--muted:hover {
  background: #fde68a;
}

.workflow-node__btn--muted svg {
  fill: #d97706;
}

.workflow-node__muted-badge {
  display: block;
  font-size: 10px;
  color: #d97706;
  margin-top: 2px;
}
</style>
