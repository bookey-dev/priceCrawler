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
          :disabled="allCrawlsStarting || allFailedRetrying"
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
          {{ allBrandsDownloading ? 'Downloading...' : 'All Brands JSON ZIP' }}
        </button>
        <button
          class="btn btn-danger"
          @click="resetDatabaseToInitialState"
          :disabled="databaseResetting || allCrawlsStarting || allFailedRetrying"
        >
          {{ databaseResetting ? 'Resetting...' : 'Reset Database' }}
        </button>
      </div>
    </div>
    <div v-if="allCrawlsMessage" class="success-message">{{ allCrawlsMessage }}</div>
    <div v-if="allCrawlsError" class="error-message">{{ allCrawlsError }}</div>
    <div v-if="allBrandsDownloadError" class="error-message">{{ allBrandsDownloadError }}</div>

    <div v-if="allCrawlSummary.visible" class="all-crawl-progress">
      <div class="all-crawl-header">
        <div>
          <div class="all-crawl-title">All Crawls Progress</div>
          <div class="all-crawl-subtitle">
            {{ allCrawlSummary.completed }} completed / {{ allCrawlSummary.total }} total
            <span v-if="allCrawlSummary.running > 0">, {{ allCrawlSummary.running }} running</span>
            <span v-if="allCrawlSummary.pending > 0">, {{ allCrawlSummary.pending }} pending</span>
            <span v-if="allCrawlSummary.failed > 0">, {{ allCrawlSummary.failed }} failed</span>
            <span v-if="allCrawlSummary.skipped > 0">, {{ allCrawlSummary.skipped }} skipped</span>
          </div>
        </div>
        <div class="all-crawl-actions">
          <button
            v-if="allCrawlSummary.failed > 0"
            class="btn btn-small btn-warning"
            @click="retryFailedCrawls"
            :disabled="allCrawlsStarting || allFailedRetrying"
          >
            {{ allFailedRetrying ? 'Retrying...' : 'Retry Failed' }}
          </button>
          <button
            class="btn btn-small btn-secondary"
            @click="resetSubmittedCrawls"
            :disabled="allCrawlsStarting || allFailedRetrying || allCrawlSummary.running > 0 || allCrawlSummary.pending > 0"
          >
            Reset Tasks
          </button>
          <div class="all-crawl-percent">{{ allCrawlSummary.percentage }}%</div>
        </div>
      </div>
      <div class="all-crawl-bar">
        <div class="all-crawl-bar-fill" :style="{ width: allCrawlSummary.percentage + '%' }"></div>
      </div>
      <div class="all-crawl-stats">
        <span>{{ allCrawlSummary.completedProgress.toLocaleString() }} / {{ allCrawlSummary.totalProgress.toLocaleString() }} combinations</span>
        <span>{{ allCrawlSummary.successCount.toLocaleString() }} success</span>
        <span>{{ allCrawlSummary.noDataCount.toLocaleString() }} no data</span>
        <span>{{ allCrawlSummary.totalDiamonds.toLocaleString() }} diamonds</span>
      </div>
    </div>

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
import { getBrands, resetDatabase } from '@/api'
import SingleCrawl from './components/SingleCrawl.vue'
import axios from 'axios'

const brands = ref<Brand[]>([])
const activeTab = ref('')
const allBrandsDownloading = ref(false)
const allBrandsDownloadError = ref('')
const allCrawlsStarting = ref(false)
const allFailedRetrying = ref(false)
const allCrawlsMessage = ref('')
const allCrawlsError = ref('')
const databaseResetting = ref(false)
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
  resetCrawlState: () => boolean
  resetAfterDatabaseReset: () => boolean
  getCrawlState: () => {
    brandId: string
    brandName: string
    sessionId: number | null
    status: 'idle' | 'running' | 'completed' | 'failed'
    loading: boolean
    progress: string
    taskProgress: {
      completed: number
      total: number
      successCount: number
      noDataCount: number
      percentage: number
      detail: string
    }
    totalCombinations: number
    totalDiamonds: number
    error: string
  }
}

const crawlComponents = ref<CrawlComponent[]>([])
const crawlStartResults = ref<Record<string, CrawlStartResult>>({})
let allCrawlProgressTimer: ReturnType<typeof setInterval> | null = null

