<template>
  <ul
    class="w-full rounded-md border border-slate-200 bg-white divide-y divide-slate-200"
  >
    <li v-if="!items.length" class="px-4 py-3 text-sm text-slate-500">
      {{ emptyText }}
    </li>
    <li
      v-for="item in items"
      :key="item"
      :draggable="draggable"
      @click="() => emit('itemClick', item)"
      @dragstart="onDragStart($event, item)"
      class="px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 flex items-center justify-between text-slate-900 select-none"
    >
      <span>{{ item }}</span>
      <span class="text-xs text-slate-400">{{ draggable ? 'Drag to canvas' : 'Click' }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    items: string[]
    emptyText?: string
    draggable?: boolean
    /** When true, dragged items are marked as trigger nodes (only lower edge, no incoming connections). */
    isTriggerList?: boolean
  }>(),
  {
    emptyText: 'No items found',
    draggable: false,
    isTriggerList: false,
  }
)

const emit = defineEmits<{
  (e: 'itemClick', item: string): void
}>()

function onDragStart(event: DragEvent, item: string) {
  if (!props.draggable || !event.dataTransfer) return
  event.dataTransfer.setData(
    'application/json',
    JSON.stringify({ label: item, isTrigger: props.isTriggerList })
  )
  event.dataTransfer.effectAllowed = 'move'
}
</script>