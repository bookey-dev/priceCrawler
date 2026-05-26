<template>
  <div class="card">
    <h2>{{ brand.name }}</h2>
    <div class="brand-meta">
      <span class="cap-tag" :class="brand.capabilities.crawlType">{{ brand.capabilities.crawlType }}</span>
      <span v-if="brand.capabilities.requiresPuppeteer" class="cap-tag puppet">Puppeteer</span>
      <span v-if="brand.capabilities.beta" class="cap-tag beta">Beta</span>
      <span class="cap-tag" :class="brand.status.ready ? 'online' : 'offline'">
        {{ brand.status.ready ? 'Ready' : 'Offline' }}
      </span>
    </div>

    <!-- 浏览器状态面板（仅 Puppeteer 品牌显示） -->
    <div v-if="brand.capabilities.requiresPuppeteer"
      class="browser-panel" :class="{ 'browser-ready': browserStatus.ready, 'browser-offline': !browserStatus.hasInstance }">
      <div class="browser-header">
        <span class="browser-title">
          <span class="browser-icon">{{ browserStatus.ready ? '✓' : browserRestarting ? '⟳' : '!' }}</span>
          浏览器状态
        </span>
        <span class="browser-status-text">
          <template v-if="browserRestarting">正在重启...</template>
          <template v-else-if="browserStatus.ready">就绪 (Cloudflare 已通过)</template>
          <template v-else-if="browserStatus.hasInstance">浏览器已启动，等待 Cloudflare 验证...</template>
          <template v-else>未启动</template>
        </span>
        <button class="btn btn-small" @click="restartBrowser" :disabled="browserRestarting">
          {{ browserRestarting ? '重启中...' : '重启浏览器' }}
        </button>
      </div>
      <div class="browser-info">
        <span class="browser-detail">代理: {{ browserStatus.proxyUrl || '未配置' }}</span>
        <span class="browser-detail">自动管理 Cookie，无需手动设置</span>
      </div>
    </div>

    <div class="config-form">
      <div class="form-row">
        <!-- Stone Type + Certificate (fixed binding) -->
        <div class="form-group">
          <label>Stone Type + Certificate</label>
          <div class="multi-select">
            <div
              v-for="pair in availableStoneCertPairs"
              :key="pair.stoneType + pair.certificate"
              class="chip selected"
              style="cursor: default;"
            >
              {{ pair.label }}
            </div>
          </div>
          <div class="fixed-hint">Fixed binding</div>
        </div>

        <!-- Shape -->
        <div class="form-group">
          <label>Shape</label>
          <div class="multi-select">
            <div
              v-for="shape in availableShapes"
              :key="shape"
              class="chip"
              :class="{ selected: selectedShapes.includes(shape) }"
              @click="toggleSelection(selectedShapes, shape)"
            >
              {{ shapeLabel(shape) }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedShapes = [...availableShapes]">All</span>
            <span class="link" @click="selectedShapes = []">None</span>
          </div>
        </div>

        <!-- Carat（配置器品牌显示离散选择，库存品牌显示范围） -->
        <div class="form-group" v-if="availableCaratValues.length > 0">
          <label>Carat</label>
          <div class="multi-select scrollable">
            <div
              v-for="carat in availableCaratValues"
              :key="carat"
              class="chip"
              :class="{ selected: selectedCarats.includes(carat) }"
              @click="toggleSelection(selectedCarats, carat)"
            >
              {{ carat }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedCarats = [...availableCaratValues]">All</span>
            <span class="link" @click="selectedCarats = []">None</span>
          </div>
        </div>
        <div class="form-group" v-else>
          <label>Carat Range</label>
          <div class="carat-range">
            <input type="number" v-model.number="caratMin" :min="brand.capabilities.caratRange.min" :max="caratMax" step="0.1" />
            <span>to</span>
            <input type="number" v-model.number="caratMax" :min="caratMin" :max="brand.capabilities.caratRange.max" step="0.1" />
          </div>
        </div>

        <!-- Clarity + Color (fixed pairs) -->
        <div class="form-group">
          <label>Clarity + Color</label>
          <div class="multi-select">
            <div
              v-for="pair in FIXED_CLARITY_COLOR_PAIRS"
              :key="pair.clarity + pair.color"
              class="chip selected"
              style="cursor: default;"
            >
              {{ pair.clarity }} + {{ pair.color }}
            </div>
          </div>
          <div class="fixed-hint">Fixed combinations</div>
        </div>

        <!-- Cut Grade -->
        <div class="form-group" v-if="availableCutGrades.length > 0">
          <label>Cut Grade</label>
          <div class="multi-select">
            <div
              v-for="cut in availableCutGrades"
              :key="cut"
              class="chip"
              :class="{ selected: selectedCutGrades.includes(cut) }"
              @click="toggleSelection(selectedCutGrades, cut)"
            >
              {{ cutGradeLabel(cut) }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedCutGrades = [...availableCutGrades]">All</span>
            <span class="link" @click="selectedCutGrades = []">None</span>
          </div>
        </div>

        <!-- Certificate is bound to Stone Type, shown above -->
      </div>

      <div class="crawl-info">
        <span class="total-count">Total combinations: <strong>{{ totalCombinations.toLocaleString() }}</strong></span>
      </div>

      <button
        class="btn btn-primary btn-large"
        @click="handleCrawl()"
        :disabled="loading || totalCombinations === 0"
      >
        {{ loading ? `Crawling... ${progress}` : `Start Crawl` }}
      </button>

      <!-- 进度条 -->
      <div v-if="loading && taskProgress.total > 0" class="progress-section">
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: taskProgress.percentage + '%' }"></div>
        </div>
        <div class="progress-details">
          <span class="progress-text">
            {{ taskProgress.completed.toLocaleString() }} / {{ taskProgress.total.toLocaleString() }}
          </span>
          <span class="progress-stats">
            <span class="success">{{ taskProgress.successCount.toLocaleString() }} success</span>
            <span class="nodata" v-if="taskProgress.noDataCount > 0">{{ taskProgress.noDataCount.toLocaleString() }} no data</span>
          </span>
          <span class="progress-percent">{{ taskProgress.percentage }}%</span>
        </div>
        <div v-if="taskProgress.detail" class="progress-detail-text">
          {{ taskProgress.detail }}
        </div>
      </div>
    </div>

    <!-- 最近爬取历史 -->
    <div v-if="recentSessions.length > 0" class="results-section mt-20">
      <h3>Recent Sessions</h3>
      <div class="sessions-list">
        <div v-for="s in recentSessions" :key="s.id" class="session-item" :class="s.status">
          <span class="session-id">#{{ s.id }}</span>
          <span class="session-status-badge" :class="s.status">{{ s.status }}</span>
          <span class="session-count">{{ s.total_diamonds }} diamonds</span>
          <span class="session-time">{{ formatTime(s.started_at) }}</span>
          <span v-if="s.error" class="session-error">{{ s.error }}</span>
          <span v-if="s.status === 'completed' && s.total_diamonds > 0" class="session-actions">
            <a href="#" class="dl-link" @click.prevent="downloadExport(s.id, 'csv')">CSV</a>
            <a href="#" class="dl-link" @click.prevent="downloadExport(s.id, 'json')">JSON</a>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Brand, CrawlSession } from '@/types/diamond'
import { triggerBrandCrawl, getBrandSessionById, getBrandSessions } from '@/api'
import axios from 'axios'

const props = defineProps<{
  brand: Brand
}>()

// Fixed clarity+color pairs (applies to ALL brands)
const FIXED_CLARITY_COLOR_PAIRS = [
  { clarity: 'VVS1', color: 'E' },
  { clarity: 'VS1', color: 'G' }
]

// Fixed stone type + certificate bindings: Natural→GIA, Lab→IGI
const STONE_CERT_BINDINGS = [
  { stoneType: 'NATURAL', certificate: 'GIA', label: 'Natural + GIA' },
  { stoneType: 'LAB', certificate: 'IGI', label: 'Lab-Grown + IGI' }
]

// 动态参数选项（从品牌 capabilities 派生）
const caps = computed(() => props.brand.capabilities)

// Only show stone+cert pairs that the brand supports
const availableStoneCertPairs = computed(() => {
  return STONE_CERT_BINDINGS.filter(b => {
    const supportsStone = (b.stoneType === 'LAB' && caps.value.supportsLabGrown) ||
                          (b.stoneType === 'NATURAL' && caps.value.supportsNatural)
    const supportsCert = !caps.value.certificates || caps.value.certificates.includes(b.certificate)
    return supportsStone && supportsCert
  })
})

const availableShapes = computed(() => caps.value.shapes || [])
const availableCaratValues = computed(() => caps.value.caratValues || [])
const availableCutGrades = computed(() => caps.value.cutGrades || [])

const shapeLabel = (key: string) => caps.value.shapeLabels?.[key] || key
const cutGradeLabel = (key: string) => caps.value.cutGradeLabels?.[key] || key

// ========== 选中状态 ==========
const selectedShapes = ref<string[]>([])
const selectedCarats = ref<string[]>([])
const selectedCutGrades = ref<string[]>([])
const caratMin = ref(0.2)
const caratMax = ref(10.0)

// ========== 爬取状态 ==========
const loading = ref(false)
const progress = ref('')
const taskProgress = ref({
  completed: 0,
  total: 0,
  successCount: 0,
  noDataCount: 0,
  percentage: 0,
  detail: ''
})
let pollingInterval: ReturnType<typeof setInterval> | null = null

// 最近 sessions
const recentSessions = ref<CrawlSession[]>([])

// 浏览器状态
interface BrowserStatus {
  ready: boolean
  hasInstance: boolean
  hasPage: boolean
  proxyUrl: string
}
const browserStatus = ref<BrowserStatus>({ ready: false, hasInstance: false, hasPage: false, proxyUrl: '' })
const browserRestarting = ref(false)
let browserStatusInterval: ReturnType<typeof setInterval> | null = null

// ========== 通用 toggle 函数 ==========
function toggleSelection(arr: string[], value: string) {
  const idx = arr.indexOf(value)
  if (idx === -1) {
    arr.push(value)
  } else {
    arr.splice(idx, 1)
  }
}

// ========== 初始化选中项 ==========
function resetSelections() {
  const c = caps.value

  selectedShapes.value = [...c.shapes]
  selectedCarats.value = c.caratValues ? [...c.caratValues] : []
  selectedCutGrades.value = ['EX', 'EXCELLENT', 'SUPER_IDEAL'].filter(v => c.cutGrades.includes(v))
  if (selectedCutGrades.value.length === 0) selectedCutGrades.value = [...c.cutGrades]

  caratMin.value = c.caratRange.min
  caratMax.value = c.caratRange.max
}

// ========== Computed ==========
const totalCombinations = computed(() => {
  const caratCount = availableCaratValues.value.length > 0 ? selectedCarats.value.length : 1
  return (
    availableStoneCertPairs.value.length *
    selectedShapes.value.length *
    caratCount *
    FIXED_CLARITY_COLOR_PAIRS.length *
    (selectedCutGrades.value.length || 1)
  )
})

// ========== 爬取 ==========
async function handleCrawl(options: { silent?: boolean } = {}) {
  if (loading.value) {
    return {
      ok: false,
      status: 'skipped',
      brandId: props.brand.id,
      brandName: props.brand.name,
      message: 'Already crawling'
    }
  }
  if (totalCombinations.value === 0) {
    return {
      ok: false,
      status: 'skipped',
      brandId: props.brand.id,
      brandName: props.brand.name,
      message: 'No combinations selected'
    }
  }

  loading.value = true
  progress.value = 'Starting...'
  taskProgress.value = { completed: 0, total: 0, successCount: 0, noDataCount: 0, percentage: 0, detail: '' }

  const filters: Record<string, any> = {
    stoneCertPairs: availableStoneCertPairs.value.map(p => ({ stoneType: p.stoneType, certificate: p.certificate })),
    shapes: selectedShapes.value,
  }

  if (availableCaratValues.value.length > 0) {
    filters.carats = selectedCarats.value
  } else {
    filters.caratRange = { min: caratMin.value, max: caratMax.value }
  }

  filters.colorClarityPairs = FIXED_CLARITY_COLOR_PAIRS
  if (selectedCutGrades.value.length > 0) filters.cutGrades = selectedCutGrades.value

  try {
    const result = await triggerBrandCrawl(props.brand.id, filters)
    progress.value = `Session #${result.sessionId} started`

    pollingInterval = setInterval(() => {
      pollSession(result.sessionId)
    }, 3000)

    pollSession(result.sessionId)
    return {
      ok: true,
      status: 'started',
      brandId: props.brand.id,
      brandName: props.brand.name,
      sessionId: result.sessionId
    }
  } catch (error: any) {
    console.error('Crawl error:', error)
    if (!options.silent) {
      alert(`Failed to start crawl: ${error.message}`)
    }
    loading.value = false
    return {
      ok: false,
      status: 'failed',
      brandId: props.brand.id,
      brandName: props.brand.name,
      message: error.message
    }
  }
}

async function pollSession(sessionId: number) {
  try {
    const session = await getBrandSessionById(props.brand.id, sessionId)

    const completed = session.progress_completed || 0
    const total = session.progress_total || 0
    const success = session.progress_success || 0

    taskProgress.value = {
      completed,
      total,
      successCount: success,
      noDataCount: completed - success,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      detail: session.progress_detail || ''
    }

    progress.value = `${completed}/${total} (${taskProgress.value.percentage}%)`

    if (session.status === 'completed') {
      stopPolling()
      loading.value = false
      progress.value = `Done! ${session.total_diamonds} diamonds`
      loadRecentSessions()
    } else if (session.status === 'failed') {
      stopPolling()
      loading.value = false
      progress.value = 'Failed'
      alert(`Crawl failed: ${session.error}`)
      loadRecentSessions()
    }
  } catch (error: any) {
    console.error('Poll error:', error.message)
  }
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// ========== 下载导出 ==========
async function downloadExport(sessionId: number, format: string) {
  try {
    const response = await axios.get(`/api/brands/${props.brand.id}/sessions/${sessionId}/export`, {
      params: { format },
      responseType: 'blob'
    })
    const disposition = response.headers['content-disposition'] || ''
    const match = disposition.match(/filename="?(.+?)"?$/)
    const filename = match ? match[1] : `${props.brand.id}-session${sessionId}.${format}`
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch (error: any) {
    alert(`Download failed: ${error.message}`)
  }
}

// ========== 历史 ==========
async function loadRecentSessions() {
  try {
    recentSessions.value = await getBrandSessions(props.brand.id)
  } catch (e) {
    // ignore
  }
}

function formatTime(isoStr: string) {
  if (!isoStr) return ''
  // SQLite datetime('now') returns UTC without timezone marker, append 'Z' so JS parses as UTC
  const utcStr = isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : isoStr.replace(' ', 'T') + 'Z'
  return new Date(utcStr).toLocaleString()
}

// ========== 浏览器管理 ==========
async function fetchBrowserStatus() {
  try {
    const response = await axios.get('/api/browser/status', { params: { brand: props.brand.id } })
    browserStatus.value = response.data
    // 同步更新导航栏状态指示器
    if (response.data.ready !== undefined) {
      props.brand.status.ready = response.data.ready
    }
  } catch (error) {
    // ignore
  }
}

async function restartBrowser() {
  browserRestarting.value = true
  try {
    const response = await axios.post('/api/browser/restart')
    if (response.data.status) {
      browserStatus.value = response.data.status
    } else {
      await fetchBrowserStatus()
    }
  } catch (error: any) {
    console.error('Failed to restart browser:', error)
  } finally {
    browserRestarting.value = false
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  resetSelections()
  loadRecentSessions()

  if (props.brand.capabilities.requiresPuppeteer) {
    fetchBrowserStatus()
    browserStatusInterval = setInterval(fetchBrowserStatus, 30000)
  }
})

onUnmounted(() => {
  stopPolling()
  if (browserStatusInterval) {
    clearInterval(browserStatusInterval)
  }
})

defineExpose({
  startCrawl: () => handleCrawl({ silent: true }),
  getCrawlState: () => ({
    brandId: props.brand.id,
    brandName: props.brand.name,
    loading: loading.value,
    totalCombinations: totalCombinations.value
  })
})
</script>

<style scoped>
.brand-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.cap-tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.cap-tag.configurator { background: #dbeafe; color: #1e40af; }
.cap-tag.inventory { background: #d1fae5; color: #065f46; }
.cap-tag.puppet { background: #fff3cd; color: #856404; }
.cap-tag.beta { background: #f8d7da; color: #721c24; }
.cap-tag.online { background: #d4edda; color: #155724; }
.cap-tag.offline { background: #f8d7da; color: #721c24; }

/* Carat range inputs */
.carat-range {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.carat-range input {
  width: 80px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
}
.carat-range span {
  color: #64748b;
  font-size: 13px;
}

/* Sessions list */
.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
}
.session-item.completed { border-left: 3px solid #22c55e; }
.session-item.running { border-left: 3px solid #f59e0b; }
.session-item.failed { border-left: 3px solid #ef4444; }
.session-id { font-weight: 600; color: #475569; min-width: 40px; }
.session-status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.session-status-badge.completed { background: #d4edda; color: #155724; }
.session-status-badge.running { background: #fff3cd; color: #856404; }
.session-status-badge.failed { background: #f8d7da; color: #721c24; }
.session-count { color: #555; }
.session-time { color: #999; margin-left: auto; }
.session-error { color: #dc2626; font-size: 12px; }
.session-actions { display: flex; gap: 8px; margin-left: 8px; }
.dl-link {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  background: #e0f2fe;
  color: #0369a1;
  transition: background 0.2s;
}
.dl-link:hover { background: #bae6fd; }

/* 浏览器状态面板 */
.browser-panel {
  margin-bottom: 20px;
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid #fde047;
  background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
}
.browser-panel.browser-ready {
  border-color: #86efac;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}
.browser-panel.browser-offline {
  border-color: #fca5a5;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}
.browser-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.browser-title {
  font-weight: 600;
  font-size: 14px;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 6px;
}
.browser-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}
.browser-ready .browser-icon { background: #22c55e; color: white; }
.browser-offline .browser-icon { background: #ef4444; color: white; }
.browser-panel:not(.browser-ready):not(.browser-offline) .browser-icon { background: #f59e0b; color: white; }
.browser-status-text { font-size: 13px; color: #6b7280; flex: 1; }
.browser-info { margin-top: 8px; display: flex; gap: 16px; flex-wrap: wrap; }
.browser-detail { font-size: 12px; color: #9ca3af; }
.btn-small { padding: 6px 12px; font-size: 12px; }

/* Card */
.card {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
.card h2 {
  font-size: 22px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

/* Form */
.config-form { margin-top: 20px; }
.form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}
@media (max-width: 1024px) { .form-row { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } }

.form-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.form-group label {
  font-weight: 600;
  font-size: 13px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.multi-select {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  min-height: 50px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.multi-select:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); }
.multi-select.scrollable { max-height: 280px; overflow-y: auto; }
.multi-select.scrollable::-webkit-scrollbar { width: 6px; }
.multi-select.scrollable::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
.multi-select.scrollable::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

.chip {
  padding: 6px 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  color: #64748b;
}
.chip:hover { background: #f1f5f9; border-color: #cbd5e1; transform: translateY(-1px); }
.chip.selected {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}
.chip.selected:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5); }

.fixed-hint { font-size: 12px; color: #9ca3af; padding-left: 4px; }
.select-actions { display: flex; gap: 16px; font-size: 12px; padding-left: 4px; }
.link { color: #667eea; cursor: pointer; font-weight: 500; transition: color 0.2s; }
.link:hover { color: #764ba2; text-decoration: underline; }

.crawl-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 12px;
  margin-bottom: 20px;
}
.total-count { font-size: 14px; color: #0369a1; }
.total-count strong { color: #0c4a6e; }

.btn-large {
  width: 100%;
  padding: 16px 24px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}
.btn-large:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5); }
.btn-large:disabled { background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); cursor: not-allowed; box-shadow: none; }

/* Progress */
.progress-section { margin-top: 20px; }
.progress-bar-container { width: 100%; height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; }
.progress-bar { height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 6px; transition: width 0.3s ease; }
.progress-details { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 13px; color: #64748b; }
.progress-text { font-weight: 600; color: #334155; }
.progress-stats { display: flex; gap: 12px; }
.progress-stats .success { color: #059669; }
.progress-stats .nodata { color: #9ca3af; }
.progress-percent { font-weight: 700; color: #667eea; font-size: 14px; }
.progress-detail-text { margin-top: 8px; font-size: 12px; color: #64748b; font-family: monospace; padding: 6px 10px; background: #f1f5f9; border-radius: 6px; }

.results-section { border-top: 2px solid #e2e8f0; padding-top: 28px; margin-top: 8px; }
.results-section h3 { margin: 0 0 16px 0; font-size: 18px; color: #334155; }
</style>
