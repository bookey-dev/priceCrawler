/**
 * Brilliant Earth 爬虫
 * REST API（GET 请求，query string 参数，返回 JSON）
 * 需要 Puppeteer（Cloudflare 保护）
 * 支持天然钻和培育钻
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const browserPool = require('../browserPool.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const API_PATH = '/api/v1/plp/products/'

// 形状名称（直接传字符串）
const SHAPE_NAMES = {
  'ROUND': 'Round', 'OVAL': 'Oval', 'EMERALD': 'Emerald', 'CUSHION': 'Cushion',
  'ELONGATED_CUSHION': 'Elongated Cushion', 'PEAR': 'Pear', 'RADIANT': 'Radiant',
  'PRINCESS': 'Princess', 'MARQUISE': 'Marquise', 'ASSCHER': 'Asscher', 'HEART': 'Heart'
}

// Cut 值（直接传字符串）
const CUT_VALUES = {
  'SUPER_IDEAL': 'Super Ideal', 'IDEAL': 'Ideal', 'VERY_GOOD': 'Very Good',
  'GOOD': 'Good', 'FAIR': 'Fair'
}

// stoneType -> product_class
const PRODUCT_CLASS = {
  'LAB': 'Lab Created Colorless Diamonds',
  'NATURAL': 'Loose Diamonds'
}

const PAGE_SIZE = 50

class BECrawler extends BaseCrawler {
  constructor() {
    super('BE', 'Brilliant Earth')
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: true,
      shapes: Object.keys(SHAPE_NAMES),
      caratRange: { min: 0.25, max: 10.0 },
      clarities: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2'],
      colors: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
      cutGrades: Object.keys(CUT_VALUES),
      certificates: ['GIA', 'IGI'],
      requiresPuppeteer: true,
      crawlType: 'inventory'
    }
  }

  async initialize() {
    try {
      await browserPool.getPage('brilliantearth.com', 'https://www.brilliantearth.com/')
      this._ready = true
      console.log('[BE] Initialized with Puppeteer')
    } catch (error) {
      console.error('[BE] Failed to initialize:', error.message)
      this._ready = false
    }
  }

  async crawl(filters = {}, callbacks = {}) {
    const { onProgress, onResult } = callbacks
    const stoneCertPairs = filters.stoneCertPairs || [{ stoneType: 'LAB', certificate: 'IGI' }]
    const shapes = filters.shapes || Object.keys(SHAPE_NAMES)
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const cutGrades = filters.cutGrades || ['SUPER_IDEAL']
    const caratRange = filters.caratRange || { min: 0.25, max: 10.0 }
    const results = []

    // 构建任务列表：stoneType × shape × colorClarityPair × cutGrade
    const tasks = []
    for (const { stoneType } of stoneCertPairs) {
      const productClass = PRODUCT_CLASS[stoneType]
      if (!productClass) continue
      for (const shape of shapes) {
        for (const pair of colorClarityPairs) {
          for (const cutGrade of cutGrades) {
            const cutValue = CUT_VALUES[cutGrade]
            if (!cutValue) continue
            tasks.push({ stoneType, productClass, shape, color: pair.color, clarity: pair.clarity, cutGrade, cutValue })
          }
        }
      }
    }

    let tasksDone = 0
    const totalTasks = tasks.length

    for (const task of tasks) {
      const shapeName = SHAPE_NAMES[task.shape]
      if (!shapeName) { tasksDone++; continue }

      let page = 1 // 1-based
      let hasMore = true
      let taskFetched = 0
      let totalHits = 0
      const taskLabel = `${task.stoneType} ${task.shape} ${task.color}+${task.clarity} ${task.cutGrade}`

      while (hasMore) {
        try {
          const queryString = this._buildQueryParams({
            shapeName, color: task.color, clarity: task.clarity,
            cutValue: task.cutValue, productClass: task.productClass,
            caratRange, page
          })

          const data = await this._fetchPage(queryString)
          if (!data || !data.products) {
            hasMore = false
            break
          }

          const products = data.products
          if (products.length === 0) {
            hasMore = false
            break
          }

          // BE API 没有返回 totalCount，用第一页判断是否有下一页
          // 如果返回的数量 < PAGE_SIZE，说明是最后一页
          for (const d of products) {
            const normalized = normalizeDiamond({
              stoneType: task.stoneType === 'LAB' ? 'lab' : 'natural',
              shape: d.shape || shapeName,
              carat: d.carat,
              color: d.color,
              clarity: d.clarity,
              cut: d.cut,
              certificate: d.report,
              priceUSD: d.price,
              priceCurrency: 'USD',
              sourceId: d.upc || d.id
            }, 'BE')

            results.push(normalized)
            if (onResult) onResult(normalized)
          }

          taskFetched += products.length

          if (onProgress) {
            const detail = `${taskLabel} - page ${page} (${taskFetched} fetched)`
            onProgress(tasksDone, totalTasks, results.length, detail)
          }

          hasMore = products.length >= PAGE_SIZE
          page++
          await this.sleep(600)
        } catch (error) {
          console.error(`[BE] Error ${taskLabel} page ${page}:`, error.message)
          hasMore = false
        }
      }

      tasksDone++
      if (onProgress) {
        onProgress(tasksDone, totalTasks, results.length, `${taskLabel} - done`)
      }
      console.log(`[BE] Task ${tasksDone}/${totalTasks} done: ${taskLabel} (${results.length} diamonds)`)
      await this.sleep(300)
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[BE] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }

  _buildQueryParams({ shapeName, color, clarity, cutValue, productClass, caratRange, page }) {
    const params = new URLSearchParams()
    params.set('display', String(PAGE_SIZE))
    params.set('page', String(page))
    params.set('currency', 'USD')
    params.set('product_class', productClass)
    params.set('shapes', shapeName)
    params.set('cuts', cutValue)
    params.set('colors', color)
    params.set('clarities', clarity)
    params.set('polishes', 'Good,Very Good,Excellent')
    params.set('symmetries', 'Good,Very Good,Excellent')
    params.set('fluorescences', 'Very Strong,Strong,Medium,Faint,None')
    params.set('min_price', '170')
    params.set('max_price', '500000')
    params.set('MIN_PRICE', '170')
    params.set('MAX_PRICE', '500000')
    params.set('min_table', '45')
    params.set('max_table', '97')
    params.set('MIN_TABLE', '45')
    params.set('MAX_TABLE', '97')
    params.set('min_depth', '3.6')
    params.set('max_depth', '97.4')
    params.set('MIN_DEPTH', '3.6')
    params.set('MAX_DEPTH', '97.4')
    params.set('min_carat', String(caratRange.min))
    params.set('max_carat', String(caratRange.max))
    params.set('MIN_CARAT', String(caratRange.min))
    params.set('MAX_CARAT', String(caratRange.max))
    params.set('min_ratio', '1')
    params.set('max_ratio', '2.75')
    params.set('MIN_RATIO', '1')
    params.set('MAX_RATIO', '2.75')
    params.set('order_by', 'price')
    params.set('order_method', 'asc')

    return params.toString()
  }

  async _fetchPage(queryString) {
    const url = `${API_PATH}?${queryString}`

    return this.fetchWithRetry(async () => {
      const page = await browserPool.getPage('brilliantearth.com', 'https://www.brilliantearth.com/')
      const result = await page.evaluate(async (fetchUrl) => {
        try {
          const res = await fetch(fetchUrl, {
            headers: {
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            }
          })
          if (res.status !== 200) return { error: `HTTP ${res.status}` }
          const json = await res.json()
          return { data: json }
        } catch (e) {
          return { error: e.message }
        }
      }, url)

      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    })
  }
}

module.exports = BECrawler
