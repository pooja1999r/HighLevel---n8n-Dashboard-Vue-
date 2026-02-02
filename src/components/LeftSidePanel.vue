<script setup lang="ts">
import { ref } from 'vue'
import SearchBar from './ui-components/SearchBar.vue'
import ListView from './ui-components/ListView.vue'
import { triggerNode } from './constants'

// Full list of trigger node names
const allItems = ref(triggerNode.map(node => node.name))

// What is currently visible in the list view
const filteredItems = ref<string[]>([...allItems.value])

// Update visible list when SearchBar filters items
const handleResults = (items: string[]) => {
  filteredItems.value = items
}

// Handle click on a list item (for now, just log it)
const handleItemClick = (item: string) => {
  console.log('Clicked trigger:', item)
}
</script>

<template>
  <aside class="h-screen w-64 bg-slate-900 text-slate-100 flex flex-col">
    <div class="p-3 border-b border-slate-800">
      <SearchBar
        :items="allItems"
        placeholder="Search triggers..."
        @update:results="handleResults"
      />
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      <ListView
      :items="filteredItems"
      :draggable="true"
      @itemClick="handleItemClick"
    />
    </div>
  </aside>
</template>