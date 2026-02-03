<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useNodeModalStore } from '../stores/nodeModal'
import type { ConfigField } from '../stores/nodeModal'
import { useWorkflowStore } from '../stores/workflow'
import { useVueFlow } from '@vue-flow/core'
import { triggerNode, supportedNodeList, nodeActionType } from './constants'

const modalStore = useNodeModalStore()
const workflowStore = useWorkflowStore()
let flowStore: ReturnType<typeof useVueFlow> | null = null
try {
  flowStore = useVueFlow('workflow-editor')
} catch {
  flowStore = null
}

const title = computed(() => {
  const p = modalStore.payload
  if (!p) return ''
  if (p.type === 'template') return p.data.name
  return (p.data.label as string) || p.data.id || 'Node'
})

const isTemplate = computed(() => modalStore.payload?.type === 'template')
const templateData = computed(() =>
  modalStore.payload?.type === 'template' ? modalStore.payload.data : null
)
const workflowData = computed(() =>
  modalStore.payload?.type === 'workflow' ? modalStore.payload.data : null
)

/** Template name (for template payload) or node label (for workflow payload, to find template config). */
const templateName = computed(() => {
  if (templateData.value) return templateData.value.name
  if (workflowData.value?.label) return workflowData.value.label as string
  return ''
})

/** Config fields: from template payload or from template found by workflow node label. */
const configFields = computed((): ConfigField[] => {
  if (templateData.value?.configuration?.length) return templateData.value.configuration as ConfigField[]
  if (!templateName.value) return []
  const template =
    triggerNode.find((n) => n.name === templateName.value) ??
    supportedNodeList.find((n) => n.name === templateName.value)
  const config = (template as { configuration?: ConfigField[] })?.configuration
  return config ?? []
})

const hasConfigForm = computed(() => configFields.value.length > 0)

/** Form state keyed by field label. */
const formState = ref<Record<string, unknown>>({})

function getDefaultValue(field: ConfigField): unknown {
  const d = field.default
  if (d != null && typeof d === 'object' && 'value' in d && typeof (d as { value: unknown }).value === 'string') {
    return (d as { value: string }).value
  }
  return d ?? (field.type === 'number' ? 0 : '')
}

function initFormState() {
  const state: Record<string, unknown> = {}
  const saved = isTemplate.value
    ? workflowStore.getTemplateConfig(templateName.value)
    : { ...(workflowData.value?.data ?? {}) }
  for (const field of configFields.value) {
    const key = field.label
    state[key] = saved[key] !== undefined ? saved[key] : getDefaultValue(field)
  }
  formState.value = state
}

watch(
  () => [modalStore.isOpen, modalStore.payload] as const,
  () => {
    if (modalStore.isOpen && hasConfigForm.value) initFormState()
  },
  { immediate: true }
)

/** For " between trigger" number field: show selected option value from previous select before the label (e.g. "min between trigger"). */
function getFieldLabel(field: ConfigField, index: number): string {
  if (field.type === 'number' && field.label === ' between trigger' && index > 0) {
    const prev = configFields.value[index - 1]
    if (prev?.type === 'select' && prev.options?.length) {
      const selectedValue = formState.value[prev.label]
      const valueStr = selectedValue != null ? String(selectedValue) : prev.options[0]?.value ?? ''
      return valueStr + field.label
    }
  }
  return field.label
}

/** Show Apply button when modal has a template or workflow node (even if no config fields). */
const showApplySection = computed(() => (isTemplate.value && templateData.value) || !!workflowData.value)

