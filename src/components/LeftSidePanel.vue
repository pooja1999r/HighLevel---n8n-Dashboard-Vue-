<script setup lang="ts">
import { ref, computed } from 'vue'
import SearchBar from './ui-components/SearchBar.vue'
import ListView from './ui-components/ListView.vue'
import { useWorkflowStore } from '../stores/workflow'
import { useNodeModalStore } from '../stores/nodeModal'
import { triggerNode, supportedNodeList } from './constants'

const workflowStore = useWorkflowStore()
const nodeModalStore = useNodeModalStore()

// No trigger node on canvas → show trigger list (so user can add one).
// Has trigger node → show supported nodes only. Delete trigger → show trigger list again.
const allItems = computed(() =>
  workflowStore.hasTriggerNode
    ? supportedNodeList.map((node) => node.name)
    : triggerNode.map((node) => node.name)
)

// What is currently visible in the list view (filtered by search).
// SearchBar re-emits when :items (allItems) changes, so this stays in sync when we switch lists.
const filteredItems = ref<string[]>([...allItems.value])

// Update visible list when SearchBar filters items
const handleResults = (items: string[]) => {
  filteredItems.value = items
}

// Handle click on a list item: open node info modal with template data
const handleItemClick = (item: string) => {
  const template =
    triggerNode.find((n) => n.name === item) ??
    supportedNodeList.find((n) => n.name === item)
  if (template) {
    const t = template as {
      name: string
      description?: string
      icon?: string
      url?: string
      actions?: Array<{ name: string; description?: string }>
      configuration?: Array<Record<string, unknown>>
    }
    nodeModalStore.openTemplate({
      name: t.name,
      description: t.description,
      icon: t.icon,
      url: t.url,
      actions: t.actions,
      configuration: t.configuration,
    })
  }
}
</script>

<template>
  <aside class="h-screen w-64 bg-slate-900 text-slate-100 flex flex-col">
    <div class="p-3 border-b border-slate-800">
      <SearchBar
        :items="allItems"
        :placeholder="workflowStore.hasTriggerNode ? 'Search nodes...' : 'Search triggers...'"
        @update:results="handleResults"
      />
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      <ListView
        :items="filteredItems"
        :draggable="true"
        :is-trigger-list="!workflowStore.hasTriggerNode"
        :empty-text="workflowStore.hasTriggerNode ? 'No nodes found' : 'No triggers found'"
        @itemClick="handleItemClick"
      />
    </div>
  </aside>
</template>