const allCrawlSummary = ref({
  visible: false,
  total: 0,
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  totalProgress: 0,
  completedProgress: 0,
  successCount: 0,
  noDataCount: 0,
  totalDiamonds: 0,
  percentage: 0
})

function emptyAllCrawlSummary(visible = false) {
  return {
    visible,
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    totalProgress: 0,
    completedProgress: 0,
    successCount: 0,
    noDataCount: 0,
    totalDiamonds: 0,
    percentage: 0
  }
}

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
      `all-brands-latest.${format === 'json' ? 'zip' : format}`
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
  crawlStartResults.value = {}
  allCrawlSummary.value = {
    ...emptyAllCrawlSummary(true),
    total: crawlComponents.value.filter(Boolean).length,
    pending: crawlComponents.value.filter(Boolean).length
  }
  startAllCrawlProgressTimer()

  const components = crawlComponents.value.filter(Boolean)
  const results: CrawlStartResult[] = []

  try {
    for (const component of components) {
      const state = component.getCrawlState()
      allCrawlsMessage.value = `Starting ${state.brandName}...`
      const result = await component.startCrawl()
      results.push(result)
      crawlStartResults.value[result.brandId] = result
      updateAllCrawlSummary()
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
    updateAllCrawlSummary()
  }
}

async function retryFailedCrawls() {
  const failedComponents = getFailedCrawlComponents()
  if (failedComponents.length === 0) {
    updateAllCrawlSummary()
    return
  }

  allFailedRetrying.value = true
  allCrawlsMessage.value = ''
  allCrawlsError.value = ''
  allCrawlSummary.value.visible = true
  startAllCrawlProgressTimer()

  const results: CrawlStartResult[] = []

  try {
    for (const component of failedComponents) {
      const state = component.getCrawlState()
      allCrawlsMessage.value = `Retrying ${state.brandName}...`
      delete crawlStartResults.value[state.brandId]
      updateAllCrawlSummary()

      const result = await component.startCrawl()
      results.push(result)
      crawlStartResults.value[result.brandId] = result
      updateAllCrawlSummary()
    }

    const started = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok && r.status !== 'skipped')
    const skipped = results.filter(r => !r.ok && r.status === 'skipped')

    allCrawlsMessage.value = `Retried ${started}/${results.length} failed crawls.`
    if (skipped.length > 0) {
      allCrawlsMessage.value += ` Skipped ${skipped.length}.`
    }
    if (failed.length > 0) {
      allCrawlsError.value = failed.map(r => `${r.brandName}: ${r.message || 'failed'}`).join('; ')
    }
  } finally {
    allFailedRetrying.value = false
    updateAllCrawlSummary()
  }
}

function getFailedCrawlComponents() {
  return crawlComponents.value.filter(Boolean).filter(component => {
    const state = component.getCrawlState()
    const result = crawlStartResults.value[state.brandId]
    return !state.loading && (
      state.status === 'failed' ||
      (!!result && !result.ok && result.status !== 'skipped')
    )
  })
}

function resetSubmittedCrawls() {
  updateAllCrawlSummary()
  if (allCrawlsStarting.value || allFailedRetrying.value || allCrawlSummary.value.running > 0 || allCrawlSummary.value.pending > 0) {
    return
  }

  for (const component of crawlComponents.value.filter(Boolean)) {
    component.resetCrawlState()
  }

  crawlStartResults.value = {}
  allCrawlsMessage.value = ''
  allCrawlsError.value = ''
  stopAllCrawlProgressTimer()
  allCrawlSummary.value = emptyAllCrawlSummary(false)
}

async function resetDatabaseToInitialState() {
  const components = crawlComponents.value.filter(Boolean)
  const activeCrawls = components.filter(component => component.getCrawlState().loading)
  if (allCrawlsStarting.value || allFailedRetrying.value || activeCrawls.length > 0) {
    allCrawlsError.value = 'Cannot reset database while crawls are running.'
    return
  }

  const confirmed = window.confirm('Reset database to initial state? This will permanently delete all crawl sessions, diamond prices, and price snapshots.')
  if (!confirmed) return

  databaseResetting.value = true
  allCrawlsMessage.value = ''
  allCrawlsError.value = ''
  allBrandsDownloadError.value = ''

  try {
    const result = await resetDatabase()
    for (const component of components) {
      component.resetAfterDatabaseReset()
    }
    crawlStartResults.value = {}
    stopAllCrawlProgressTimer()
    allCrawlSummary.value = emptyAllCrawlSummary(false)
    allCrawlsMessage.value = `Database reset. Deleted ${result.deleted.diamondPrices.toLocaleString()} prices, ${result.deleted.crawlSessions.toLocaleString()} sessions, and ${result.deleted.priceSnapshots.toLocaleString()} snapshots.`
  } catch (error: any) {
    allCrawlsError.value = error?.response?.data?.error || error.message || 'Failed to reset database'
  } finally {
    databaseResetting.value = false
  }
}

