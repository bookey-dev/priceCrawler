<template>
  <div class="card">
    <h2>Crawl History</h2>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else-if="history.length === 0" class="empty-state">
      <p>No crawl history yet.</p>
    </div>

    <div v-else class="history-list">
      <div
        v-for="item in history"
        :key="item.id"
        class="history-item"
        :class="{ active: selectedId === item.id }"
        @click="$emit('select', item)"
      >
        <div class="history-info">
          <span class="history-date">{{ formatDate(item.crawledAt) }}</span>
          <span class="history-count">{{ item.totalItems }} items</span>
        </div>
        <div class="history-id text-muted">ID: {{ item.id }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CrawlResult } from '@/types/diamond'

defineProps<{
  history: CrawlResult[]
  loading: boolean
  selectedId?: string
}>()

defineEmits<{
  (e: 'select', result: CrawlResult): void
}>()

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString()
}
</script>

<style scoped>
.history-list {
  max-height: 400px;
  overflow-y: auto;
}

.history-item {
  padding: 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.history-item:hover {
  background-color: #f8f9fa;
}

.history-item.active {
  background-color: #e3f2fd;
  border-left: 3px solid #3498db;
}

.history-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.history-date {
  font-weight: 500;
}

.history-count {
  color: #27ae60;
  font-weight: 500;
}

.history-id {
  font-size: 11px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #888;
}
</style>
