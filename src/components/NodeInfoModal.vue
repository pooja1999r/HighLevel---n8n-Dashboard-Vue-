<script setup lang="ts">
import { computed } from 'vue'
import { useNodeModalStore } from '../stores/nodeModal'

const modalStore = useNodeModalStore()

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
          <!-- Template node (from LeftSidePanel list) -->
          <template v-if="isTemplate && templateData">
            <p v-if="templateData.description" class="node-modal__description">
              {{ templateData.description }}
            </p>
            <template v-if="templateData.actions?.length">
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
          </template>
          <!-- Workflow node (from canvas Open button) -->
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
