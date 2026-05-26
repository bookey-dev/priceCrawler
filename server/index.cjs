const express = require('express')
const http = require('http')
const https = require('https')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const cookieManager = require('./cookieManager.cjs')
const browserPool = require('./browserPool.cjs')

// 多品牌爬虫系统
const registry = require('./crawlers/CrawlerRegistry.cjs')
const DFCrawler = require('./crawlers/DFCrawler.cjs')
const BNCrawler = require('./crawlers/BNCrawler.cjs')
const SevenSevenDCrawler = require('./crawlers/77DCrawler.cjs')
const WCCrawler = require('./crawlers/WCCrawler.cjs')
const JACrawler = require('./crawlers/JACrawler.cjs')
const GBCrawler = require('./crawlers/GBCrawler.cjs')
const BECrawler = require('./crawlers/BECrawler.cjs')

// API 路由
const brandsRouter = require('./routes/brands.cjs')
const comparisonRouter = require('./routes/comparison.cjs')
const trendsRouter = require('./routes/trends.cjs')

// 注册所有爬虫
registry.register(new DFCrawler())
registry.register(new BNCrawler())
registry.register(new SevenSevenDCrawler())
registry.register(new WCCrawler())
registry.register(new JACrawler())
registry.register(new GBCrawler())
registry.register(new BECrawler())

// 确保导出目录存在
const EXPORT_DIR = path.join(__dirname, '../exports')
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true })
}

const app = express()
app.use(cors())
app.use(express.json())

// 挂载多品牌 API 路由
app.use('/api', brandsRouter)
app.use('/api', comparisonRouter)
app.use('/api', trendsRouter)

// 下载导出文件
app.get('/api/exports/:filename', (req, res) => {
  const { filename } = req.params
  const filepath = path.join(EXPORT_DIR, filename)

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' })
  }

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

// 获取当前 Cookie 状态
app.get('/api/cookie/status', (req, res) => {
  try {
    const status = cookieManager.getCookieStatus()
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取浏览器状态（支持按品牌查询）
app.get('/api/browser/status', (req, res) => {
  try {
    const brandId = req.query.brand
    if (brandId) {
      const crawler = registry.getCrawler(brandId)
      if (crawler && typeof crawler.getStatus === 'function') {
        return res.json(crawler.getStatus())
      }
    }
    res.json(browserPool.getStatus())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 重新初始化浏览器（使用 browserPool）
app.post('/api/browser/restart', async (req, res) => {
  try {
    await browserPool.shutdown()
    // 重新初始化需要浏览器的爬虫
    const puppeteerBrands = registry.getBrandList().filter(b => b.capabilities.requiresPuppeteer)
    for (const brand of puppeteerBrands) {
      const crawler = registry.getCrawler(brand.id)
      if (crawler) {
        try {
          await crawler.initialize()
        } catch (e) {
          console.log(`  [${brand.id}] reinit failed: ${e.message}`)
        }
      }
    }
    res.json({ message: 'Browser restarted', status: browserPool.getStatus() })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3005
const useHttps = process.env.HTTPS === 'true'
const sslKeyPath = path.join(__dirname, 'ssl', 'server.key')
const sslCertPath = path.join(__dirname, 'ssl', 'server.cert')

let protocol = 'http'
let server = http.createServer(app)

if (useHttps) {
  if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    server = https.createServer({
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath)
    }, app)
    protocol = 'https'
  } else {
    console.warn('[Server] HTTPS=true but SSL files were not found; starting HTTP server instead.')
  }
}

// 初始化所有爬虫并启动服务器
async function startServer() {
  try {
    console.log('Initializing crawlers...')
    const brands = registry.getBrandList()

    // 先启动服务器，再并行初始化爬虫（避免慢爬虫阻塞整个服务）
    server.listen(PORT, () => {
      console.log(`${protocol.toUpperCase()} Server running on port ${PORT}`)
      console.log(`Access your server at: ${protocol}://localhost:${PORT}`)
    })

    // 非 Puppeteer 爬虫并行初始化
    const nonPuppeteer = brands.filter(b => {
      const c = registry.getCrawler(b.id)
      return c && !c.getCapabilities().requiresPuppeteer
    })
    const puppeteerBrands = brands.filter(b => {
      const c = registry.getCrawler(b.id)
      return c && c.getCapabilities().requiresPuppeteer
    })

    await Promise.all(nonPuppeteer.map(async (brand) => {
      const crawler = registry.getCrawler(brand.id)
      try {
        await crawler.initialize()
        console.log(`  ✓ ${crawler.brandName} ready`)
      } catch (e) {
        console.log(`  ✗ ${crawler.brandName}: ${e.message}`)
      }
    }))

    // Puppeteer 爬虫串行初始化（共享浏览器，避免并发连接问题）
    for (const brand of puppeteerBrands) {
      const crawler = registry.getCrawler(brand.id)
      try {
        await crawler.initialize()
        console.log(`  ✓ ${crawler.brandName} ready`)
      } catch (e) {
        console.log(`  ✗ ${crawler.brandName}: ${e.message}`)
      }
    }
    console.log(`Crawlers initialized (${brands.length} brands registered)`)
  } catch (error) {
    console.error('Failed to start server:', error.message)
    process.exit(1)
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\nShutting down...')
  await registry.shutdownAll()
  await browserPool.shutdown()
  require('./db.cjs').closeDb()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await registry.shutdownAll()
  await browserPool.shutdown()
  require('./db.cjs').closeDb()
  process.exit(0)
})

startServer()

// 设置服务器超时时间为 24 小时（全量爬取需要很长时间）
server.timeout = 24 * 60 * 60 * 1000
server.keepAliveTimeout = 24 * 60 * 60 * 1000
server.headersTimeout = 24 * 60 * 60 * 1000 + 1000
