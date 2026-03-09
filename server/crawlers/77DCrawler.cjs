/**
 * 77 Diamonds 爬虫
 * REST API，需要 session cookie
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const API_URL = 'https://www.77diamonds.com/api/bff/shop/diamond-list'
const SITE_URL = 'https://www.77diamonds.com/diamonds/loose-diamonds?item=-1'

// ID mappings
const SHAPE_IDS = {
  'ROUND': 1, 'PRINCESS': 2, 'EMERALD': 3, 'ASSCHER': 4, 'PEAR': 5,
  'RADIANT': 6, 'OVAL': 7, 'CUSHION': 8, 'HEART': 9, 'MARQUISE': 10
}

const COLOR_IDS = { 'D': 17, 'E': 15, 'F': 19, 'G': 22, 'H': 21, 'I': 20, 'J': 16, 'K': 18, 'L': 24 }
const CLARITY_IDS = { 'FL': 266, 'IF': 47, 'VVS1': 38, 'VVS2': 39, 'VS1': 44, 'VS2': 40, 'SI1': 41, 'SI2': 42 }
const CUT_IDS = { 'EXCELLENT': 56, 'VERY_GOOD': 57, 'GOOD': 58 }
const CERT_IDS = { 'GIA': 50, 'IGI': 51, 'HRD': 52 }

class SevenSevenDCrawler extends BaseCrawler {
  constructor() {
    super('77D', '77 Diamonds')
    this._cookies = null
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: true,
      shapes: Object.keys(SHAPE_IDS),
      caratRange: { min: 0.2, max: 10.0 },
      clarities: Object.keys(CLARITY_IDS),
      colors: Object.keys(COLOR_IDS),
      cutGrades: Object.keys(CUT_IDS),
      certificates: Object.keys(CERT_IDS),
      requiresPuppeteer: false,
      crawlType: 'inventory'
    }
  }

  async initialize() {
    try {
      await this._getSessionCookies()
      this._ready = true
    } catch (error) {
      console.error('[77D] Failed to initialize:', error.message)
      this._ready = false
    }
  }

  async _getSessionCookies() {
    const response = await fetch(SITE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    })
    const setCookies = response.headers.getSetCookie?.() || []
    this._cookies = setCookies.map(c => c.split(';')[0]).join('; ')
    // 添加必要的默认 cookie
    if (!this._cookies.includes('currentCurrencyId')) {
      this._cookies += '; currentCurrencyId=3; currentCountryId=840'
    }
    console.log('[77D] Session cookies obtained')
  }

  async crawl(filters = {}, callbacks = {}) {
    const { onProgress, onResult } = callbacks
    const stoneCertPairs = filters.stoneCertPairs || [{ stoneType: 'LAB', certificate: 'IGI' }]
    const shapes = filters.shapes || Object.keys(SHAPE_IDS)
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const cutGrades = filters.cutGrades || ['EXCELLENT']
    const caratRange = filters.caratRange || { min: 0.2, max: 10.0 }
    const results = []
    const PAGE_SIZE = 50

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
      const shapeId = SHAPE_IDS[task.shape]
      if (!shapeId) { tasksDone++; continue }
      const colorId = COLOR_IDS[task.color]
      const clarityId = CLARITY_IDS[task.clarity]
      if (!colorId || !clarityId) { tasksDone++; continue }

      const stoneTypeId = task.stoneType === 'LAB' ? 3 : 1
      let page = 1
      let hasMore = true
      let taskFetched = 0
      const taskLabel = `${task.stoneType} ${task.shape} ${task.color}+${task.clarity} ${task.cutGrade}`

      while (hasMore) {
        try {
          const body = {
            categoryId: 7,
            itemId: -1,
            stoneType: stoneTypeId,
            diamondType: '-1',
            shapes: [shapeId],
            isGroupedShapes: false,
            currentPage: page,
            resultsPerPage: PAGE_SIZE,
            CurrentPageNumber: page,
            ResultsPerPage: PAGE_SIZE,
            colors: [colorId],
            clarities: [clarityId],
            cuts: [task.cutId],
            Certificates: [],
            Polishes: [],
            Symmetries: [],
            Fluorescences: [],
            Intensities: [],
            minCarat: String(caratRange.min),
            maxCarat: String(caratRange.max),
            minPrice: 0,
            maxPrice: 0,
            minRatio: 1,
            maxRatio: 5,
            minDepth: 0, maxDepth: 0,
            minTable: 0, maxTable: 0,
            country: 0,
            currency: 0,
            language: 0,
            searchBlocked: false,
            showPairs: false,
            withMedia: false,
            quickShipping: false,
            WithMedia: false,
            QuickShipping: false,
            CountryId: 840,
            CurrencyId: 3,
            LanguageId: 1,
            UserPreference: { CountryId: 840, CurrencyId: 3, LanguageId: 1 },
            Url: SITE_URL
          }

          const data = await this._fetchPage(body)
          if (!data || !data.Diamonds || data.Diamonds.length === 0) {
            hasMore = false
            break
          }

          const totalHits = data.Total || 0

          for (const d of data.Diamonds) {
            const normalized = normalizeDiamond({
              stoneType: stoneTypeId === 3 ? 'lab' : 'natural',
              shape: d.ShapeName || task.shape,
              carat: d.CaratWeight || parseFloat(d.Carat),
              color: d.Color,
              clarity: d.Clarity,
              cut: d.Cut,
              certificate: d.Cert,
              priceUSD: d.FinalSalePriceUSD || d.FinalSalePriceGBP,
              priceCurrency: 'USD',
              sourceId: d.Code || d.StockNumber
            }, '77D')

            results.push(normalized)
            if (onResult) onResult(normalized)
          }

          taskFetched += data.Diamonds.length
          const totalPages = Math.ceil(totalHits / PAGE_SIZE) || 1

          // 分页进度
          if (onProgress) {
            const detail = `${taskLabel} - page ${page}/${totalPages} (${totalHits} hits, ${taskFetched} fetched)`
            onProgress(tasksDone, totalTasks, results.length, detail)
          }

          hasMore = taskFetched < totalHits && data.Diamonds.length >= PAGE_SIZE
          page++
          await this.sleep(800)
        } catch (error) {
          console.error(`[77D] Error ${taskLabel} page ${page}:`, error.message)
          if (error.message.includes('500') || error.message.includes('403')) {
            await this._getSessionCookies()
          }
          hasMore = false
        }
      }

      tasksDone++
      if (onProgress) {
        onProgress(tasksDone, totalTasks, results.length, `${taskLabel} - done`)
      }
      console.log(`[77D] Task ${tasksDone}/${totalTasks} done: ${taskLabel} (${results.length} diamonds)`)
      await this.sleep(300)
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[77D] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }

  async _fetchPage(body) {
    return this.fetchWithRetry(async () => {
      if (!this._cookies) await this._getSessionCookies()

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'domain': 'https://www.77diamonds.com',
          'Cookie': this._cookies
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    })
  }
}

module.exports = SevenSevenDCrawler
