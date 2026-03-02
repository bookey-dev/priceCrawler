<template>
  <div class="card">
    <h2>Diamond Price Crawler</h2>
    <p class="text-muted mb-20">Select options to crawl (supports multi-select, defaults to All)</p>

    <!-- 浏览器状态面板 -->
    <div class="browser-panel" :class="{ 'browser-ready': browserStatus.ready, 'browser-offline': !browserStatus.hasInstance }">
      <div class="browser-header">
        <span class="browser-title">
          <span class="browser-icon">{{ browserStatus.ready ? '✓' : browserRestarting ? '⟳' : '!' }}</span>
          浏览器状态
        </span>
        <span class="browser-status-text">
          <template v-if="browserRestarting">
            正在重启...
          </template>
          <template v-else-if="browserStatus.ready">
            就绪 (Cloudflare 已通过)
          </template>
          <template v-else-if="browserStatus.hasInstance">
            浏览器已启动，等待 Cloudflare 验证...
          </template>
          <template v-else>
            未启动
          </template>
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
        <!-- Stone Type -->
        <div class="form-group">
          <label>Stone Type</label>
          <div class="multi-select">
            <div
              v-for="stoneType in DIAMOND_OPTIONS.stoneTypes"
              :key="stoneType.value"
              class="chip"
              :class="{ selected: selectedStoneTypes.includes(stoneType.value) }"
              @click="toggleStoneType(stoneType.value)"
            >
              {{ stoneType.label }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedStoneTypes = DIAMOND_OPTIONS.stoneTypes.map(s => s.value)">All</span>
            <span class="link" @click="selectedStoneTypes = []">None</span>
          </div>
        </div>

        <!-- Shape -->
        <div class="form-group">
          <label>Shape</label>
          <div class="multi-select">
            <div
              v-for="shape in DIAMOND_OPTIONS.shapes"
              :key="shape.value"
              class="chip"
              :class="{ selected: selectedShapes.includes(shape.value) }"
              @click="toggleShape(shape.value)"
            >
              {{ shape.label }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedShapes = DIAMOND_OPTIONS.shapes.map(s => s.value)">All</span>
            <span class="link" @click="selectedShapes = []">None</span>
          </div>
        </div>

        <!-- Carat -->
        <div class="form-group">
          <label>Carat</label>
          <div class="multi-select scrollable">
            <div
              v-for="carat in DIAMOND_OPTIONS.carats"
              :key="carat"
              class="chip"
              :class="{ selected: selectedCarats.includes(carat) }"
              @click="toggleCarat(carat)"
            >
              {{ carat }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedCarats = [...DIAMOND_OPTIONS.carats]">All</span>
            <span class="link" @click="selectedCarats = []">None</span>
          </div>
        </div>

        <!-- Clarity -->
        <div class="form-group">
          <label>Clarity</label>
          <div class="multi-select">
            <div
              v-for="clarity in DIAMOND_OPTIONS.clarities"
              :key="clarity"
              class="chip"
              :class="{ selected: selectedClarities.includes(clarity) }"
              @click="toggleClarity(clarity)"
            >
              {{ clarity }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedClarities = [...DIAMOND_OPTIONS.clarities]">All</span>
            <span class="link" @click="selectedClarities = []">None</span>
          </div>
        </div>

        <!-- Color -->
        <div class="form-group">
          <label>Color</label>
          <div class="multi-select">
            <div
              v-for="color in DIAMOND_OPTIONS.colors"
              :key="color"
              class="chip"
              :class="{ selected: selectedColors.includes(color) }"
              @click="toggleColor(color)"
            >
              {{ color }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedColors = [...DIAMOND_OPTIONS.colors]">All</span>
            <span class="link" @click="selectedColors = []">None</span>
          </div>
        </div>

        <!-- Cut Grade -->
        <div class="form-group">
          <label>Cut Grade</label>
          <div class="multi-select">
            <div
              v-for="cut in DIAMOND_OPTIONS.cutGrades"
              :key="cut.value"
              class="chip"
              :class="{ selected: selectedCutGrades.includes(cut.value) }"
              @click="toggleCutGrade(cut.value)"
            >
              {{ cut.label }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedCutGrades = DIAMOND_OPTIONS.cutGrades.map(c => c.value)">All</span>
            <span class="link" @click="selectedCutGrades = []">None</span>
          </div>
        </div>

        <!-- Certificate -->
        <div class="form-group">
          <label>Certificate</label>
          <div class="multi-select">
            <div
              v-for="cert in DIAMOND_OPTIONS.certificates"
              :key="cert.value"
              class="chip"
              :class="{ selected: selectedCertificates.includes(cert.value) }"
              @click="toggleCertificate(cert.value)"
            >
              {{ cert.label }}
            </div>
          </div>
          <div class="select-actions">
            <span class="link" @click="selectedCertificates = DIAMOND_OPTIONS.certificates.map(c => c.value)">All</span>
            <span class="link" @click="selectedCertificates = []">None</span>
          </div>
        </div>
      </div>

      <!-- 分批设置 -->
      <div class="batch-settings">
        <div class="batch-toggle">
          <label class="toggle-label">
            <input type="checkbox" v-model="enableBatchMode" />
            <span class="toggle-text">按维度分批爬取（推荐大量数据时使用）</span>
          </label>
        </div>
        <div v-if="enableBatchMode" class="batch-options">
          <label>分批维度:</label>
          <select v-model="batchDimension">
            <option value="carat">克拉 (Carat) - {{ DIAMOND_OPTIONS.carats.length }} 批</option>
            <option value="shape">形状 (Shape) - {{ DIAMOND_OPTIONS.shapes.length }} 批</option>
            <option value="clarity">净度 (Clarity) - {{ DIAMOND_OPTIONS.clarities.length }} 批</option>
            <option value="color">颜色 (Color) - {{ DIAMOND_OPTIONS.colors.length }} 批</option>
            <option value="cutGrade">切工 (Cut Grade) - {{ DIAMOND_OPTIONS.cutGrades.length }} 批</option>
            <option value="certificate">证书 (Certificate) - {{ DIAMOND_OPTIONS.certificates.length }} 批</option>
            <option value="stoneType">钻石类型 (Stone Type) - {{ DIAMOND_OPTIONS.stoneTypes.length }} 批</option>
          </select>
          <span class="batch-info">
            将创建 <strong>{{ batchCount }}</strong> 个任务，每批约 <strong>{{ itemsPerBatch.toLocaleString() }}</strong> 条
          </span>
        </div>
      </div>

      <div class="crawl-info">
        <span class="total-count">Total combinations: <strong>{{ totalCombinations.toLocaleString() }}</strong></span>
        <span class="time-estimate" v-if="totalCombinations > 0">
          Estimated time: <strong>{{ estimatedTime }}</strong>
        </span>
      </div>

      <button
        class="btn btn-primary btn-large"
        @click="handleCrawl"
        :disabled="loading || totalCombinations === 0"
      >
        {{ loading ? `Crawling... ${progress}` : 'Start Crawl' }}
      </button>

      <!-- 进度条 -->
      <div v-if="loading && taskProgress.total > 0" class="progress-section">
        <!-- 网络状态提示 -->
        <div v-if="!isOnline && reconnecting" class="network-status reconnecting">
          <span class="status-icon">🔄</span>
          <span class="status-text">网络连接中断，正在重试... ({{ pollErrorCount }}/{{ maxPollErrors }})</span>
          <span class="status-hint">任务仍在后台运行，网络恢复后将自动同步进度</span>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: taskProgress.percentage + '%' }"></div>
        </div>
        <div class="progress-details">
          <span class="progress-text">
            {{ taskProgress.completed.toLocaleString() }} / {{ taskProgress.total.toLocaleString() }}
          </span>
          <span class="progress-stats">
            <span class="success">{{ taskProgress.successCount.toLocaleString() }} success</span>
            <span class="error" v-if="taskProgress.errorCount > 0">{{ taskProgress.errorCount.toLocaleString() }} errors</span>
          </span>
          <span class="progress-percent">{{ taskProgress.percentage }}%</span>
        </div>
      </div>

      <!-- 分批任务列表 -->
      <div v-if="batchTasks.length > 0" class="batch-tasks-section">
        <h3>分批任务进度 ({{ completedBatchTasks }}/{{ batchTasks.length }})</h3>
        <div class="batch-tasks-list">
          <div
            v-for="task in batchTasks"
            :key="task.taskId"
            class="batch-task-item"
            :class="task.status"
          >
            <span class="task-label">{{ task.batchValue }}</span>
            <div class="task-progress-bar">
              <div class="task-progress-fill" :style="{ width: task.progress.percentage + '%' }"></div>
            </div>
            <span class="task-status">{{ task.progress.percentage }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div v-if="results.length > 0" class="results-section mt-20">
      <div class="results-header">
        <h3>Results ({{ results.length }} items)</h3>
        <div class="results-actions">
          <div class="results-stats">
            <span class="stat success">Success: {{ successCount }}</span>
            <span class="stat error">Errors: {{ errorCount }}</span>
          </div>
          <div class="export-buttons" v-if="exportFiles">
            <button class="btn btn-export" @click="downloadFile('csv')">
              <span class="icon">📥</span> Download CSV
            </button>
            <button class="btn btn-export" @click="downloadFile('json')">
              <span class="icon">📥</span> Download JSON
            </button>
          </div>
        </div>
      </div>

      <!-- Filters for results -->
      <div class="results-filters">
        <div class="filter-group">
          <label>Filter by Stone Type</label>
          <select v-model="filterStoneType">
            <option value="">All</option>
            <option v-for="stoneType in DIAMOND_OPTIONS.stoneTypes" :key="stoneType.value" :value="stoneType.value">
              {{ stoneType.label }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Filter by Shape</label>
          <select v-model="filterShape">
            <option value="">All</option>
            <option v-for="shape in DIAMOND_OPTIONS.shapes" :key="shape.value" :value="shape.value">
              {{ shape.label }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Filter by Carat</label>
          <select v-model="filterCarat">
            <option value="">All</option>
            <option v-for="carat in DIAMOND_OPTIONS.carats" :key="carat" :value="carat">
              {{ carat }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label>Sort by</label>
          <select v-model="sortBy">
            <option value="price-asc">Price (Low to High)</option>
            <option value="price-desc">Price (High to Low)</option>
            <option value="carat-asc">Carat (Low to High)</option>
            <option value="carat-desc">Carat (High to Low)</option>
          </select>
        </div>
        <button class="btn btn-sm" @click="clearFilters">Clear</button>
      </div>

      <div class="results-table-wrapper">
        <table class="results-table">
          <thead>
            <tr>
              <th>Stone Type</th>
              <th>Shape</th>
              <th>Carat</th>
              <th>Clarity</th>
              <th>Color</th>
              <th>Cut</th>
              <th>Cert</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredResults" :key="item.id" :class="{ error: item.error }">
              <td>{{ getStoneTypeLabel(item.config.stoneType) }}</td>
              <td>{{ getShapeLabel(item.config.shape) }}</td>
              <td>{{ item.config.carat }}</td>
              <td>{{ item.config.clarity }}</td>
              <td>{{ item.config.color }}</td>
              <td>{{ getCutGradeLabel(item.config.cutGrade) }}</td>
              <td>{{ getCertificateLabel(item.config.certificate) }}</td>
              <td class="price">{{ item.price ? `$${item.price.toLocaleString()}` : item.error ? 'Error' : 'N/A' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { DIAMOND_OPTIONS, type DiamondPrice } from '@/types/diamond'
import axios from 'axios'

const loading = ref(false)
const progress = ref('')
const results = ref<DiamondPrice[]>([])

// 浏览器状态
interface BrowserStatus {
  ready: boolean
  hasInstance: boolean
  hasPage: boolean
  proxyUrl: string
}
const browserStatus = ref<BrowserStatus>({
  ready: false,
  hasInstance: false,
  hasPage: false,
  proxyUrl: ''
})
const browserRestarting = ref(false)

// 获取浏览器状态
async function fetchBrowserStatus() {
  try {
    const response = await axios.get('/api/browser/status')
    browserStatus.value = response.data
  } catch (error) {
    console.error('Failed to fetch browser status:', error)
  }
}

// 重启浏览器
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

// 定时刷新浏览器状态
let browserStatusInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchBrowserStatus()
  browserStatusInterval = setInterval(fetchBrowserStatus, 30000)
})

// 任务轮询相关
const currentTaskId = ref<string | null>(null)
const taskStatus = ref<string>('')
const taskProgress = ref({
  completed: 0,
  total: 0,
  successCount: 0,
  errorCount: 0,
  percentage: 0
})
const exportFiles = ref<{ csv: string; json: string } | null>(null)
let pollingInterval: ReturnType<typeof setInterval> | null = null

// 网络状态相关
const isOnline = ref(true)
const reconnecting = ref(false)
const pollErrorCount = ref(0)
const maxPollErrors = 10  // 最多允许10次连续失败

// Multi-select state - default to all selected
const selectedStoneTypes = ref<string[]>(['LAB'])  // 默认选择实验室钻石
const selectedShapes = ref<string[]>(DIAMOND_OPTIONS.shapes.map(s => s.value))
const selectedCarats = ref<string[]>([...DIAMOND_OPTIONS.carats])
const selectedClarities = ref<string[]>([...DIAMOND_OPTIONS.clarities])
const selectedColors = ref<string[]>([...DIAMOND_OPTIONS.colors])
const selectedCutGrades = ref<string[]>(DIAMOND_OPTIONS.cutGrades.map(c => c.value))
const selectedCertificates = ref<string[]>(DIAMOND_OPTIONS.certificates.map(c => c.value))

// Result filters
const filterStoneType = ref('')
const filterShape = ref('')
const filterCarat = ref('')
const sortBy = ref('price-asc')

// 分批模式
const enableBatchMode = ref(false)
const batchDimension = ref<'carat' | 'shape' | 'clarity' | 'color' | 'cutGrade' | 'certificate' | 'stoneType'>('carat')

// 分批任务列表
interface BatchTask {
  taskId: string
  batchDimension: string
  batchValue: string
  status: string
  progress: {
    completed: number
    total: number
    percentage: number
  }
}
const batchTasks = ref<BatchTask[]>([])
let batchPollingInterval: ReturnType<typeof setInterval> | null = null

const completedBatchTasks = computed(() => {
  return batchTasks.value.filter(t => t.status === 'completed').length
})

// Toggle functions
function toggleStoneType(value: string) {
  const idx = selectedStoneTypes.value.indexOf(value)
  if (idx === -1) {
    selectedStoneTypes.value.push(value)
  } else {
    selectedStoneTypes.value.splice(idx, 1)
  }
}

function toggleShape(value: string) {
  const idx = selectedShapes.value.indexOf(value)
  if (idx === -1) {
    selectedShapes.value.push(value)
  } else {
    selectedShapes.value.splice(idx, 1)
  }
}

function toggleCarat(value: string) {
  const idx = selectedCarats.value.indexOf(value)
  if (idx === -1) {
    selectedCarats.value.push(value)
  } else {
    selectedCarats.value.splice(idx, 1)
  }
}

function toggleClarity(value: string) {
  const idx = selectedClarities.value.indexOf(value)
  if (idx === -1) {
    selectedClarities.value.push(value)
  } else {
    selectedClarities.value.splice(idx, 1)
  }
}

function toggleColor(value: string) {
  const idx = selectedColors.value.indexOf(value)
  if (idx === -1) {
    selectedColors.value.push(value)
  } else {
    selectedColors.value.splice(idx, 1)
  }
}

function toggleCutGrade(value: string) {
  const idx = selectedCutGrades.value.indexOf(value)
  if (idx === -1) {
    selectedCutGrades.value.push(value)
  } else {
    selectedCutGrades.value.splice(idx, 1)
  }
}

function toggleCertificate(value: string) {
  const idx = selectedCertificates.value.indexOf(value)
  if (idx === -1) {
    selectedCertificates.value.push(value)
  } else {
    selectedCertificates.value.splice(idx, 1)
  }
}

// Computed
const totalCombinations = computed(() => {
  return (
    selectedStoneTypes.value.length *
    selectedShapes.value.length *
    selectedCarats.value.length *
    selectedClarities.value.length *
    selectedColors.value.length *
    selectedCutGrades.value.length *
    selectedCertificates.value.length
  )
})

// 分批相关计算
const batchCount = computed(() => {
  switch (batchDimension.value) {
    case 'carat': return selectedCarats.value.length
    case 'shape': return selectedShapes.value.length
    case 'clarity': return selectedClarities.value.length
    case 'color': return selectedColors.value.length
    case 'cutGrade': return selectedCutGrades.value.length
    case 'certificate': return selectedCertificates.value.length
    case 'stoneType': return selectedStoneTypes.value.length
    default: return 1
  }
})

const itemsPerBatch = computed(() => {
  if (batchCount.value === 0) return 0
  return Math.ceil(totalCombinations.value / batchCount.value)
})

const estimatedTime = computed(() => {
  // Puppeteer page.evaluate(fetch) 模式：每批 15 个并发，每批约 3 秒（含网络延迟 + 300ms间隔）
  const concurrency = 15
  const secondsPerBatch = 3.5
  const batches = Math.ceil(totalCombinations.value / concurrency)
  const totalSeconds = batches * secondsPerBatch

  if (totalSeconds < 60) {
    return `~${Math.round(totalSeconds)} seconds`
  } else if (totalSeconds < 3600) {
    return `~${Math.round(totalSeconds / 60)} minutes`
  } else {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.round((totalSeconds % 3600) / 60)
    return `~${hours}h ${minutes}m`
  }
})

const successCount = computed(() => results.value.filter(r => !r.error && r.price !== null).length)
const errorCount = computed(() => results.value.filter(r => r.error).length)

const filteredResults = computed(() => {
  let filtered = [...results.value]

  if (filterStoneType.value) {
    filtered = filtered.filter(r => r.config.stoneType === filterStoneType.value)
  }
  if (filterShape.value) {
    filtered = filtered.filter(r => r.config.shape === filterShape.value)
  }
  if (filterCarat.value) {
    filtered = filtered.filter(r => r.config.carat === filterCarat.value)
  }

  // Sort
  filtered.sort((a, b) => {
    switch (sortBy.value) {
      case 'price-asc':
        return (a.price || 999999) - (b.price || 999999)
      case 'price-desc':
        return (b.price || 0) - (a.price || 0)
      case 'carat-asc':
        return parseFloat(a.config.carat) - parseFloat(b.config.carat)
      case 'carat-desc':
        return parseFloat(b.config.carat) - parseFloat(a.config.carat)
      default:
        return 0
    }
  })

  return filtered.slice(0, 500) // Limit display to 500 items
})

function clearFilters() {
  filterStoneType.value = ''
  filterShape.value = ''
  filterCarat.value = ''
  sortBy.value = 'price-asc'
}

// 停止轮询
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// 轮询任务状态（带断线重连）
async function pollTaskStatus(taskId: string) {
  try {
    const response = await axios.get(`/api/tasks/${taskId}`, {
      timeout: 10000  // 10秒超时
    })
    const task = response.data

    // 网络恢复，重置错误计数
    if (pollErrorCount.value > 0) {
      console.log('网络已恢复，继续轮询...')
      pollErrorCount.value = 0
      isOnline.value = true
      reconnecting.value = false
    }

    taskStatus.value = task.status
    taskProgress.value = task.progress

    // 更新进度显示
    progress.value = `${task.progress.completed}/${task.progress.total} (${task.progress.percentage}%)`

    if (task.status === 'completed') {
      // 任务完成，获取结果
      stopPolling()
      await fetchTaskResults(taskId)

      // 保存导出文件信息
      if (task.exportFiles) {
        exportFiles.value = task.exportFiles
        // 自动下载 CSV 文件
        autoDownloadFile(task.exportFiles.csv)
      }

      loading.value = false
    } else if (task.status === 'failed') {
      // 任务失败
      stopPolling()
      loading.value = false
      alert(`Task failed: ${task.error}`)
    } else if (task.status === 'cancelled') {
      // 任务被取消
      stopPolling()
      loading.value = false
      progress.value = 'Cancelled'
    }
  } catch (error: any) {
    // 网络错误处理 - 不立即停止，而是重试
    pollErrorCount.value++
    console.error(`Poll error (${pollErrorCount.value}/${maxPollErrors}):`, error.message)

    if (pollErrorCount.value === 1) {
      // 第一次失败，标记为可能断网
      isOnline.value = false
      reconnecting.value = true
      console.log('检测到网络问题，将持续重试...')
    }

    if (pollErrorCount.value >= maxPollErrors) {
      // 连续失败太多次，才停止轮询
      stopPolling()
      loading.value = false
      isOnline.value = false
      reconnecting.value = false
      alert(`网络连接失败次数过多 (${maxPollErrors}次)，轮询已停止。\n任务仍在后台运行，您可以刷新页面查看状态。`)
    }
    // 否则继续轮询，等待网络恢复
  }
}

// 自动下载文件
function autoDownloadFile(filepath: string) {
  if (!filepath) return
  const filename = filepath.split('/').pop() || filepath.split('\\').pop()
  if (!filename) return

  const link = document.createElement('a')
  link.href = `/api/exports/${filename}`
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 手动下载文件
function downloadFile(type: 'csv' | 'json') {
  if (!exportFiles.value) return
  const filepath = type === 'csv' ? exportFiles.value.csv : exportFiles.value.json
  autoDownloadFile(filepath)
}

// 获取任务结果
async function fetchTaskResults(taskId: string) {
  try {
    const response = await axios.get(`/api/tasks/${taskId}/results`)
    results.value = response.data.prices || []
    progress.value = `Done! ${results.value.length} items`
  } catch (error: any) {
    console.error('Fetch results error:', error)
    alert(`Failed to fetch results: ${error.message}`)
  }
}

// Crawl - 创建后台任务并轮询进度
async function handleCrawl() {
  if (totalCombinations.value === 0) return

  loading.value = true
  results.value = []
  progress.value = 'Starting...'
  taskStatus.value = 'pending'
  taskProgress.value = { completed: 0, total: totalCombinations.value, successCount: 0, errorCount: 0, percentage: 0 }

  try {
    if (enableBatchMode.value) {
      // 分批模式 - 创建多个任务
      await handleBatchCrawl()
    } else {
      // 单任务模式
      const response = await axios.post('/api/crawl-batch', {
        stoneTypes: selectedStoneTypes.value,
        shapes: selectedShapes.value,
        carats: selectedCarats.value,
        clarities: selectedClarities.value,
        colors: selectedColors.value,
        cutGrades: selectedCutGrades.value,
        certificates: selectedCertificates.value
      })

      const { taskId } = response.data
      currentTaskId.value = taskId
      progress.value = `Task created: ${taskId}`

      // 开始轮询（每2秒）
      pollingInterval = setInterval(() => {
        pollTaskStatus(taskId)
      }, 2000)

      // 立即执行一次
      pollTaskStatus(taskId)
    }
  } catch (error: any) {
    console.error('Crawl error:', error)
    alert(`Failed to create task: ${error.message}`)
    loading.value = false
  }
}

// 分批爬取 - 按维度创建多个任务
async function handleBatchCrawl() {
  const dimension = batchDimension.value
  let dimensionValues: string[] = []

  switch (dimension) {
    case 'carat': dimensionValues = selectedCarats.value; break
    case 'shape': dimensionValues = selectedShapes.value; break
    case 'clarity': dimensionValues = selectedClarities.value; break
    case 'color': dimensionValues = selectedColors.value; break
    case 'cutGrade': dimensionValues = selectedCutGrades.value; break
    case 'certificate': dimensionValues = selectedCertificates.value; break
    case 'stoneType': dimensionValues = selectedStoneTypes.value; break
  }

  const totalBatches = dimensionValues.length
  let createdCount = 0
  batchTasks.value = []

  for (const dimValue of dimensionValues) {
    createdCount++
    progress.value = `创建任务 ${createdCount}/${totalBatches} (${dimension}=${dimValue})...`

    // 构建请求参数，只包含当前维度的单个值
    const params: Record<string, string[]> = {
      stoneTypes: dimension === 'stoneType' ? [dimValue] : selectedStoneTypes.value,
      shapes: dimension === 'shape' ? [dimValue] : selectedShapes.value,
      carats: dimension === 'carat' ? [dimValue] : selectedCarats.value,
      clarities: dimension === 'clarity' ? [dimValue] : selectedClarities.value,
      colors: dimension === 'color' ? [dimValue] : selectedColors.value,
      cutGrades: dimension === 'cutGrade' ? [dimValue] : selectedCutGrades.value,
      certificates: dimension === 'certificate' ? [dimValue] : selectedCertificates.value
    }

    try {
      const response = await axios.post('/api/crawl-batch', {
        ...params,
        batchDimension: dimension,
        batchValue: dimValue
      })

      // 添加到分批任务列表
      batchTasks.value.push({
        taskId: response.data.taskId,
        batchDimension: dimension,
        batchValue: dimValue,
        status: 'pending',
        progress: { completed: 0, total: response.data.total, percentage: 0 }
      })

      console.log(`Task created for ${dimension}=${dimValue}:`, response.data.taskId)
    } catch (error: any) {
      console.error(`Failed to create task for ${dimension}=${dimValue}:`, error.message)
    }

    // 任务之间间隔 200ms
    if (createdCount < totalBatches) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  progress.value = `已创建 ${totalBatches} 个任务，正在监控进度...`

  // 开始轮询所有分批任务的状态
  startBatchPolling()
}

// 轮询分批任务状态
async function pollBatchTasks() {
  let allCompleted = true

  for (const task of batchTasks.value) {
    if (task.status === 'completed' || task.status === 'failed') continue

    try {
      const response = await axios.get(`/api/tasks/${task.taskId}`)
      const data = response.data

      task.status = data.status
      task.progress = data.progress

      if (data.status !== 'completed' && data.status !== 'failed') {
        allCompleted = false
      }
    } catch (error) {
      console.error(`Failed to poll task ${task.taskId}`)
      allCompleted = false
    }
  }

  // 更新总进度
  const totalCompleted = batchTasks.value.reduce((sum, t) => sum + t.progress.completed, 0)
  const totalItems = batchTasks.value.reduce((sum, t) => sum + t.progress.total, 0)
  progress.value = `${completedBatchTasks.value}/${batchTasks.value.length} 任务完成 (${totalCompleted.toLocaleString()}/${totalItems.toLocaleString()} 条)`

  if (allCompleted) {
    stopBatchPolling()
    loading.value = false
    progress.value = `全部完成！${batchTasks.value.length} 个任务已导出`
  }
}

// 开始轮询分批任务
function startBatchPolling() {
  stopBatchPolling()
  batchPollingInterval = setInterval(pollBatchTasks, 3000)
  pollBatchTasks() // 立即执行一次
}

// 停止轮询分批任务
function stopBatchPolling() {
  if (batchPollingInterval) {
    clearInterval(batchPollingInterval)
    batchPollingInterval = null
  }
}

// 组件卸载时停止轮询
onUnmounted(() => {
  stopPolling()
  stopBatchPolling()
  if (browserStatusInterval) {
    clearInterval(browserStatusInterval)
  }
})

// Label helpers
function getStoneTypeLabel(value: string): string {
  const stoneType = DIAMOND_OPTIONS.stoneTypes.find(s => s.value === value)
  return stoneType ? stoneType.label : value
}

function getShapeLabel(value: string): string {
  const shape = DIAMOND_OPTIONS.shapes.find(s => s.value === value)
  return shape ? shape.label : value
}

function getCutGradeLabel(value: string): string {
  const cut = DIAMOND_OPTIONS.cutGrades.find(c => c.value === value)
  return cut ? cut.label : value
}

function getCertificateLabel(value: string): string {
  const cert = DIAMOND_OPTIONS.certificates.find(c => c.value === value)
  return cert ? cert.label : value
}
</script>

<style scoped>
/* Cookie 面板样式 */
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

.browser-ready .browser-icon {
  background: #22c55e;
  color: white;
}

.browser-offline .browser-icon {
  background: #ef4444;
  color: white;
}

.browser-panel:not(.browser-ready):not(.browser-offline) .browser-icon {
  background: #f59e0b;
  color: white;
}

.browser-status-text {
  font-size: 13px;
  color: #6b7280;
  flex: 1;
}

.browser-info {
  margin-top: 8px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.browser-detail {
  font-size: 12px;
  color: #9ca3af;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

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

.config-form {
  margin-top: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}

@media (max-width: 1024px) {
  .form-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

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

.multi-select:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.multi-select.scrollable {
  max-height: 140px;
  overflow-y: auto;
}

.multi-select.scrollable::-webkit-scrollbar {
  width: 6px;
}

.multi-select.scrollable::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.multi-select.scrollable::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.multi-select.scrollable::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

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

.chip:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateY(-1px);
}

.chip.selected {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.chip.selected:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
}

.select-actions {
  display: flex;
  gap: 16px;
  font-size: 12px;
  padding-left: 4px;
}

.link {
  color: #667eea;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s;
}

.link:hover {
  color: #764ba2;
  text-decoration: underline;
}

/* 分批设置样式 */
.batch-settings {
  margin-bottom: 20px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
  border: 1px solid #fde047;
  border-radius: 12px;
}

.batch-toggle {
  margin-bottom: 12px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #854d0e;
}

.toggle-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #ca8a04;
  cursor: pointer;
}

.toggle-text {
  user-select: none;
}

.batch-options {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 1px solid #fde047;
}

.batch-options label {
  font-size: 13px;
  font-weight: 600;
  color: #854d0e;
}

.batch-options select {
  padding: 8px 12px;
  border: 1px solid #fde047;
  border-radius: 8px;
  font-size: 13px;
  background: white;
  color: #854d0e;
  cursor: pointer;
  min-width: 200px;
}

.batch-options select:focus {
  outline: none;
  border-color: #ca8a04;
  box-shadow: 0 0 0 3px rgba(202, 138, 4, 0.2);
}

.batch-info {
  font-size: 13px;
  color: #a16207;
}

.batch-info strong {
  color: #854d0e;
}

/* 分批任务列表样式 */
.batch-tasks-section {
  margin-top: 20px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #86efac;
  border-radius: 12px;
}

.batch-tasks-section h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #166534;
}

.batch-tasks-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.batch-task-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: white;
  border-radius: 8px;
  border: 1px solid #bbf7d0;
}

.batch-task-item.completed {
  background: #dcfce7;
  border-color: #22c55e;
}

.batch-task-item.running {
  background: #fef9c3;
  border-color: #facc15;
}

.batch-task-item.failed {
  background: #fee2e2;
  border-color: #f87171;
}

.task-label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.task-progress-bar {
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.task-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
  transition: width 0.3s ease;
}

.batch-task-item.running .task-progress-fill {
  background: linear-gradient(90deg, #facc15 0%, #eab308 100%);
}

.task-status {
  font-size: 11px;
  color: #6b7280;
  text-align: right;
}

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

.total-count, .time-estimate {
  font-size: 14px;
  color: #0369a1;
}

.total-count strong, .time-estimate strong {
  color: #0c4a6e;
}

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

.btn-large:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.btn-large:active:not(:disabled) {
  transform: translateY(0);
}

.btn-large:disabled {
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
  cursor: not-allowed;
  box-shadow: none;
}

/* 进度条样式 */
.progress-section {
  margin-top: 20px;
}

/* 网络状态提示 */
.network-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 18px;
  margin-bottom: 16px;
  border-radius: 10px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.network-status.reconnecting {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fbbf24;
}

.network-status .status-icon {
  font-size: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.network-status .status-text {
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
  display: flex;
  align-items: center;
  gap: 8px;
}

.network-status .status-hint {
  font-size: 12px;
  color: #b45309;
  font-style: italic;
}

.progress-bar-container {
  width: 100%;
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  font-size: 13px;
  color: #64748b;
}

.progress-text {
  font-weight: 600;
  color: #334155;
}

.progress-stats {
  display: flex;
  gap: 12px;
}

.progress-stats .success {
  color: #059669;
}

.progress-stats .error {
  color: #dc2626;
}

.progress-percent {
  font-weight: 700;
  color: #667eea;
  font-size: 14px;
}

.results-section {
  border-top: 2px solid #e2e8f0;
  padding-top: 28px;
  margin-top: 8px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.results-header h3 {
  margin: 0;
  font-size: 18px;
  color: #334155;
}

.results-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.results-stats {
  display: flex;
  gap: 12px;
}

.export-buttons {
  display: flex;
  gap: 8px;
}

.btn-export {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.btn-export:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-export .icon {
  font-size: 14px;
}

.stat {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 20px;
}

.stat.success {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #166534;
  border: 1px solid #86efac;
}

.stat.error {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.results-filters {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: flex-end;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.results-filters .filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.results-filters label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.results-filters select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  background: white;
  color: #334155;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 140px;
}

.results-filters select:hover {
  border-color: #cbd5e1;
}

.results-filters select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #334155;
}

.results-table-wrapper {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.results-table-wrapper::-webkit-scrollbar {
  width: 8px;
}

.results-table-wrapper::-webkit-scrollbar-track {
  background: #f8fafc;
}

.results-table-wrapper::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.results-table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.results-table th,
.results-table td {
  padding: 14px 16px;
  text-align: left;
  border-bottom: 1px solid #f1f5f9;
}

.results-table th {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  position: sticky;
  top: 0;
  z-index: 1;
}

.results-table tbody tr {
  transition: background-color 0.15s;
}

.results-table tbody tr:hover {
  background-color: #f8fafc;
}

.results-table tr.error {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}

.results-table tr.error:hover {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
}

.results-table .price {
  font-weight: 700;
  font-size: 14px;
  color: #059669;
}

.results-table tr.error .price {
  color: #dc2626;
  font-weight: 600;
}

.mt-20 {
  margin-top: 20px;
}

.mb-20 {
  margin-bottom: 20px;
}

.text-muted {
  color: #94a3b8;
  font-size: 14px;
}
</style>
