<template>
  <div class="card">
    <h2>Crawler Settings</h2>

    <div class="flex flex-between flex-center mb-20">
      <div class="status-info">
        <span>Status: </span>
        <span :class="['status-badge', settings.isRunning ? 'status-running' : 'status-stopped']">
          {{ settings.isRunning ? 'Running' : 'Stopped' }}
        </span>
      </div>
      <div class="flex gap-10">
        <button
          class="btn btn-success"
          @click="handleStartScheduler"
          :disabled="settings.isRunning || loading"
        >
          Start Scheduler
        </button>
        <button
          class="btn btn-danger"
          @click="handleStopScheduler"
          :disabled="!settings.isRunning || loading"
        >
          Stop Scheduler
        </button>
      </div>
    </div>

    <div class="form-group">
      <label>Crawl Interval (minutes)</label>
      <div class="flex gap-10">
        <input
          type="number"
          v-model.number="intervalInput"
          min="1"
          max="1440"
          :disabled="loading"
        />
        <button
          class="btn btn-primary"
          @click="handleUpdateInterval"
          :disabled="loading || intervalInput === settings.intervalMinutes"
        >
          Update
        </button>
      </div>
    </div>

    <div class="form-group">
      <label>Product ID</label>
      <input type="text" v-model="settings.productId" disabled />
      <span class="text-muted">clrn0709701 (Prong Setting Solitaire Engagement Ring)</span>
    </div>

    <div class="manual-crawl mt-20">
      <button
        class="btn btn-primary"
        @click="handleManualCrawl"
        :disabled="crawling"
      >
        {{ crawling ? 'Crawling...' : 'Manual Crawl Now' }}
      </button>
      <span class="text-muted ml-10" v-if="crawling">
        This may take several minutes for all combinations...
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { CrawlSettings } from '@/types/diamond'

const props = defineProps<{
  settings: CrawlSettings
  loading: boolean
  crawling: boolean
}>()

const emit = defineEmits<{
  (e: 'start-scheduler'): void
  (e: 'stop-scheduler'): void
  (e: 'update-interval', interval: number): void
  (e: 'manual-crawl'): void
}>()

const intervalInput = ref(props.settings.intervalMinutes)

watch(() => props.settings.intervalMinutes, (newVal) => {
  intervalInput.value = newVal
})

function handleStartScheduler() {
  emit('start-scheduler')
}

function handleStopScheduler() {
  emit('stop-scheduler')
}

function handleUpdateInterval() {
  emit('update-interval', intervalInput.value)
}

function handleManualCrawl() {
  emit('manual-crawl')
}
</script>

<style scoped>
.status-info {
  font-size: 14px;
}

.mt-20 {
  margin-top: 20px;
}

.ml-10 {
  margin-left: 10px;
}

input[type="number"] {
  width: 100px;
}

input[type="text"] {
  width: 300px;
}
</style>