function onApply() {
  const config = { ...formState.value }
  const name = templateName.value

  const template =
    triggerNode.find((n) => n.name === name) ??
    supportedNodeList.find((n) => n.name === name)
  const actionType =
    (template?.type as string | undefined) ||
    (workflowData.value?.data?.actionType as string | undefined) ||
    ''

  if (actionType) {
    let executableCode = ''
    if (actionType === nodeActionType.RUN_CODE) {
      executableCode = String(config['JavaScript Code'] ?? '')
    } else if (actionType === nodeActionType.API_CALL) {
      const url = String(config['URL'] ?? '')
      const method = String(config['Method'] ?? 'GET')
      const headersRaw = String(config['Headers'] ?? '')
      const bodyRaw = String(config['Body'] ?? '')
      let headersObj: Record<string, string> = {}
      try {
        headersObj = headersRaw ? JSON.parse(headersRaw) : {}
      } catch {
        headersObj = {}
      }
      const headersJson = JSON.stringify(headersObj)
      const bodyExpr = bodyRaw ? JSON.stringify(bodyRaw) : 'undefined'
      executableCode = `fetch(${JSON.stringify(url)}, { method: ${JSON.stringify(method)}, headers: ${headersJson}, body: ${bodyExpr} })`
    } else if (actionType === nodeActionType.COMPUTATION) {
      executableCode = String(config['Expression Code'] ?? '')
    }

    config.actionType = actionType
    if (executableCode) {
      config[actionType] = executableCode
    }
  }

  if (isTemplate.value && templateData.value) {
    // Apply from list (template): save config, then add or update node in Vue Flow
    workflowStore.setTemplateConfig(name, config)
    const existing = workflowStore.nodes.find((n) => (n.label ?? n.data?.label) === name)
    if (existing) {
      workflowStore.updateNodeData(existing.id, config)
      flowStore?.updateNodeData(existing.id, config)
    } else {
      // Not in Vue Flow: add new node with full configuration
      const isTrigger = triggerNode.some((n) => n.name === name)
      const data = { label: name, isTrigger, ...config }
      const nodes = flowStore?.getNodes?.value ?? []
      let x = 100
      let y = 100
      if (nodes.length > 0) {
        let maxX = -Infinity
        let maxY = -Infinity
        nodes.forEach((n: { position: { x: number; y: number } }) => {
          if (n.position.x > maxX) maxX = n.position.x
          if (n.position.y > maxY) maxY = n.position.y
        })
        x = maxX + 220
        y = maxY
      }
      flowStore?.addNodes?.({
        id: `node-${Date.now()}`,
        type: 'workflow',
        position: { x, y },
        label: name,
        data,
      })
    }
  } else if (workflowData.value) {
    // Apply from canvas (Open): update current node
    const data = { ...workflowData.value.data, ...config }
    workflowStore.updateNodeData(workflowData.value.id, data)
    flowStore?.updateNodeData(workflowData.value.id, data)
  }
  modalStore.close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="node-modal">
      <div
        v-if="modalStore.isOpen"
        class="node-modal-backdrop"
        aria-hidden="true"
        @click="modalStore.close()"
      />
    </Transition>
    <Transition name="node-modal-panel">
      <aside
        v-if="modalStore.isOpen"
        class="node-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-modal-title"
        @click.stop
      >
        <header class="node-modal__header">
          <h2 id="node-modal-title" class="node-modal__title">{{ title }}</h2>
          <button
            type="button"
            class="node-modal__close"
            title="Close"
            aria-label="Close"
            @click="modalStore.close()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </header>
        <div class="node-modal__body">
          <!-- Description (template or workflow with template) -->
          <template v-if="templateData?.description || (workflowData && templateName)">
            <p v-if="templateData?.description" class="node-modal__description">
              {{ templateData.description }}
            </p>
            <p v-else-if="workflowData" class="node-modal__description">
              {{ (triggerNode.find((n) => n.name === templateName) ?? supportedNodeList.find((n) => n.name === templateName))?.description ?? '' }}
            </p>
          </template>

          <!-- Template-only: actions list -->
          <template v-if="isTemplate && templateData?.actions?.length">
            <h3 class="node-modal__section-title">Actions</h3>
            <ul class="node-modal__list">
              <li
                v-for="(action, i) in templateData.actions"
                :key="i"
                class="node-modal__list-item"
              >
                <strong>{{ action.name }}</strong>
                <span v-if="action.description">{{ action.description }}</span>
              </li>
            </ul>
          </template>

          <!-- Config form and Apply (template or workflow node; show Apply even when no config fields) -->
          <template v-if="showApplySection">
            <form class="node-modal__form" @submit.prevent="onApply">
              <template v-if="hasConfigForm">
                <h3 class="node-modal__section-title">Configuration</h3>
                <div
                  v-for="(field, idx) in configFields"
                  :key="idx"
                  class="node-modal__field"
                >
                <label :for="`node-modal-field-${idx}`" class="node-modal__label">
                  {{ getFieldLabel(field, idx) }}
                  <span v-if="field.required" class="node-modal__required">*</span>
                </label>
                <p v-if="field.description" class="node-modal__field-desc">{{ field.description }}</p>
                <!-- text -->
                <input
                  v-if="field.type === 'text'"
                  :id="`node-modal-field-${idx}`"
                  v-model="formState[field.label]"
                  type="text"
                  class="node-modal__input"
                  :required="field.required"
                  :placeholder="(field as { placeholder?: string }).placeholder"
                />
                <!-- number -->
                <input
                  v-else-if="field.type === 'number'"
                  :id="`node-modal-field-${idx}`"
                  v-model.number="formState[field.label]"
                  type="number"
                  class="node-modal__input"
                  :required="field.required"
                  :min="(field as { min?: number }).min"
                  :max="(field as { max?: number }).max"
                />
                <!-- time -->
                <input
                  v-else-if="field.type === 'time'"
                  :id="`node-modal-field-${idx}`"
                  v-model="formState[field.label]"
                  type="time"
                  class="node-modal__input"
                  :required="field.required"
                />
                <!-- select -->
                <select
                  v-else-if="field.type === 'select'"
                  :id="`node-modal-field-${idx}`"
                  v-model="formState[field.label]"
                  class="node-modal__input node-modal__select"
                  :required="field.required"
                >
                  <option
                    v-for="opt in field.options"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
                <!-- textarea -->
                <textarea
                  v-else-if="field.type === 'textarea'"
                  :id="`node-modal-field-${idx}`"
                  v-model="formState[field.label]"
                  class="node-modal__input node-modal__textarea"
                  :required="field.required"
                  :rows="(field as { rows?: number }).rows ?? 3"
                  :placeholder="(field as { placeholder?: string }).placeholder"
                />
                <!-- fallback text -->
                <input
                  v-else
                  :id="`node-modal-field-${idx}`"
                  v-model="formState[field.label]"
                  type="text"
                  class="node-modal__input"
                  :required="field.required"
                />
              </div>
              </template>
              <footer class="node-modal__footer">
                <button type="submit" class="node-modal__apply">
                  Apply
                </button>
              </footer>
            </form>
          </template>

          <!-- Workflow node without config form: show raw info -->
          <template v-else-if="workflowData">
            <dl class="node-modal__dl">
              <dt>ID</dt>
              <dd>{{ workflowData.id }}</dd>
              <dt>Type</dt>
              <dd>{{ workflowData.type }}</dd>
              <dt>Label</dt>
              <dd>{{ workflowData.label ?? '—' }}</dd>
              <dt>Position</dt>
              <dd>({{ workflowData.position.x }}, {{ workflowData.position.y }})</dd>
              <template v-if="workflowData.data && Object.keys(workflowData.data).length">
                <dt>Data</dt>
                <dd>
                  <pre class="node-modal__pre">{{ JSON.stringify(workflowData.data, null, 2) }}</pre>
                </dd>
              </template>
            </dl>
          </template>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.node-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.node-modal {
  position: fixed;
  top: 0;
  right: 0;
  width: 50%;
  max-width: 50vw;
  height: 100vh;
  background: #fff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  display: flex;
  flex-direction: column;
}

.node-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.node-modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.node-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: #f1f5f9;
  color: #475569;
  cursor: pointer;
}

