<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useNodeModalStore } from '../stores/nodeModal'
import type { ConfigField } from '../stores/nodeModal'
import { useWorkflowStore } from '../stores/workflow'
import { useVueFlow } from '@vue-flow/core'
import { triggerNode, supportedNodeList } from './constants' // Used in template
import {
  findTemplateByName,
  getFieldKey as getFieldKeyFromService,
  getDefaultValue as getDefaultValueFromService,
  generateExecutableCode,
  isTriggerNode,
  getConfigurationFields,
} from '../services/nodeService'

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

const workflowData = computed(() =>
  modalStore.payload?.type === 'workflow' ? modalStore.payload.data : null
)

/** Template name from payload or node label. */
const templateName = computed(() => {
  const p = modalStore.payload
  if (p?.type === 'template') return p.data.name
  if (workflowData.value?.label) return workflowData.value.label as string
  return ''
})

/** Config fields: from template found by name. */
const configFields = computed((): ConfigField[] => {
  if (!templateName.value) return []
  return getConfigurationFields(templateName.value) as ConfigField[]
})

const hasConfigForm = computed(() => configFields.value.length > 0)

/** Form state keyed by field labelType (or label as fallback). */
const formState = ref<Record<string, string | number | null>>({})

/** Get the key for a config field (labelType if available, otherwise label). */
function getFieldKey(field: ConfigField): string {
  return getFieldKeyFromService(field as Parameters<typeof getFieldKeyFromService>[0])
}

function getDefaultValue(field: ConfigField): unknown {
  return getDefaultValueFromService(field as Parameters<typeof getDefaultValueFromService>[0])
}

function initFormState() {
  const state: Record<string, string | number | null> = {}
  const savedConfig = { ...(workflowData.value?.data ?? {}) }
  
  // Get userInput from saved config (or use the config itself as fallback for backwards compatibility)
  const savedUserInput = (savedConfig.userInput as Record<string, unknown>) ?? savedConfig
  
  for (const field of configFields.value) {
    const key = getFieldKey(field)
    const value = savedUserInput[key] !== undefined ? savedUserInput[key] : getDefaultValue(field)
    state[key] = value as string | number | null
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
      const selectedValue = formState.value[getFieldKey(prev)]
      const valueStr = selectedValue != null ? String(selectedValue) : prev.options[0]?.value ?? ''
      return valueStr + field.label
    }
  }
  return field.label
}

/** Validate expression input - only allow numbers and math operators */
function validateExpression(event: Event) {
  const input = event.target as HTMLInputElement
  // Allow: numbers, operators (+ - * / % **), parentheses, dots, spaces
  const validPattern = /^[\d\s+\-*/%().^]*$/
  if (!validPattern.test(input.value)) {
    // Remove invalid characters
    input.value = input.value.replace(/[^\d\s+\-*/%().^]/g, '')
  }
}

/** Check if current HTTP method is GET (to hide body field) */
const isMethodGet = computed(() => {
  const method = formState.value['METHOD']
  return method === 'GET'
})

/** Check if a field should be visible based on conditions */
function isFieldVisible(field: ConfigField): boolean {
  const key = getFieldKey(field)
  // Hide BODY field when method is GET
  if (key === 'BODY' && isMethodGet.value) {
    return false
  }
  return true
}

/** Track JSON validation errors */
const jsonErrors = ref<Record<string, string>>({})

/** Validate JSON input and update error state */
function validateJson(field: ConfigField) {
  const key = getFieldKey(field)
  const value = formState.value[key]
  
  if (!value || String(value).trim() === '') {
    // Empty is allowed (will use default)
    delete jsonErrors.value[key]
    return
  }
  
  try {
    JSON.parse(String(value))
    delete jsonErrors.value[key]
  } catch {
    jsonErrors.value[key] = 'Invalid JSON format'
  }
}

/** Check if there are any validation errors */
const hasValidationErrors = computed(() => Object.keys(jsonErrors.value).length > 0)

/** Show Apply button when modal has a payload. */
const showApplySection = computed(() => !!modalStore.payload)

