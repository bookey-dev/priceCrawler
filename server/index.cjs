const express = require('express')
const http = require('http')
const https = require('https')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const cookieManager = require('./cookieManager.cjs')
const browserPool = require('./browserPool.cjs')
const db = require('./db.cjs')

// 多品牌爬虫系统
const registry = require('./crawlers/CrawlerRegistry.cjs')
const DFCrawler = require('./crawlers/DFCrawler.cjs')
const BNCrawler = require('./crawlers/BNCrawler.cjs')
const SevenSevenDCrawler = require('./crawlers/77DCrawler.cjs')
const WCCrawler = require('./crawlers/WCCrawler.cjs')
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
registry.register(new GBCrawler())
registry.register(new BECrawler())

// 确保导出目录存在
const EXPORT_DIR = path.join(__dirname, '../exports')
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true })
}

function csvCell(value) {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

function downloadDate() {
  return new Date().toISOString().slice(0, 10)
}

function sanitizeFilenamePart(value) {
  return String(value || 'brand')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'brand'
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980)
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosTime, dosDate }
}

function createZip(files) {
  const chunks = []
  const centralDirectory = []
  let offset = 0
  const { dosTime, dosDate } = dosDateTime()

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data))
    const compressed = zlib.deflateRawSync(data)
    const checksum = crc32(data)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0x0800, 6)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localHeader.writeUInt16LE(0, 28)

    chunks.push(localHeader, name, compressed)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    centralDirectory.push(centralHeader, name)

    offset += localHeader.length + name.length + compressed.length
  }

  const centralDirectoryOffset = offset
  const centralDirectorySize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0)
  chunks.push(...centralDirectory)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDirectorySize, 12)
  end.writeUInt32LE(centralDirectoryOffset, 16)
  end.writeUInt16LE(0, 20)
  chunks.push(end)

  return Buffer.concat(chunks)
}

const app = express()
app.use(cors())
app.use(express.json())

// 挂载多品牌 API 路由
app.use('/api', brandsRouter)
app.use('/api', comparisonRouter)
app.use('/api', trendsRouter)

app.post('/api/admin/reset-database', (req, res) => {
  try {
    const deleted = db.resetDatabaseToInitialState()
    res.json({
      message: 'Database reset to initial state',
      deleted
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message })
  }
})

// 一键导出所有品牌：每个品牌取最新一条有数据的 completed session
app.get('/api/exports/all', (req, res) => {
  try {
    const d = db.getDb()
    const sessions = d.prepare(`
      SELECT cs.*
      FROM crawl_sessions cs
      JOIN (
        SELECT brand, MAX(id) AS latest_session_id
        FROM crawl_sessions
        WHERE status = 'completed' AND total_diamonds > 0
        GROUP BY brand
      ) latest ON latest.latest_session_id = cs.id
      ORDER BY cs.brand
    `).all()

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'No completed brand sessions with data found' })
    }

    const sessionIds = sessions.map(s => s.id)
    const placeholders = sessionIds.map(() => '?').join(',')
    const rows = d.prepare(`
      SELECT
        dp.*,
        cs.started_at AS session_started_at,
        cs.completed_at AS session_completed_at
      FROM diamond_prices dp
      JOIN crawl_sessions cs ON cs.id = dp.crawl_session_id
      WHERE dp.crawl_session_id IN (${placeholders})
      ORDER BY dp.brand, dp.id
    `).all(...sessionIds)

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No data found for latest completed brand sessions' })
    }

    const format = req.query.format === 'json' ? 'json' : 'csv'
    const filename = `all-brands-latest-${downloadDate()}.${format === 'json' ? 'zip' : format}`

    if (format === 'json') {
      const generatedAt = new Date().toISOString()
      const rowsBySession = new Map()
      for (const row of rows) {
        if (!rowsBySession.has(row.crawl_session_id)) rowsBySession.set(row.crawl_session_id, [])
        rowsBySession.get(row.crawl_session_id).push(row)
      }

      const files = sessions.map(session => {
        const brandRows = rowsBySession.get(session.id) || []
        const datePart = session.started_at.split(/[T ]/)[0]
        const safeBrand = sanitizeFilenamePart(session.brand)
        return {
          name: `${safeBrand}-session${session.id}-${datePart}.json`,
          data: JSON.stringify({
            generatedAt,
            session,
            rows: brandRows
          }, null, 2)
        }
      })

      const zip = createZip(files)
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Length', zip.length)
      res.send(zip)
      return
    }

    const headers = [
      'Session ID',
      'Brand',
      'Stone Type',
      'Shape',
      'Carat',
      'Color',
      'Clarity',
      'Cut',
      'Certificate',
      'Price (USD)',
      'Price Original',
      'Currency',
      'Source ID',
      'Carat Bucket',
      'Grade Key',
      'Crawled At',
      'Session Started At',
      'Session Completed At'
    ]
    const csvRows = rows.map(r => [
      r.crawl_session_id,
      r.brand,
      r.stone_type,
      r.shape,
      r.carat,
      r.color,
      r.clarity,
      r.cut,
      r.certificate,
      r.price_usd,
      r.price_original,
      r.price_currency,
      r.source_id,
      r.carat_bucket,
      r.grade_key,
      r.crawled_at,
      r.session_started_at,
      r.session_completed_at
    ].map(csvCell).join(','))

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send([headers.join(','), ...csvRows].join('\n'))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

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

// 重新初始化浏览器（可按品牌重启）
app.post('/api/browser/restart', async (req, res) => {
  try {
    const brandId = req.query.brand || req.body?.brand

    if (brandId) {
      const crawler = registry.getCrawler(brandId)
      if (!crawler || !crawler.getCapabilities().requiresPuppeteer) {
        return res.status(404).json({ error: 'Puppeteer brand not found' })
      }

      await crawler.shutdown()
      await crawler.initialize()
      const status = crawler.getStatus()
      return res.json({ message: `Browser restarted for ${brandId}`, status })
    }

    // 重新初始化需要浏览器的爬虫
    const puppeteerBrands = registry.getBrandList().filter(b => b.capabilities.requiresPuppeteer)
    for (const brand of puppeteerBrands) {
      const crawler = registry.getCrawler(brand.id)
      if (crawler) {
        try {
          await crawler.shutdown()
        } catch (e) {
          console.log(`  [${brand.id}] shutdown failed: ${e.message}`)
        }
      }
    }

    await browserPool.shutdown()

    const statuses = {}
    for (const brand of puppeteerBrands) {
      const crawler = registry.getCrawler(brand.id)
      if (crawler) {
        try {
          await crawler.initialize()
        } catch (e) {
          console.log(`  [${brand.id}] reinit failed: ${e.message}`)
        }
        statuses[brand.id] = crawler.getStatus()
      }
    }
    res.json({ message: 'Browser restarted', status: browserPool.getStatus(), brands: statuses })
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
        const status = crawler.getStatus()
        console.log(status.ready ? `  ✓ ${crawler.brandName} ready` : `  ✗ ${crawler.brandName}: ${status.lastError || 'not ready'}`)
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
  db.closeDb()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await registry.shutdownAll()
  await browserPool.shutdown()
  db.closeDb()
  process.exit(0)
})

startServer()

// 设置服务器超时时间为 24 小时（全量爬取需要很长时间）
server.timeout = 24 * 60 * 60 * 1000
server.keepAliveTimeout = 24 * 60 * 60 * 1000
server.headersTimeout = 24 * 60 * 60 * 1000 + 1000
