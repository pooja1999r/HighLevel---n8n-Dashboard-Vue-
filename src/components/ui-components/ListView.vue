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
      @click="() => emit('itemClick', item)"
       class="px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 flex items-center justify-between text-slate-900"
    >
      <span>{{ item }}</span>
      <span class="text-xs text-slate-400">Click</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    items: string[]
    emptyText?: string
  }>(),
  {
    emptyText: 'No items found',
  }
)

const emit = defineEmits<{
  (e: 'itemClick', item: string): void
}>()
</script>