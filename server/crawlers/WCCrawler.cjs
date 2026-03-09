/**
 * With Clarity 爬虫
 * REST API，纯 HTTP
 */
const https = require('https')
const BaseCrawler = require('./BaseCrawler.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const API_URL = 'https://vportalwithclarity.com/fetchdirectdiamond/'

// ID mappings
const SHAPE_MAP = {
  'ROUND': 'Round', 'PRINCESS': 'Princess', 'RADIANT': 'Radiant', 'PEAR': 'Pear',
  'CUSHION': 'Cushion', 'ELONGATED_CUSHION': 'Elongated Cushion', 'ASSCHER': 'Asscher', 'EMERALD': 'Emerald',
  'MARQUISE': 'Marquise', 'OVAL': 'Oval', 'HEART': 'Heart'
}

const COLOR_IDS = { 'D': 8, 'E': 7, 'F': 6, 'G': 5, 'H': 4, 'I': 3, 'J': 2, 'K': 1, 'L': 0 }
const CLARITY_IDS = { 'FL': 8, 'IF': 7, 'VVS1': 6, 'VVS2': 5, 'VS1': 4, 'VS2': 3, 'SI1': 2, 'SI2': 1, 'I1': 0 }
// 网站 BY CUT 滑块从左到右: Good(0) → Very Good(1) → Excellent(2) → Ideal(3)
const CUT_IDS = { 'GOOD': 0, 'VERY_GOOD': 1, 'EXCELLENT': 2, 'IDEAL': 3 }

const PAGE_SIZE = 20

class WCCrawler extends BaseCrawler {
  constructor() {
    super('WC', 'With Clarity')
    this._ready = true
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: true,
      shapes: Object.keys(SHAPE_MAP),
      caratRange: { min: 0.25, max: 10.0 },
      clarities: Object.keys(CLARITY_IDS),
      colors: Object.keys(COLOR_IDS),
      cutGrades: Object.keys(CUT_IDS),
      certificates: ['GIA', 'IGI', 'GCAL'],
      requiresPuppeteer: false,
      crawlType: 'inventory'
    }
  }

  async initialize() {
    this._ready = true
  }

  async crawl(filters = {}, callbacks = {}) {
    const { onProgress, onResult } = callbacks
    const stoneCertPairs = filters.stoneCertPairs || [{ stoneType: 'LAB', certificate: 'IGI' }]
    const shapes = filters.shapes || Object.keys(SHAPE_MAP)
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const cutGrades = filters.cutGrades || ['EXCELLENT']
    const caratRange = filters.caratRange || { min: 0.25, max: 10.0 }
    const results = []

    // 构建任务列表：stoneType × shape × colorClarityPair × cutGrade
    const tasks = []
    for (const { stoneType } of stoneCertPairs) {
      for (const shape of shapes) {
        for (const pair of colorClarityPairs) {
          for (const cutGrade of cutGrades) {
            const cutId = CUT_IDS[cutGrade]
            if (cutId === undefined) continue
            tasks.push({ stoneType, shape, color: pair.color, clarity: pair.clarity, cutGrade, cutId })
          }
        }
      }
    }

    let tasksDone = 0
    const totalTasks = tasks.length

    for (const task of tasks) {
      const shapeName = SHAPE_MAP[task.shape]
      if (!shapeName) { tasksDone++; continue }
      const colorId = COLOR_IDS[task.color]
      const clarityId = CLARITY_IDS[task.clarity]
      if (colorId === undefined || clarityId === undefined) { tasksDone++; continue }

      const diamondType = task.stoneType === 'LAB' ? 'lab' : 'natural'
      let page = 1
      let hasMore = true
      let taskFetched = 0
      const taskLabel = `${task.stoneType} ${task.shape} ${task.color}+${task.clarity} ${task.cutGrade}`

      while (hasMore) {
        try {
          const filterArray = this._buildFilterArray({
            shapeName, colorId, clarityId, cutId: task.cutId,
            diamondType, caratRange, page
          })

          const data = await this._fetchPage(filterArray)

          if (!data || !data.data?.liveDiamondData?.diamond) {
            hasMore = false
            break
          }

          const diamonds = data.data.liveDiamondData.diamond
          // dataCount = 过滤后数量, originalCount = 未过滤总数
          const totalHits = data.data.liveDiamondData.dataCount || 0

          if (diamonds.length === 0) {
            hasMore = false
            break
          }

          // 截断：只取到 totalHits 数量为止
          const remaining = totalHits - taskFetched
          const diamondsToProcess = remaining < diamonds.length ? diamonds.slice(0, remaining) : diamonds

          for (const d of diamondsToProcess) {
            const normalized = normalizeDiamond({
              stoneType: diamondType,
              shape: d.shape,
              carat: parseFloat(d.size),
              color: d.color,
              clarity: d.clarity,
              cut: d.cut,
              certificate: d.lab,
              priceUSD: parseFloat(d.total_discounted_sales_price || d.total_sales_price),
              priceCurrency: 'USD',
              sourceId: d.cert_num
            }, 'WC')

            results.push(normalized)
            if (onResult) onResult(normalized)
          }

          taskFetched += diamondsToProcess.length
          const totalPages = Math.ceil(totalHits / PAGE_SIZE) || 1

          // 分页进度
          if (onProgress) {
            const detail = `${taskLabel} - page ${page}/${totalPages} (${totalHits} hits, ${taskFetched} fetched)`
            onProgress(tasksDone, totalTasks, results.length, detail)
          }

          hasMore = taskFetched < totalHits && diamonds.length >= PAGE_SIZE
          page++
          await this.sleep(600)
        } catch (error) {
          console.error(`[WC] Error ${taskLabel} page ${page}:`, error.message)
          hasMore = false
        }
      }

      tasksDone++
      if (onProgress) {
        onProgress(tasksDone, totalTasks, results.length, `${taskLabel} - done`)
      }
      console.log(`[WC] Task ${tasksDone}/${totalTasks} done: ${taskLabel} (${results.length} diamonds)`)
      await this.sleep(300)
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[WC] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }

  _buildFilterArray({ shapeName, colorId, clarityId, cutId, diamondType, caratRange, page }) {
    return [
      { shapes: [shapeName] },
      { cuts: [cutId] },
      { colors: [colorId] },
      { claritys: [clarityId] },
      { labs: [] },
      { polish: [0, 1, 2, 3] },
      { symmetrys: [0, 1, 2, 3] },
      { price: '100,700000' },
      { carat: `${caratRange.min},${caratRange.max}` },
      { page },
      { orderBy: 'Price' },
      { sortBy: 'ASC' },
      { lwratio: '0.9,2.75' },
      { fluorescences: [0, 1, 2, 3] },
      { sku: '' },
      { table: '40,90' },
      { depth: '40,90' },
      { type: '' },
      { diamond_type: diamondType },
      { cert_num: '' },
      { quick_ship_diamonds: 'N' },
      { Appointment: '' },
      { VaultDiscount: 'No' },
      { reports: '', country: 'US' },
      { country: 'US' },
      { color_intensity: [] }
    ]
  }

  async _fetchPage(filterArray) {
    const body = JSON.stringify({ filter: filterArray })
    return this.fetchWithRetry(() => {
      return new Promise((resolve, reject) => {
        const url = new URL(API_URL)
        const req = https.request({
          hostname: url.hostname,
          port: 443,
          path: url.pathname,
          method: 'POST',
          rejectUnauthorized: false,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Origin': 'https://www.withclarity.com',
            'Referer': 'https://www.withclarity.com/',
            'Content-Length': Buffer.byteLength(body)
          }
        }, (res) => {
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => {
            if (res.statusCode !== 200) {
              return reject(new Error(`HTTP ${res.statusCode}`))
            }
            try {
              resolve(JSON.parse(data))
            } catch (e) {
              reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`))
            }
          })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
      })
    })
  }
}

module.exports = WCCrawler
