<script setup lang="ts">
import { computed } from 'vue'
import { useExecutionLogStore } from '../stores/executionLog'
import type { ExecutionEntry } from '../stores/executionLog'

const logStore = useExecutionLogStore()

const activeTab = computed(() => 'output' as 'input' | 'output')

/** Flatten output to key-value rows for table. If output is a plain object, one row per key. */
function outputRows(entry: ExecutionEntry | null): { key: string; value: string }[] {
  if (!entry?.output) return []
  const out = entry.output
  if (out === null || typeof out !== 'object') {
    return [{ key: '', value: String(out) }]
  }
  if (Array.isArray(out)) {
    return out.map((v, i) => ({ key: String(i), value: formatValue(v) }))
  }
  return Object.entries(out).map(([k, v]) => ({ key: k, value: formatValue(v) }))
}

function formatValue(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<template>
  <div class="execution-log" :class="{ 'execution-log--collapsed': !logStore.isLogPanelOpen }">
    <!-- Collapsed: only this bar is in DOM; body is removed (v-if). Height = bar only. -->
    <header class="execution-log__bar">
      <button
        type="button"
        class="execution-log__toggle"
        :title="logStore.isLogPanelOpen ? 'Close logs' : 'Open logs'"
        @click="logStore.toggleLogPanel()"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="execution-log__toggle-icon"
        >
          <path v-if="logStore.isLogPanelOpen" d="M7 10l5 5 5-5H7z" />
          <path v-else d="M7 14l5-5 5 5H7z" />
        </svg>
      </button>
      <h2 class="execution-log__title">Logs</h2>
      <button
        type="button"
        class="execution-log__clear"
        title="Clear execution"
        :disabled="!logStore.hasExecution"
        @click="logStore.clearExecution()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
        </svg>
        Clear execution
      </button>
    </header>

    <div v-if="logStore.isLogPanelOpen" class="execution-log__body">
    <aside class="execution-log__sidebar">
      <header class="execution-log__header">
        <h2 class="execution-log__header-title">Logs</h2>
        <button
          type="button"
          class="execution-log__clear execution-log__clear--in-sidebar"
          title="Clear execution"
          :disabled="!logStore.hasExecution"
          @click="logStore.clearExecution()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
          Clear execution
        </button>
      </header>
      <template v-if="logStore.execution">
        <div class="execution-log__summary">
          Success in {{ logStore.execution.durationMs }}ms
        </div>
        <div v-if="logStore.execution.triggerDescription" class="execution-log__trigger">
          {{ logStore.execution.triggerDescription }}
        </div>
        <ul class="execution-log__list">
          <li
            v-for="entry in logStore.entries"
            :key="entry.id"
            class="execution-log__item"
            :class="{ 'execution-log__item--active': entry.id === logStore.selectedEntryId }"
            @click="logStore.setSelectedEntryId(entry.id)"
          >
            <span class="execution-log__item-icon" aria-hidden="true">{}</span>
            <span class="execution-log__item-name">{{ entry.nodeName }}</span>
          </li>
        </ul>
      </template>
      <div v-else class="execution-log__empty">
        No execution yet. Click "Execution workflow" to run.
      </div>
    </aside>

    <section class="execution-log__detail">
      <template v-if="logStore.selectedEntry">
        <header class="execution-log__detail-header">
          <h3 class="execution-log__detail-title">
            <span class="execution-log__detail-icon">{}</span>
            {{ logStore.selectedEntry.nodeName }}
          </h3>
          <span class="execution-log__detail-status">
            Success in {{ logStore.selectedEntry.durationMs }}ms
          </span>
          <div class="execution-log__detail-tabs">
            <button type="button" class="execution-log__tab" :class="{ 'execution-log__tab--active': activeTab === 'input' }">
              Input
            </button>
            <button type="button" class="execution-log__tab execution-log__tab--active">
              Output
            </button>
          </div>
        </header>
        <div class="execution-log__content">
          <div class="execution-log__content-header">
            <span class="execution-log__content-title">OUTPUT</span>
            <span class="execution-log__content-meta">{{ outputRows(logStore.selectedEntry).length }} item(s)</span>
          </div>
          <div class="execution-log__table-wrap">
            <table class="execution-log__table">
              <thead>
                <tr>
                  <th class="execution-log__th">Key</th>
                  <th class="execution-log__th">Value</th>
                </tr>
              </thead>
              <tbody class="execution-log__tbody">
                <tr v-for="row in outputRows(logStore.selectedEntry)" :key="row.key || row.value">
                  <td class="execution-log__td execution-log__td--key">{{ row.key || '—' }}</td>
                  <td class="execution-log__td">{{ row.value }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
      <div v-else class="execution-log__detail-empty">
        Select a node from the list to view output.
      </div>
    </section>
    </div>
  </div>
</template>

<style scoped>
.execution-log {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: #1e293b;
  color: #e2e8f0;
  border-top: 1px solid #334155;
}

.execution-log--collapsed {
  min-height: 0;
  height: auto;
}

.execution-log__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.execution-log--collapsed .execution-log__bar {
  border-bottom: none;
}

.execution-log__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #94a3b8;
  cursor: pointer;
}

.execution-log__toggle:hover {
  color: #e2e8f0;
  background: #334155;
}

.execution-log__toggle-icon {
  flex-shrink: 0;
  fill: currentColor;
}

.execution-log__bar .execution-log__title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  text-align: left;
}

