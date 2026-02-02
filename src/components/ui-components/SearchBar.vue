<template>
  <div class="flex flex-col gap-2">
    <input
      v-model="search"
      type="text"
      :placeholder="placeholder"
      class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  items: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:results', value: string[]): void
}>()

const search = ref('')

const filteredItems = computed(() =>
  props.items.filter(item =>
    item.toLowerCase().includes(search.value.toLowerCase().trim())
  )
)

// Emit the filtered list whenever the search term or items change
watch(
  [search, () => props.items],
  () => {
    emit('update:results', filteredItems.value)
  },
  { immediate: true }
)
</script>