<script setup lang="ts">
import { ref, watch, computed } from 'vue'

export type ModalType = 'confirm' | 'prompt' | 'alert'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  message?: string
  type?: ModalType
  confirmText?: string
  cancelText?: string
  inputPlaceholder?: string
  inputValue?: string
  danger?: boolean
}>(), {
  title: 'Confirm',
  message: '',
  type: 'confirm',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  inputPlaceholder: '',
  inputValue: '',
  danger: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', value?: string): void
  (e: 'cancel'): void
}>()

const inputText = ref(props.inputValue)

// Reset input when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    inputText.value = props.inputValue
  }
})

// Update inputText when inputValue prop changes
watch(() => props.inputValue, (val) => {
  inputText.value = val
})

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function close() {
  isOpen.value = false
}

function handleConfirm() {
  if (props.type === 'prompt') {
    emit('confirm', inputText.value)
  } else {
    emit('confirm')
  }
  close()
}

function handleCancel() {
  emit('cancel')
  close()
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    handleCancel()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isOpen" class="confirm-modal__overlay" @click="handleOverlayClick">
        <Transition name="modal-scale">
          <div v-if="isOpen" class="confirm-modal__container" :class="{ 'confirm-modal__container--danger': danger }">
            <header class="confirm-modal__header">
              <h3 class="confirm-modal__title">{{ title }}</h3>
              <button type="button" class="confirm-modal__close" @click="handleCancel">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </header>
            
            <div class="confirm-modal__body">
              <p v-if="message" class="confirm-modal__message">{{ message }}</p>
              
              <!-- Input for prompt type -->
              <input
                v-if="type === 'prompt'"
                v-model="inputText"
                type="text"
                class="confirm-modal__input"
                :placeholder="inputPlaceholder"
                @keyup.enter="handleConfirm"
                autofocus
              />
            </div>
            
            <footer class="confirm-modal__footer">
              <button
                v-if="type !== 'alert'"
                type="button"
                class="confirm-modal__btn confirm-modal__btn--cancel"
                @click="handleCancel"
              >
                {{ cancelText }}
              </button>
              <button
                type="button"
                class="confirm-modal__btn confirm-modal__btn--confirm"
                :class="{ 'confirm-modal__btn--danger': danger }"
                @click="handleConfirm"
              >
                {{ confirmText }}
              </button>
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-modal__overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1000;
}

.confirm-modal__container {
  width: 100%;
  max-width: 400px;
  margin: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.confirm-modal__container--danger .confirm-modal__header {
  background: #fef2f2;
  border-bottom-color: #fecaca;
}

.confirm-modal__container--danger .confirm-modal__title {
  color: #991b1b;
}

.confirm-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.confirm-modal__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}

.confirm-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-modal__close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.confirm-modal__body {
  padding: 20px;
}

.confirm-modal__message {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #475569;
}

.confirm-modal__input {
  width: 100%;
  margin-top: 16px;
  padding: 10px 14px;
  font-size: 14px;
  color: #0f172a;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  outline: none;
  transition: all 0.15s ease;
}

.confirm-modal__input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.confirm-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.confirm-modal__btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-modal__btn--cancel {
  color: #475569;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.confirm-modal__btn--cancel:hover {
  background: #f1f5f9;
}

.confirm-modal__btn--confirm {
  color: #fff;
  background: #2563eb;
}

.confirm-modal__btn--confirm:hover {
  background: #1d4ed8;
}

.confirm-modal__btn--danger {
  background: #dc2626;
}

.confirm-modal__btn--danger:hover {
  background: #b91c1c;
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  transform: scale(0.95);
  opacity: 0;
}
</style>
