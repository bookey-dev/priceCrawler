const express = require('express')
const https = require('https')
const cors = require('cors')
const cron = require('node-cron')
const fs = require('fs')
const path = require('path')
const { crawlDiamondPrices, crawlAllCombinations, initBrowser, closeBrowser, getBrowserStatus } = require('./crawler.cjs')
const cookieManager = require('./cookieManager.cjs')

// 确保导出目录存在
const EXPORT_DIR = path.join(__dirname, '../exports')
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true })
}

// 确保任务状态目录存在
const TASKS_DIR = path.join(__dirname, '../tasks')
if (!fs.existsSync(TASKS_DIR)) {
  fs.mkdirSync(TASKS_DIR, { recursive: true })
}

/**
 * 导出数据为 CSV 格式
 */
function exportToCSV(prices, filename) {
  const headers = ['Stone Type', 'Shape', 'Carat', 'Clarity', 'Color', 'Cut Grade', 'Certificate', 'Price (USD)', 'Error']
  const rows = prices.map(item => [
    item.config.stoneType || 'LAB',
    item.config.shape,
    item.config.carat,
    item.config.clarity,
    item.config.color,
    item.config.cutGrade,
    item.config.certificate,
    item.price || '',
    item.error || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const filepath = path.join(EXPORT_DIR, filename)
  fs.writeFileSync(filepath, csvContent, 'utf-8')
  console.log(`Exported CSV: ${filepath}`)
  return filepath
}

/**
 * 导出数据为 JSON 格式（只包含关键数据，与 CSV 格式对应）
 */
function exportToJSON(prices, filename) {
  const filepath = path.join(EXPORT_DIR, filename)
  // 只导出关键字段，与 CSV 保持一致
  const cleanPrices = prices.map(item => ({
    stoneType: item.config.stoneType || 'LAB',
    shape: item.config.shape,
    carat: item.config.carat,
    clarity: item.config.clarity,
    color: item.config.color,
    cutGrade: item.config.cutGrade,
    certificate: item.config.certificate,
    price: item.price || null
  }))
  fs.writeFileSync(filepath, JSON.stringify(cleanPrices, null, 2), 'utf-8')
  console.log(`Exported JSON: ${filepath}`)
  return filepath
}

/**
 * 自动导出任务结果
 */
function autoExportTaskResults(task) {
  if (!task.results || task.results.length === 0) return null

  // 使用本地时间格式化为 YYYY-MM-DD-HH-mm-ss
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const timestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`

  // 如果有分批信息，添加到文件名中
  let batchSuffix = ''
  if (task.options.batchDimension && task.options.batchValue) {
    batchSuffix = `-${task.options.batchDimension}-${task.options.batchValue}`
  }

  const baseFilename = `diamond-prices-${timestamp}${batchSuffix}`

  const csvFile = exportToCSV(task.results, `${baseFilename}.csv`)
  const jsonFile = exportToJSON(task.results, `${baseFilename}.json`)

  return {
    csv: csvFile,
    json: jsonFile,
    timestamp: new Date().toISOString()
  }
}

const app = express()
app.use(cors())
app.use(express.json())

// Store crawl results and settings in memory
let crawlHistory = []
let crawlSettings = {
  intervalMinutes: 60,
  isRunning: false,
  baseUrl: 'https://www.diamondsfactory.com',
  productId: 'clrn0709701'
}
let scheduledTask = null

// 后台任务队列
const tasks = new Map()

/**
 * 保存任务状态到文件
 */
function saveTaskToFile(task) {
  try {
    const taskFile = path.join(TASKS_DIR, `${task.id}.json`)
    const taskData = {
      id: task.id,
      status: task.status,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      options: task.options,
      progress: task.progress,
      results: task.results,
      error: task.error,
      exportFiles: task.exportFiles
    }
    fs.writeFileSync(taskFile, JSON.stringify(taskData, null, 2), 'utf-8')
  } catch (error) {
    console.error(`Failed to save task ${task.id}:`, error.message)
  }
}

/**
 * 从文件加载任务状态
 */
function loadTaskFromFile(taskId) {
  try {
    const taskFile = path.join(TASKS_DIR, `${taskId}.json`)
    if (fs.existsSync(taskFile)) {
      const taskData = JSON.parse(fs.readFileSync(taskFile, 'utf-8'))
      return taskData
    }
  } catch (error) {
    console.error(`Failed to load task ${taskId}:`, error.message)
  }
  return null
}

/**
 * 加载所有已保存的任务
 */
function loadAllTasks() {
  try {
    const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'))
    files.forEach(file => {
      const taskId = file.replace('.json', '')
      const taskData = loadTaskFromFile(taskId)
      if (taskData) {
        tasks.set(taskId, taskData)
        console.log(`Loaded task: ${taskId} (status: ${taskData.status})`)
      }
    })
  } catch (error) {
    console.error('Failed to load tasks:', error.message)
  }
}

/**
 * 删除任务文件（任务完成后清理）
 */
function deleteTaskFile(taskId) {
  try {
    const taskFile = path.join(TASKS_DIR, `${taskId}.json`)
    if (fs.existsSync(taskFile)) {
      fs.unlinkSync(taskFile)
    }
  } catch (error) {
    console.error(`Failed to delete task file ${taskId}:`, error.message)
  }
}

// 服务器启动时加载所有任务
loadAllTasks()

// 自动恢复未完成的任务
setTimeout(() => {
  tasks.forEach((task, taskId) => {
    if (task.status === 'running' || task.status === 'pending') {
      console.log(`Auto-resuming task: ${taskId}`)
      // 重置状态为 pending，以便可以重新运行
      task.status = 'pending'
      runTask(taskId)
    }
  })
}, 2000)  // 等待2秒后开始恢复，确保服务器完全启动

/**
 * 创建一个新的后台爬取任务
 */
function createTask(options) {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

  const task = {
    id: taskId,
    status: 'pending',  // pending, running, completed, failed, cancelled
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    options,
    progress: {
      completed: 0,
      total: 0,
      successCount: 0,
      errorCount: 0,
      percentage: 0
    },
    results: [],
    error: null
  }

  tasks.set(taskId, task)

  // 保存初始状态到文件
  saveTaskToFile(task)

  return task
}

/**
 * 执行后台任务（支持断点续爬）
 */
async function runTask(taskId) {
  const task = tasks.get(taskId)
  if (!task) return

  // 如果任务已经在运行或已完成，不重复执行
  if (task.status === 'running' || task.status === 'completed') {
    console.log(`Task ${taskId} is already ${task.status}`)
    return
  }

  task.status = 'running'
  task.startedAt = task.startedAt || new Date()

  const { stoneTypes, shapes, carats, clarities, colors, cutGrades, certificates } = task.options

  // 计算总数
  const total = (stoneTypes?.length || 1) * (shapes?.length || 0) * (carats?.length || 0) * (clarities?.length || 0) *
                (colors?.length || 0) * (cutGrades?.length || 0) * (certificates?.length || 0)

  task.progress.total = total

  // 保存开始状态
  saveTaskToFile(task)

  console.log(`Task ${taskId} started: ${total} combinations`)

  // 保存计数器 - 每处理10个结果保存一次
  let saveCounter = 0
  const SAVE_INTERVAL = 10

  try {
    const prices = await crawlAllCombinations(crawlSettings.productId, {
      stoneTypes: stoneTypes || ['LAB'],
      shapes: shapes || [],
      carats: carats || [],
      clarities: clarities || [],
      colors: colors || [],
      cutGrades: cutGrades || [],
      certificates: certificates || [],
      completedResults: task.results || [],  // 传入已完成的结果，支持断点续爬
      onProgress: (completed, total, successRate) => {
        // 更新任务进度
        task.progress.completed = completed
        task.progress.total = total
        task.progress.percentage = Math.round(completed / total * 100)
        // successRate 现在是实际成功数/已完成数的百分比
        task.progress.successCount = task.results ? task.results.length : 0
        task.progress.errorCount = completed - task.progress.successCount

        // 定期保存状态（每10个结果）
        saveCounter++
        if (saveCounter >= SAVE_INTERVAL) {
          saveTaskToFile(task)
          saveCounter = 0
        }
      },
      onResult: (result) => {
        // 只有成功的结果才会触发这个回调（失败的不会）
        if (!task.results) task.results = []
        task.results.push(result)
        // 立即更新成功计数
        task.progress.successCount = task.results.length
      }
    })

    // prices 现在只包含成功的结果（失败的不在里面）
    task.status = 'completed'
    task.completedAt = new Date()
    task.results = prices
    task.progress.completed = task.progress.total  // 已处理完所有
    task.progress.successCount = prices.length  // 成功数
    task.progress.errorCount = task.progress.total - prices.length  // 失败数
    task.progress.percentage = 100

    // 自动导出数据
    task.exportFiles = autoExportTaskResults(task)
    console.log(`Task ${taskId} auto-exported to:`, task.exportFiles)

    // 保存最终状态
    saveTaskToFile(task)

    // 添加到历史记录
    const result = {
      id: taskId,
      crawledAt: task.completedAt,
      totalItems: prices.length,
      prices: prices,
      exportFiles: task.exportFiles
    }
    crawlHistory.unshift(result)
    if (crawlHistory.length > 100) {
      crawlHistory = crawlHistory.slice(0, 100)
    }

    console.log(`Task ${taskId} completed: ${prices.length} items`)
  } catch (error) {
    task.status = 'failed'
    task.completedAt = new Date()
    task.error = error.message

    // 保存失败状态
    saveTaskToFile(task)

    console.error(`Task ${taskId} failed:`, error)
  }
}

// Get current settings
app.get('/api/settings', (req, res) => {
  res.json(crawlSettings)
})

// Update settings
app.post('/api/settings', (req, res) => {
  const { intervalMinutes, productId } = req.body
  if (intervalMinutes) {
    crawlSettings.intervalMinutes = intervalMinutes
  }
  if (productId) {
    crawlSettings.productId = productId
  }

  // Restart scheduler if running
  if (crawlSettings.isRunning) {
    stopScheduler()
    startScheduler()
  }

  res.json(crawlSettings)
})

// Get crawl history
app.get('/api/history', (req, res) => {
  res.json(crawlHistory)
})

// Get latest crawl result
app.get('/api/latest', (req, res) => {
  if (crawlHistory.length === 0) {
    return res.json(null)
  }
  res.json(crawlHistory[0])
})

// Manually trigger a crawl
app.post('/api/crawl', async (req, res) => {
  try {
    console.log('Manual crawl triggered...')
    const result = await performCrawl()
    res.json(result)
  } catch (error) {
    console.error('Crawl error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Crawl single configuration
app.post('/api/crawl-single', async (req, res) => {
  try {
    const { stoneType, shape, carat, clarity, color, cutGrade, certificate } = req.body
    console.log('Single crawl:', { stoneType, shape, carat, clarity, color, cutGrade, certificate })

    const result = await crawlDiamondPrices(crawlSettings.productId, {
      stoneType: stoneType || 'LAB',
      shape,
      carat,
      clarity,
      color,
      cutGrade,
      certificate
    })

    res.json(result)
  } catch (error) {
    console.error('Single crawl error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Crawl batch - 创建后台任务（异步）
app.post('/api/crawl-batch', async (req, res) => {
  try {
    const { stoneTypes, shapes, carats, clarities, colors, cutGrades, certificates, batchDimension, batchValue } = req.body

    console.log('Batch crawl request:', {
      stoneTypes: stoneTypes?.length || 0,
      shapes: shapes?.length || 0,
      carats: carats?.length || 0,
      clarities: clarities?.length || 0,
      colors: colors?.length || 0,
      cutGrades: cutGrades?.length || 0,
      certificates: certificates?.length || 0,
      batchDimension: batchDimension || null,
      batchValue: batchValue || null
    })

    const total = (stoneTypes?.length || 1) * (shapes?.length || 0) * (carats?.length || 0) * (clarities?.length || 0) *
                  (colors?.length || 0) * (cutGrades?.length || 0) * (certificates?.length || 0)

    if (total === 0) {
      return res.status(400).json({ error: 'No combinations to crawl' })
    }

    // 创建后台任务（包含分批信息）
    const task = createTask({
      stoneTypes, shapes, carats, clarities, colors, cutGrades, certificates,
      batchDimension: batchDimension || null,
      batchValue: batchValue || null
    })

    // 立即返回任务ID，让任务在后台运行
    res.json({
      taskId: task.id,
      status: 'pending',
      total,
      batchDimension: batchDimension || null,
      batchValue: batchValue || null,
      message: batchDimension
        ? `Task created for ${batchDimension}=${batchValue}. Crawling ${total} combinations in background.`
        : `Task created. Crawling ${total} combinations in background.`
    })

    // 异步执行任务（不等待完成）
    runTask(task.id)

  } catch (error) {
    console.error('Batch crawl error:', error)
    res.status(500).json({ error: error.message })
  }
})

// 获取任务状态
app.get('/api/tasks/:taskId', (req, res) => {
  const { taskId } = req.params
  const task = tasks.get(taskId)

  if (!task) {
    return res.status(404).json({ error: 'Task not found' })
  }

  // 返回任务状态（不包含完整结果，避免数据过大）
  res.json({
    id: task.id,
    status: task.status,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    progress: task.progress,
    error: task.error,
    hasResults: task.results.length > 0,
    exportFiles: task.exportFiles || null
  })
})

// 获取任务结果
app.get('/api/tasks/:taskId/results', (req, res) => {
  const { taskId } = req.params
  const task = tasks.get(taskId)

  if (!task) {
    return res.status(404).json({ error: 'Task not found' })
  }

  if (task.status !== 'completed') {
    return res.status(400).json({
      error: 'Task not completed yet',
      status: task.status,
      progress: task.progress
    })
  }

  res.json({
    id: task.id,
    completedAt: task.completedAt,
    totalItems: task.results.length,
    prices: task.results
  })
})

// 获取所有任务列表
app.get('/api/tasks', (req, res) => {
  const taskList = Array.from(tasks.values()).map(task => ({
    id: task.id,
    status: task.status,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    progress: task.progress,
    error: task.error
  }))

  // 按创建时间倒序排列
  taskList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  res.json(taskList)
})

// 下载导出文件
app.get('/api/exports/:filename', (req, res) => {
  const { filename } = req.params
  const filepath = path.join(EXPORT_DIR, filename)

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }

  // 设置下载头
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.csv') {
    res.setHeader('Content-Type', 'text/csv')
  } else if (ext === '.json') {
    res.setHeader('Content-Type', 'application/json')
  }
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  res.sendFile(filepath)
})

// 获取所有导出文件列表
app.get('/api/exports', (req, res) => {
  try {
    const files = fs.readdirSync(EXPORT_DIR)
      .filter(f => f.endsWith('.csv') || f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(EXPORT_DIR, f))
        return {
          filename: f,
          size: stat.size,
          createdAt: stat.birthtime
        }
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json(files)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 手动设置 Cookie（从浏览器复制）
app.post('/api/cookie', (req, res) => {
  const { cookie } = req.body
  if (!cookie) {
    return res.status(400).json({ error: 'Cookie is required' })
  }
  try {
    const status = cookieManager.setManualCookie(cookie)
    res.json({ message: 'Cookie set successfully', status })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// 获取当前 Cookie 状态（保留兼容）
app.get('/api/cookie/status', (req, res) => {
  try {
    const status = cookieManager.getCookieStatus()
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取浏览器状态
app.get('/api/browser/status', (req, res) => {
  try {
    res.json(getBrowserStatus())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 重新初始化浏览器
app.post('/api/browser/restart', async (req, res) => {
  try {
    await closeBrowser()
    await initBrowser()
    res.json({ message: 'Browser restarted', status: getBrowserStatus() })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 取消任务（仅对pending状态有效）
app.post('/api/tasks/:taskId/cancel', (req, res) => {
  const { taskId } = req.params
  const task = tasks.get(taskId)

  if (!task) {
    return res.status(404).json({ error: 'Task not found' })
  }

  if (task.status !== 'pending' && task.status !== 'running') {
    return res.status(400).json({ error: 'Task cannot be cancelled', status: task.status })
  }

  task.status = 'cancelled'
  task.completedAt = new Date()
  saveTaskToFile(task)

  res.json({ message: 'Task cancelled', task: { id: task.id, status: task.status } })
})

// 恢复/重启任务（支持断点续爬）
app.post('/api/tasks/:taskId/resume', (req, res) => {
  const { taskId } = req.params
  const task = tasks.get(taskId)

  if (!task) {
    return res.status(404).json({ error: 'Task not found' })
  }

  if (task.status === 'running') {
    return res.status(400).json({ error: 'Task is already running', status: task.status })
  }

  if (task.status === 'completed') {
    return res.status(400).json({ error: 'Task is already completed', status: task.status })
  }

  // 重置状态为 pending，然后重新运行
  task.status = 'pending'
  task.error = null
  saveTaskToFile(task)

  console.log(`Resuming task ${taskId} from ${task.results?.length || 0} completed results`)

  // 异步执行任务
  runTask(taskId)

  res.json({
    message: 'Task resumed',
    task: {
      id: task.id,
      status: task.status,
      completedResults: task.results?.length || 0
    }
  })
})

// Start scheduled crawling
app.post('/api/scheduler/start', (req, res) => {
  if (crawlSettings.isRunning) {
    return res.json({ message: 'Scheduler already running', settings: crawlSettings })
  }

  startScheduler()
  res.json({ message: 'Scheduler started', settings: crawlSettings })
})

// Stop scheduled crawling
app.post('/api/scheduler/stop', (req, res) => {
  stopScheduler()
  res.json({ message: 'Scheduler stopped', settings: crawlSettings })
})

// Perform the crawl
async function performCrawl() {
  console.log(`Starting crawl at ${new Date().toISOString()}`)

  try {
    const prices = await crawlAllCombinations(crawlSettings.productId)

    const result = {
      id: Date.now().toString(),
      crawledAt: new Date(),
      totalItems: prices.length,
      prices: prices
    }

    // Add to history (keep last 100 crawls)
    crawlHistory.unshift(result)
    if (crawlHistory.length > 100) {
      crawlHistory = crawlHistory.slice(0, 100)
    }

    console.log(`Crawl completed: ${prices.length} items`)
    return result
  } catch (error) {
    console.error('Crawl failed:', error)
    throw error
  }
}

// Start the scheduler
function startScheduler() {
  const minutes = crawlSettings.intervalMinutes

  // Create cron expression (run every N minutes)
  const cronExpression = `*/${minutes} * * * *`

  scheduledTask = cron.schedule(cronExpression, async () => {
    try {
      await performCrawl()
    } catch (error) {
      console.error('Scheduled crawl error:', error)
    }
  })

  crawlSettings.isRunning = true
  console.log(`Scheduler started: running every ${minutes} minutes`)
}

// Stop the scheduler
function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
  crawlSettings.isRunning = false
  console.log('Scheduler stopped')
}

const PORT = process.env.PORT || 3005

// Load SSL certificates
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.cert'))
}

// Create HTTPS server
const server = https.createServer(sslOptions, app)

// 初始化 Cookie Manager 并启动服务器
async function startServer() {
  try {
    // 初始化 Puppeteer 浏览器（通过 Cloudflare challenge）
    console.log('Initializing Puppeteer browser...')
    await initBrowser()
    console.log('Browser ready!')

    // 启动服务器
    server.listen(PORT, () => {
      console.log(`HTTPS Server running on port ${PORT}`)
      console.log(`Access your server at: https://192.168.1.58:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error.message)
    process.exit(1)
  }
}

// 优雅关闭浏览器
process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  await closeBrowser()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await closeBrowser()
  process.exit(0)
})

startServer()

// 设置服务器超时时间为 24 小时（全量爬取需要很长时间）
server.timeout = 24 * 60 * 60 * 1000
server.keepAliveTimeout = 24 * 60 * 60 * 1000
server.headersTimeout = 24 * 60 * 60 * 1000 + 1000
