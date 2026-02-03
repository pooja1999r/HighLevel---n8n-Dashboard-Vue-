import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ExecutionEntry {
  id: string
  nodeId: string
  nodeName: string
  input?: unknown
  output?: unknown
  durationMs: number
  status: 'success' | 'error' | 'skipped'
}

export interface Execution {
  id: string
  startedAt: number
  durationMs: number
  status: 'success' | 'error'
  triggerDescription?: string
  /** Formatted time when execution was run (e.g. "2:45:30 PM") */
  executedAtFormatted?: string
  entries: ExecutionEntry[]
}

export type NotificationType = 'error' | 'success'

export interface Notification {
  type: NotificationType
  message: string
}

export const useExecutionLogStore = defineStore('executionLog', () => {
  const execution = ref<Execution | null>(null)
  const selectedEntryId = ref<string | null>(null)
  /** When false, only the bar is visible and body is not in DOM. */
  const isLogPanelOpen = ref(true)
  /** Error message to show (e.g. "trigger node is required"). */
  const errorMessage = ref<string | null>(null)
  /** Show success banner after execution. */
  const showSuccessBanner = ref(false)
  /** Unified notification state */
  const notification = ref<Notification | null>(null)

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

  function setError(message: string) {
    errorMessage.value = message
  }

  function clearError() {
    errorMessage.value = null
  }

  function setSuccessBanner() {
    showSuccessBanner.value = true
  }

  function clearSuccessBanner() {
    showSuccessBanner.value = false
  }

  /** Set unified notification (error or success) */
  function setNotification(type: NotificationType, message: string) {
    notification.value = { type, message }
  }

  /** Clear unified notification */
  function clearNotification() {
    notification.value = null
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
    errorMessage,
    showSuccessBanner,
    notification,
    setLogPanelOpen,
    toggleLogPanel,
    clearExecution,
    setExecution,
    setSelectedEntryId,
    setError,
    clearError,
    setSuccessBanner,
    clearSuccessBanner,
    setNotification,
    clearNotification,
  }
})