function onApply() {
  const name = templateName.value

  const template = findTemplateByName(name)
  const actionType =
    (template?.actionType as string | undefined) ||
    (template?.type as string | undefined) ||
    (workflowData.value?.data?.actionType as string | undefined) ||
    ''

  // Build userInput object with labelType keys and their values
  const userInput: Record<string, unknown> = {}
  for (const field of configFields.value) {
    const key = getFieldKey(field)
    userInput[key] = formState.value[key]
  }

  // Generate executable code using service
  const executableCode = generateExecutableCode(actionType, userInput)

  // Build the config with actionType and userInput
  const config: Record<string, unknown> = {
    actionType,
    userInput,
    executableCode,
    position: { x: 100, y: 100 }
  }

  // Calculate position for the node
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
  config.position = { x, y }

  // Update or add node
  if (workflowData.value) {
    // Update existing node on canvas
    const data = { ...workflowData.value.data, ...config }
    workflowStore.updateNodeData(workflowData.value.id, data)
    flowStore?.updateNodeData(workflowData.value.id, data)
  } else {
    // Add new node to canvas
    const isTrigger = isTriggerNode(name)
    const data = { label: name, isTrigger, ...config }
    flowStore?.addNodes?.({
      id: `node-${Date.now()}`,
      type: 'workflow',
      position: { x, y },
      label: name,
      data,
    })
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
          <!-- Description from template -->
          <p v-if="templateName" class="node-modal__description">
            {{ (triggerNode.find((n) => n.name === templateName) ?? supportedNodeList.find((n) => n.name === templateName))?.description ?? '' }}
          </p>

          <!-- Config form and Apply -->
          <template v-if="showApplySection">
            <form class="node-modal__form" @submit.prevent="onApply">
              <template v-if="hasConfigForm">
                <h3 class="node-modal__section-title">Configuration</h3>
                <div
                  v-for="(field, idx) in configFields"
                  v-show="isFieldVisible(field)"
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
                  v-model="formState[getFieldKey(field)]"
                  type="text"
                  class="node-modal__input"
                  :required="field.required"
                  :placeholder="(field as { placeholder?: string }).placeholder"
                />
                <!-- number -->
                <input
                  v-else-if="field.type === 'number'"
                  :id="`node-modal-field-${idx}`"
                  v-model.number="formState[getFieldKey(field)]"
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
                  v-model="formState[getFieldKey(field)]"
                  type="time"
                  class="node-modal__input"
                  :required="field.required"
                />
                <!-- select -->
                <select
                  v-else-if="field.type === 'select'"
                  :id="`node-modal-field-${idx}`"
                  v-model="formState[getFieldKey(field)]"
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
                <!-- code editor (JS/JSON) -->
                <div
                  v-else-if="field.type === 'code'"
                  class="node-modal__code-editor-wrap"
                  :class="{ 'node-modal__code-editor-wrap--error': jsonErrors[getFieldKey(field)] }"
                >
                  <div class="node-modal__code-editor-header">
                    <span class="node-modal__code-language">{{ (field as { language?: string }).language?.toUpperCase() || 'CODE' }}</span>
                    <span v-if="jsonErrors[getFieldKey(field)]" class="node-modal__code-error">
                      {{ jsonErrors[getFieldKey(field)] }}
                    </span>
                  </div>
                  <textarea
                    :id="`node-modal-field-${idx}`"
                    v-model="formState[getFieldKey(field)]"
                    class="node-modal__code-editor"
                    :class="{
                      'node-modal__code-editor--js': (field as { language?: string }).language === 'javascript',
                      'node-modal__code-editor--json': (field as { language?: string }).language === 'json',
                      'node-modal__code-editor--invalid': jsonErrors[getFieldKey(field)]
                    }"
                    :required="field.required"
                    :rows="(field as { rows?: number }).rows ?? 5"
                    spellcheck="false"
                    autocomplete="off"
                    autocorrect="off"
                    autocapitalize="off"
                    @blur="(field as { language?: string }).language === 'json' && validateJson(field)"
                    @input="(field as { language?: string }).language === 'json' && validateJson(field)"
                  />
                </div>
                <!-- expression (math only) -->
                <div
                  v-else-if="field.labelType === 'EXPRESSION_CODE'"
                  class="node-modal__expression-wrap"
                >
                  <input
                    :id="`node-modal-field-${idx}`"
                    v-model="formState[getFieldKey(field)]"
                    type="text"
                    class="node-modal__expression-input"
                    :required="field.required"
                    placeholder="e.g. 2 + 2 * 3"
                    @input="validateExpression($event)"
                  />
                </div>
                <!-- textarea -->
                <textarea
                  v-else-if="field.type === 'textarea'"
                  :id="`node-modal-field-${idx}`"
                  v-model="formState[getFieldKey(field)]"
                  class="node-modal__input node-modal__textarea"
                  :required="field.required"
                  :rows="(field as { rows?: number }).rows ?? 3"
                  :placeholder="(field as { placeholder?: string }).placeholder"
                />
                <!-- fallback text -->
                <input
                  v-else
                  :id="`node-modal-field-${idx}`"
                  v-model="formState[getFieldKey(field)]"
                  type="text"
                  class="node-modal__input"
                  :required="field.required"
                />
              </div>
              </template>
              <footer class="node-modal__footer">
                <button 
                  type="submit" 
                  class="node-modal__apply"
                  :disabled="hasValidationErrors"
                  :class="{ 'node-modal__apply--disabled': hasValidationErrors }"
                >
                  Apply
                </button>
                <p v-if="hasValidationErrors" class="node-modal__error-hint">
                  Please fix the validation errors above
                </p>
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

.node-modal__apply--disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.node-modal__apply--disabled:hover {
  background: #94a3b8;
}

.node-modal__error-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #dc2626;
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

/* Code Editor Styles */
.node-modal__code-editor-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #1e1e1e;
}

.node-modal__code-editor-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #3d3d3d;
}

.node-modal__code-language {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  letter-spacing: 0.5px;
}

.node-modal__code-editor {
  width: 100%;
  padding: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #d4d4d4;
  background: #1e1e1e;
  border: none;
  resize: vertical;
  min-height: 100px;
}

.node-modal__code-editor:focus {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.node-modal__code-editor--js {
  color: #9cdcfe;
}

.node-modal__code-editor--json {
  color: #ce9178;
}

/* Code editor error states */
.node-modal__code-editor-wrap--error {
  border-color: #dc2626;
}

.node-modal__code-editor--invalid {
  border: 2px solid #dc2626 !important;
}

.node-modal__code-editor--invalid:focus {
  box-shadow: inset 0 0 0 2px rgba(220, 38, 38, 0.3);
}

.node-modal__code-error {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  color: #f87171;
}

.node-modal__code-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Expression Input Styles */
.node-modal__expression-wrap {
  position: relative;
}

.node-modal__expression-input {
  width: 100%;
  padding: 12px 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 16px;
  font-weight: 500;
  color: #0f172a;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  text-align: center;
  letter-spacing: 1px;
}

.node-modal__expression-input:focus {
  outline: none;
  border-color: #3b82f6;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.node-modal__expression-input::placeholder {
  color: #94a3b8;
  font-weight: 400;
}
</style>
