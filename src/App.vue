<template>
  <div class="container">
    <h1>Diamond Price Crawler</h1>
    <p class="subtitle">Multi-Brand Diamond Price Comparison & Trends</p>

    <div v-if="brands.length > 0" class="tab-bar">
      <button
        v-for="brand in brands"
        :key="brand.id"
        class="tab-btn"
        :class="{ active: activeTab === brand.id }"
        @click="activeTab = brand.id"
      >
        <span class="status-dot" :class="brand.status.ready ? 'online' : 'offline'"></span>
        {{ brand.name }}
      </button>
    </div>
    <div v-else class="loading">Loading brands...</div>

    <SingleCrawl
      v-for="brand in brands"
      :key="brand.id"
      v-show="activeTab === brand.id"
      :brand="brand"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Brand } from '@/types/diamond'
import { getBrands } from '@/api'
import SingleCrawl from './components/SingleCrawl.vue'

const brands = ref<Brand[]>([])
const activeTab = ref('')
let statusTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  try {
    brands.value = await getBrands()
    if (brands.value.length > 0) {
      activeTab.value = brands.value[0].id
    }
    // 定时刷新品牌状态（爬虫初始化可能晚于服务器启动）
    statusTimer = setInterval(async () => {
      try {
        const updated = await getBrands()
        for (const b of updated) {
          const existing = brands.value.find(e => e.id === b.id)
          if (existing) {
            existing.status = b.status
          }
        }
      } catch (e) { /* ignore */ }
    }, 5000)
  } catch (e) {
    console.error('Failed to load brands:', e)
  }
})

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer)
})
</script>

<style scoped>
.subtitle {
  color: #666;
  margin-bottom: 20px;
  font-size: 14px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 14px;
}

.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: #fff;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex-wrap: wrap;
}

.tab-btn {
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #666;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.tab-btn.active {
  background: #3498db;
  color: white;
}

.tab-btn.active .status-dot.online {
  background: #a3e4a7;
}

.tab-btn.active .status-dot.offline {
  background: #f5a5a5;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online {
  background: #27ae60;
}

.status-dot.offline {
  background: #e74c3c;
}
</style>