.execution-log__body {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.execution-log__sidebar {
  width: 240px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #334155;
}

.execution-log__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid #334155;
}

.execution-log__header-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.execution-log__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.execution-log__clear {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: #94a3b8;
  background: transparent;
  border: 1px solid #475569;
  border-radius: 6px;
  cursor: pointer;
}

.execution-log__clear:hover:not(:disabled) {
  color: #e2e8f0;
  background: #334155;
}

.execution-log__clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.execution-log__clear svg {
  flex-shrink: 0;
  fill: currentColor;
}

.execution-log__summary {
  padding: 10px 12px;
  font-size: 13px;
  color: #86efac;
}

.execution-log__trigger {
  padding: 0 12px 8px;
  font-size: 12px;
  color: #94a3b8;
}

.execution-log__list {
  flex: 1;
  overflow-y: auto;
  margin: 0;
  padding: 4px 0;
  list-style: none;
}

.execution-log__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}

.execution-log__item:hover {
  background: #334155;
}

.execution-log__item--active {
  background: #334155;
}

.execution-log__item-icon {
  font-size: 12px;
  color: #94a3b8;
}

.execution-log__item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.execution-log__empty {
  flex: 1;
  padding: 16px 12px;
  font-size: 13px;
  color: #64748b;
}

.execution-log__detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.execution-log__detail-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #334155;
}

.execution-log__detail-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.execution-log__detail-icon {
  font-size: 12px;
  color: #94a3b8;
}

.execution-log__detail-status {
  font-size: 12px;
  color: #86efac;
}

.execution-log__detail-tabs {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.execution-log__tab {
  padding: 6px 12px;
  font-size: 12px;
  color: #94a3b8;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.execution-log__tab--active {
  color: #f1f5f9;
  background: #7c2d12;
}

.execution-log__content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.execution-log__content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.execution-log__content-title {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.05em;
}

.execution-log__content-meta {
  font-size: 12px;
  color: #64748b;
}

.execution-log__table-wrap {
  overflow: auto;
  border: 1px solid #334155;
  border-radius: 8px;
}

.execution-log__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.execution-log__th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #94a3b8;
  background: #0f172a;
  border-bottom: 1px solid #334155;
}

.execution-log__td {
  padding: 10px 12px;
  border-bottom: 1px solid #334155;
  color: #e2e8f0;
}

.execution-log__td--key {
  font-weight: 600;
  color: #f1f5f9;
}

.execution-log__tbody tr:last-child .execution-log__td {
  border-bottom: none;
}

.execution-log__detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-size: 13px;
  color: #64748b;
}
</style>
