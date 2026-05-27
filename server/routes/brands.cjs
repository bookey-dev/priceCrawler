/**
 * 品牌相关 API 路由
 */
const express = require('express')
const router = express.Router()
const registry = require('../crawlers/CrawlerRegistry.cjs')
const db = require('../db.cjs')
const { computeAndSaveSnapshots } = require('../db.cjs')

// 获取所有品牌列表
router.get('/brands', (req, res) => {
  try {
    const brands = registry.getBrandList()
    res.json(brands)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取特定品牌状态
router.get('/brands/:brandId/status', (req, res) => {
  const crawler = registry.getCrawler(req.params.brandId)
  if (!crawler) {
    return res.status(404).json({ error: 'Brand not found' })
  }
  res.json({
    id: crawler.brandId,
    name: crawler.brandName,
    capabilities: crawler.getCapabilities(),
    status: crawler.getStatus()
  })
})

// 触发品牌爬取
router.post('/brands/:brandId/crawl', async (req, res) => {
  const { brandId } = req.params
  const crawler = registry.getCrawler(brandId)

  if (!crawler) {
    return res.status(404).json({ error: 'Brand not found' })
  }

  const filters = req.body || {}
  const sessionId = db.createCrawlSession(brandId, filters)

  // 立即返回 session ID
  res.json({
    sessionId,
    brand: brandId,
    status: 'running',
    message: `Crawl started for ${crawler.brandName}`
  })

  // 异步执行爬取
  ;(async () => {
    try {
      const crawlResult = await crawler.crawl(filters, {
        onProgress: (completed, total, successCount, detail) => {
          db.updateSessionProgress(sessionId, completed, total, successCount, detail)
          console.log(`[${brandId}] Progress: ${completed}/${total} (success: ${successCount})${detail ? ' | ' + detail : ''}`)
        }
      })
      const results = Array.isArray(crawlResult) ? crawlResult : (crawlResult?.rows || [])

      // 写入数据库
      if (results.length > 0) {
        db.insertDiamondPrices(results, sessionId)
        // 计算当日快照
        computeAndSaveSnapshots(brandId)
      }

      db.completeCrawlSession(sessionId, results.length)
      console.log(`[${brandId}] Crawl completed: ${results.length} diamonds`)
    } catch (error) {
      db.completeCrawlSession(sessionId, 0, error.message)
      console.error(`[${brandId}] Crawl failed:`, error.message)
    }
  })()
})

// 获取单个 session（含进度，供前端轮询）
router.get('/brands/:brandId/sessions/:sessionId', (req, res) => {
  const session = db.getCrawlSessionById(parseInt(req.params.sessionId))
  if (!session) return res.status(404).json({ error: 'Session not found' })
  res.json(session)
})

// 获取品牌爬取历史
router.get('/brands/:brandId/sessions', (req, res) => {
  const sessions = db.getCrawlSessions(req.params.brandId)
  res.json(sessions)
})

// 获取品牌最新数据
router.get('/brands/:brandId/latest', (req, res) => {
  const { brandId } = req.params
  const filters = { brand: brandId, limit: parseInt(req.query.limit) || 500 }

  if (req.query.stoneType) filters.stoneType = req.query.stoneType
  if (req.query.shape) filters.shape = req.query.shape

  const prices = db.getDiamondPrices(filters)
  res.json(prices)
})

// 导出 session 数据为 CSV
router.get('/brands/:brandId/sessions/:sessionId/export', (req, res) => {
  const sessionId = parseInt(req.params.sessionId)
  const session = db.getCrawlSessionById(sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const d = db.getDb()
  const rows = d.prepare('SELECT * FROM diamond_prices WHERE crawl_session_id = ? ORDER BY id').all(sessionId)

  if (rows.length === 0) {
    return res.status(404).json({ error: 'No data for this session' })
  }

  const format = req.query.format || 'csv'

  if (format === 'json') {
    const filename = `${session.brand}-session${sessionId}-${session.started_at.split(/[T ]/)[0]}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.json(rows)
    return
  }

  // CSV
  const headers = ['Brand', 'Stone Type', 'Shape', 'Carat', 'Color', 'Clarity', 'Cut', 'Certificate', 'Price (USD)']
  const csvRows = rows.map(r => [
    r.brand, r.stone_type, r.shape, r.carat, r.color, r.clarity, r.cut,
    r.certificate || '', r.price_usd
  ].map(v => `"${v}"`).join(','))

  const csv = [headers.join(','), ...csvRows].join('\n')
  const filename = `${session.brand}-session${sessionId}-${session.started_at.split(/[T ]/)[0]}.csv`

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csv)
})

module.exports = router
