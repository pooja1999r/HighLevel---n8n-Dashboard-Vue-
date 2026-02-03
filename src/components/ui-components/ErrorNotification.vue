<template>
  <Transition name="error-notification">
    <div
      v-if="visible"
      role="alert"
      class="error-notification"
      :class="{ 'error-notification--dismissible': dismissible }"
    >
      <span class="error-notification__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      </span>
      <p class="error-notification__message">{{ message }}</p>
      <button
        v-if="dismissible"
        type="button"
        class="error-notification__close"
        aria-label="Dismiss"
        @click="dismiss"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    message: string
    /** Whether the notification is shown. */
    modelValue?: boolean
    /** Allow user to dismiss via close button. */
    dismissible?: boolean
    /** Auto-dismiss after this many ms. 0 = no auto-dismiss. */
    autoDismissMs?: number
  }>(),
  {
    modelValue: true,
    dismissible: true,
    autoDismissMs: 0,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'dismiss'): void
}>()

const visible = ref(props.modelValue)
let autoDismissTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
    if (val && props.autoDismissMs > 0) {
      autoDismissTimer = setTimeout(dismiss, props.autoDismissMs)
    } else if (autoDismissTimer) {
      clearTimeout(autoDismissTimer)
      autoDismissTimer = null
    }
  },
  { immediate: true }
)

function dismiss() {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer)
    autoDismissTimer = null
  }
  visible.value = false
  emit('update:modelValue', false)
  emit('dismiss')
}
</script>

<style scoped>
.error-notification {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
}

.error-notification__icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.error-notification__icon svg {
  fill: currentColor;
}

.error-notification__message {
  flex: 1;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.error-notification__close {
  flex-shrink: 0;
  padding: 4px;
  margin: -4px -4px -4px 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #991b1b;
  cursor: pointer;
}

.error-notification__close:hover {
  background: #fee2e2;
}

.error-notification__close svg {
  fill: currentColor;
}

.error-notification-enter-active,
.error-notification-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.error-notification-enter-from,
.error-notification-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