function startAllCrawlProgressTimer() {
  if (allCrawlProgressTimer) clearInterval(allCrawlProgressTimer)
  allCrawlProgressTimer = setInterval(updateAllCrawlSummary, 1000)
}

function stopAllCrawlProgressTimer() {
  if (allCrawlProgressTimer) {
    clearInterval(allCrawlProgressTimer)
    allCrawlProgressTimer = null
  }
}

function updateAllCrawlSummary() {
  const components = crawlComponents.value.filter(Boolean)
  const states = components.map(component => component.getCrawlState())
  const results = crawlStartResults.value
  const total = states.length

  let pending = 0
  let running = 0
  let completed = 0
  let failed = 0
  let skipped = 0
  let totalProgress = 0
  let completedProgress = 0
  let successCount = 0
  let noDataCount = 0
  let totalDiamonds = 0

  for (const state of states) {
    const result = results[state.brandId]

    if (!result) {
      pending += 1
      continue
    }

    if (!result.ok) {
      if (result.status === 'skipped') skipped += 1
      else failed += 1
      continue
    }

    if (state.status === 'completed') completed += 1
    else if (state.status === 'failed') failed += 1
    else if (state.loading || state.status === 'running') running += 1
    else pending += 1

    totalProgress += state.taskProgress.total
    completedProgress += state.taskProgress.completed
    successCount += state.taskProgress.successCount
    noDataCount += state.taskProgress.noDataCount
    totalDiamonds += state.totalDiamonds
  }

  const finishedBrands = completed + failed + skipped
  const percentage = totalProgress > 0
    ? Math.round((completedProgress / totalProgress) * 100)
    : total > 0
      ? Math.round((finishedBrands / total) * 100)
      : 0

  allCrawlSummary.value = {
    visible: allCrawlSummary.value.visible,
    total,
    pending,
    running,
    completed,
    failed,
    skipped,
    totalProgress,
    completedProgress,
    successCount,
    noDataCount,
    totalDiamonds,
    percentage: Math.min(100, percentage)
  }

  if (!allCrawlsStarting.value && !allFailedRetrying.value && running === 0 && pending === 0) {
    stopAllCrawlProgressTimer()
    if (total > 0 && failed > 0) {
      allCrawlsError.value = `All crawls finished with ${failed} failed. Failed tasks were skipped; use Retry Failed to run them again.`
    } else if (total > 0) {
      allCrawlsMessage.value = skipped > 0
        ? `All crawls finished. Completed ${completed}/${total}, skipped ${skipped}.`
        : `All crawls completed.`
    }
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
  stopAllCrawlProgressTimer()
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

.all-crawl-progress {
  margin-bottom: 16px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #dbe3ec;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
}

.all-crawl-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 10px;
}

.all-crawl-title {
  color: #1f2937;
  font-size: 14px;
  font-weight: 700;
}

.all-crawl-subtitle {
  margin-top: 3px;
  color: #64748b;
  font-size: 13px;
}

.all-crawl-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.all-crawl-percent {
  color: #2563eb;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.btn-small {
  padding: 6px 10px;
  font-size: 12px;
}

.btn-warning {
  background-color: #f59e0b;
  color: #ffffff;
}

.btn-warning:hover:not(:disabled) {
  background-color: #d97706;
}

.all-crawl-bar {
  height: 10px;
  overflow: hidden;
  background: #e2e8f0;
  border-radius: 999px;
}

.all-crawl-bar-fill {
  height: 100%;
  background: #2563eb;
  border-radius: 999px;
  transition: width 0.25s ease;
}

.all-crawl-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 10px;
  color: #475569;
  font-size: 12px;
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
