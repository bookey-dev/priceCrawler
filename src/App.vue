<template>
  <div class="container">
    <div class="page-header">
      <div>
        <h1>Diamond Price Crawler</h1>
        <p class="subtitle">Multi-Brand Diamond Price Comparison & Trends</p>
      </div>
      <div v-if="brands.length > 0" class="export-actions">
        <button
          class="btn btn-primary"
          @click="startAllCrawls"
          :disabled="allCrawlsStarting"
        >
          {{ allCrawlsStarting ? 'Starting...' : 'Start All Crawls' }}
        </button>
        <button
          class="btn btn-success"
          @click="downloadAllBrands('csv')"
          :disabled="allBrandsDownloading"
        >
          {{ allBrandsDownloading ? 'Downloading...' : 'All Brands CSV' }}
        </button>
        <button
          class="btn btn-secondary"
          @click="downloadAllBrands('json')"
          :disabled="allBrandsDownloading"
        >
          JSON
        </button>
      </div>
    </div>
    <div v-if="allCrawlsMessage" class="success-message">{{ allCrawlsMessage }}</div>
    <div v-if="allCrawlsError" class="error-message">{{ allCrawlsError }}</div>
    <div v-if="allBrandsDownloadError" class="error-message">{{ allBrandsDownloadError }}</div>

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
      ref="crawlComponents"
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
import axios from 'axios'

const brands = ref<Brand[]>([])
const activeTab = ref('')
const allBrandsDownloading = ref(false)
const allBrandsDownloadError = ref('')
const allCrawlsStarting = ref(false)
const allCrawlsMessage = ref('')
const allCrawlsError = ref('')
let statusTimer: ReturnType<typeof setInterval> | null = null

type CrawlStartResult = {
  ok: boolean
  status: string
  brandId: string
  brandName: string
  sessionId?: number
  message?: string
}

type CrawlComponent = {
  startCrawl: () => Promise<CrawlStartResult>
  getCrawlState: () => {
    brandId: string
    brandName: string
    loading: boolean
    totalCombinations: number
  }
}

const crawlComponents = ref<CrawlComponent[]>([])

function getDownloadFilename(disposition: string, fallback: string) {
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch) return decodeURIComponent(encodedMatch[1])

  const match = disposition.match(/filename="?([^";]+)"?/i)
  return match ? match[1] : fallback
}

async function getDownloadErrorMessage(error: any) {
  const data = error?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      return parsed.error || error.message
    } catch {
      return error.message
    }
  }
  return error?.response?.data?.error || error.message || 'Unknown error'
}

async function downloadAllBrands(format: 'csv' | 'json') {
  allBrandsDownloading.value = true
  allBrandsDownloadError.value = ''

  try {
    const response = await axios.get('/api/exports/all', {
      params: { format },
      responseType: 'blob'
    })
    const filename = getDownloadFilename(
      response.headers['content-disposition'] || '',
      `all-brands-latest.${format}`
    )
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch (error: any) {
    allBrandsDownloadError.value = await getDownloadErrorMessage(error)
  } finally {
    allBrandsDownloading.value = false
  }
}

async function startAllCrawls() {
  allCrawlsStarting.value = true
  allCrawlsMessage.value = ''
  allCrawlsError.value = ''

  const components = crawlComponents.value.filter(Boolean)
  const results: CrawlStartResult[] = []

  try {
    for (const component of components) {
      const state = component.getCrawlState()
      allCrawlsMessage.value = `Starting ${state.brandName}...`
      const result = await component.startCrawl()
      results.push(result)
    }

    const started = results.filter(r => r.ok).length
    const skipped = results.filter(r => !r.ok && r.status === 'skipped')
    const failed = results.filter(r => !r.ok && r.status !== 'skipped')

    allCrawlsMessage.value = `Started ${started}/${results.length} brand crawls.`
    if (skipped.length > 0) {
      allCrawlsMessage.value += ` Skipped ${skipped.length}.`
    }
    if (failed.length > 0) {
      allCrawlsError.value = failed.map(r => `${r.brandName}: ${r.message || 'failed'}`).join('; ')
    }
  } finally {
    allCrawlsStarting.value = false
  }
}

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
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.subtitle {
  color: #666;
  font-size: 14px;
}

.export-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.export-actions .btn {
  white-space: nowrap;
}

.btn-secondary {
  background-color: #eef2f7;
  color: #475569;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e2e8f0;
}

.error-message {
  margin-bottom: 16px;
}

.success-message {
  margin-bottom: 16px;
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

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
  }

  .export-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
