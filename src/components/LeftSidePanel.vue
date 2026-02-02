<script setup lang="ts">
import { ref, computed } from 'vue'
import SearchBar from './ui-components/SearchBar.vue'
import ListView from './ui-components/ListView.vue'
import { useWorkflowStore } from '../stores/workflow'
import { triggerNode, supportedNodeList } from './constants'

const workflowStore = useWorkflowStore()

// When workflow has no nodes → show trigger list; otherwise show supportedNodeList.
// Workflow nodes are kept in the store (workflowStore.nodes).
const allItems = computed(() =>
  workflowStore.nodeCount === 0
    ? triggerNode.map((node) => node.name)
    : supportedNodeList.map((node) => node.name)
)

// What is currently visible in the list view (filtered by search).
// SearchBar re-emits when :items (allItems) changes, so this stays in sync when we switch lists.
const filteredItems = ref<string[]>([...allItems.value])

// Update visible list when SearchBar filters items
const handleResults = (items: string[]) => {
  filteredItems.value = items
}

// Handle click on a list item (for now, just log it)
const handleItemClick = (item: string) => {
  console.log('Clicked:', item)
}
</script>

<template>
  <aside class="h-screen w-64 bg-slate-900 text-slate-100 flex flex-col">
    <div class="p-3 border-b border-slate-800">
      <SearchBar
        :items="allItems"
        :placeholder="workflowStore.nodeCount === 0 ? 'Search triggers...' : 'Search nodes...'"
        @update:results="handleResults"
      />
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      <ListView
        :items="filteredItems"
        :draggable="true"
        :is-trigger-list="workflowStore.nodeCount === 0"
        :empty-text="workflowStore.nodeCount === 0 ? 'No triggers found' : 'No nodes found'"
        @itemClick="handleItemClick"
      />
    </div>
  </aside>
</template>