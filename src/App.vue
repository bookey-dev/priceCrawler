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
import { ref, onMounted } from 'vue'
import type { Brand } from '@/types/diamond'
import { getBrands } from '@/api'
import SingleCrawl from './components/SingleCrawl.vue'

const brands = ref<Brand[]>([])
const activeTab = ref('')

onMounted(async () => {
  try {
    brands.value = await getBrands()
    if (brands.value.length > 0) {
      activeTab.value = brands.value[0].id
    }
  } catch (e) {
    console.error('Failed to load brands:', e)
  }
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
