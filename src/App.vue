<script setup lang="ts">
import LeftSidePanel from './components/LeftSidePanel.vue'
import WorkFlowEditor from './components/WorkFlowEditor.vue'
import ExecutionLogPanel from './components/ExecutionLogPanel.vue'
import NodeInfoModal from './components/modal/NodeInfoModal.vue'
import { useExecutionLogStore } from './stores/executionLog'

const executionLogStore = useExecutionLogStore()
</script>

<template>
  <div class="app-root">
    <NodeInfoModal />
    <LeftSidePanel />
    <main class="app-main">
      <div class="app-editor">
        <WorkFlowEditor />
      </div>
      <div
        class="app-terminal"
        :class="{ 'app-terminal--collapsed': !executionLogStore.isLogPanelOpen }"
      >
        <ExecutionLogPanel />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  background: #f1f5f9;
}

.app-main {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-editor {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
}

.app-terminal {
  flex: 0 0 280px;
  min-height: 200px;
  max-height: 40vh;
  width: 100%;
  min-width: 0;
  display: flex;
}

.app-terminal--collapsed {
  flex: 0 0 auto;
  min-height: 0;
  max-height: none;
  height: auto;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
