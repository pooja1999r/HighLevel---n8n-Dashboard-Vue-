import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WorkflowNodeState } from './workflow'

/** Config field from constants (configuration array item). */
export interface ConfigFieldOption {
  label: string
  value: string
}

export interface ConfigField {
  type: string
  label: string
  /** Key identifier for formState (uses this instead of label if provided) */
  labelType?: string
  description?: string
  required?: boolean
  default?: unknown
  options?: ConfigFieldOption[]
  placeholder?: string
  language?: string
  rows?: number
  min?: number
  max?: number
  step?: number
  accept?: string
}

/** Template node from constants (trigger or supported list). */
export interface TemplateNodeInfo {
  name: string
  description?: string
  icon?: string
  actions?: Array<{ name: string; description?: string }>
  configuration?: ConfigField[]
}

export type NodeModalPayload =
  | { type: 'template'; data: TemplateNodeInfo }
  | { type: 'workflow'; data: WorkflowNodeState }

export const useNodeModalStore = defineStore('nodeModal', () => {
  const isOpen = ref(false)
  const payload = ref<NodeModalPayload | null>(null)

  function openTemplate(data: TemplateNodeInfo) {
    payload.value = { type: 'template', data }
    isOpen.value = true
  }

  function openWorkflow(data: WorkflowNodeState) {
    payload.value = { type: 'workflow', data }
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    payload.value = null
  }

  return {
    isOpen,
    payload,
    openTemplate,
    openWorkflow,
    close,
  }
})
