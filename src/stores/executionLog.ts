import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ExecutionEntry {
  id: string
  nodeId: string
  nodeName: string
  input?: unknown
  output?: unknown
  durationMs: number
  status: 'success' | 'error'
}

export interface Execution {
  id: string
  startedAt: number
  durationMs: number
  status: 'success' | 'error'
  triggerDescription?: string
  entries: ExecutionEntry[]
}

export const useExecutionLogStore = defineStore('executionLog', () => {
  const execution = ref<Execution | null>(null)
  const selectedEntryId = ref<string | null>(null)
  /** When false, only the bar is visible and body is not in DOM. */
  const isLogPanelOpen = ref(true)

  const hasExecution = computed(() => execution.value != null)
  const entries = computed(() => execution.value?.entries ?? [])
  const selectedEntry = computed(() =>
    execution.value?.entries.find((e) => e.id === selectedEntryId.value) ?? null
  )

  function setLogPanelOpen(open: boolean) {
    isLogPanelOpen.value = open
  }

  function toggleLogPanel() {
    isLogPanelOpen.value = !isLogPanelOpen.value
  }

  function clearExecution() {
    execution.value = null
    selectedEntryId.value = null
  }

  function setExecution(value: Execution) {
    execution.value = value
    selectedEntryId.value = value.entries[0]?.id ?? null
  }

  function setSelectedEntryId(id: string | null) {
    selectedEntryId.value = id
  }

  return {
    execution,
    selectedEntryId,
    isLogPanelOpen,
    hasExecution,
    entries,
    selectedEntry,
    setLogPanelOpen,
    toggleLogPanel,
    clearExecution,
    setExecution,
    setSelectedEntryId,
  }
})