.node-modal__close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.node-modal__close svg {
  fill: currentColor;
}

.node-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.node-modal__description {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #475569;
}

.node-modal__section-title {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.node-modal__list {
  margin: 0;
  padding-left: 20px;
  list-style: disc;
}

.node-modal__list-item {
  margin-bottom: 6px;
  font-size: 14px;
  color: #334155;
}

.node-modal__list-item strong {
  display: inline-block;
  min-width: 80px;
  color: #0f172a;
}

.node-modal__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.node-modal__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-modal__label {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.node-modal__required {
  color: #dc2626;
}

.node-modal__field-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.node-modal__input {
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #0f172a;
  background: #fff;
}

.node-modal__input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.node-modal__select {
  cursor: pointer;
}

.node-modal__textarea {
  min-height: 80px;
  resize: vertical;
}

.node-modal__footer {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.node-modal__apply {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #2563eb;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.node-modal__apply:hover {
  background: #1d4ed8;
}

.node-modal__dl {
  margin: 0;
  font-size: 14px;
}

.node-modal__dl dt {
  margin-top: 12px;
  font-weight: 600;
  color: #64748b;
}

.node-modal__dl dt:first-child {
  margin-top: 0;
}

.node-modal__dl dd {
  margin: 4px 0 0;
  color: #0f172a;
}

.node-modal__pre {
  margin: 0;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Transitions */
.node-modal-enter-active,
.node-modal-leave-active {
  transition: opacity 0.2s ease;
}

.node-modal-enter-from,
.node-modal-leave-to {
  opacity: 0;
}

.node-modal-panel-enter-active,
.node-modal-panel-leave-active {
  transition: transform 0.25s ease;
}

.node-modal-panel-enter-from,
.node-modal-panel-leave-to {
  transform: translateX(100%);
}
</style>
