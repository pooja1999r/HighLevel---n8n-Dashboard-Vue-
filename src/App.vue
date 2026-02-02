<script setup lang="ts">
import LeftSidePanel from './components/LeftSidePanel.vue'
import WorkFlowEditor from './components/WorkFlowEditor.vue'
</script>

<template>
  <div class="app-root">
    <LeftSidePanel />
    <main class="app-main">
      <WorkFlowEditor />
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
