<template>
  <Transition name="notification-banner">
    <div
      v-if="visible"
      :role="type === 'error' ? 'alert' : 'status'"
      class="notification-banner"
      :class="[
        `notification-banner--${type}`,
        { 'notification-banner--dismissible': dismissible }
      ]"
    >
      <span class="notification-banner__icon" aria-hidden="true">
        <!-- Error icon -->
        <svg v-if="type === 'error'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
        <!-- Success icon (checkmark) -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      </span>
      <p class="notification-banner__message">{{ message }}</p>
      <button
        v-if="dismissible"
        type="button"
        class="notification-banner__close"
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

<script lang="ts">
export type NotificationType = 'error' | 'success'
</script>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    message: string
    type: 'error' | 'success'
    /** Whether the notification is shown. */
    modelValue?: boolean
    /** Allow user to dismiss via close button. */
    dismissible?: boolean
    /** Auto-dismiss after this many ms. Defaults to 5000ms. 0 = no auto-dismiss. */
    autoDismissMs?: number
  }>(),
  {
    modelValue: true,
    dismissible: true,
    autoDismissMs: 5000,
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
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer)
      autoDismissTimer = null
    }
    if (val && props.autoDismissMs > 0) {
      autoDismissTimer = setTimeout(dismiss, props.autoDismissMs)
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
.notification-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  white-space: nowrap;
}

/* Error variant */
.notification-banner--error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

/* Success variant */
.notification-banner--success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.notification-banner__icon {
  flex-shrink: 0;
}

.notification-banner__icon svg {
  fill: currentColor;
}

.notification-banner__message {
  flex: 1;
  margin: 0;
  font-weight: 500;
}

.notification-banner__close {
  flex-shrink: 0;
  padding: 4px;
  margin: -4px -4px -4px 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.notification-banner--error .notification-banner__close:hover {
  background: #fee2e2;
}

.notification-banner--success .notification-banner__close:hover {
  background: #dcfce7;
}

.notification-banner__close svg {
  fill: currentColor;
}

/* Transitions */
.notification-banner-enter-active,
.notification-banner-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.notification-banner-enter-from,
.notification-banner-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
