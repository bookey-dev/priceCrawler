/**
 * Grown Brilliance 爬虫
 * REST API（GET 请求，query string 参数）
 * 需要 Puppeteer（Cloudflare 保护）
 * 仅支持培育钻
 * API 返回 HTML 片段，需解析 DOM
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const browserPool = require('../browserPool.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const API_PATH = '/diamond_search_result_ajax'
const SITE_URL = 'https://www.grownbrilliance.com/lab-grown-diamonds-search'

const SHAPE_IDS = {
  'ROUND': 1, 'OVAL': 2, 'PRINCESS': 3, 'PEAR': 4,
  'MARQUISE': 5, 'EMERALD': 6, 'ASSCHER': 7, 'CUSHION': 8,
  'HEART': 9, 'RADIANT': 10, 'ELONGATED_CUSHION': 11
}

// Cut 值（字符串传递，用单引号包裹）
const CUT_VALUES = { 'IDEAL': 'Ideal', 'EXCELLENT': 'Excellent' }

const PAGE_SIZE = 20

class GBCrawler extends BaseCrawler {
  constructor() {
    super('GB', 'Grown Brilliance')
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: false,
      shapes: Object.keys(SHAPE_IDS),
      caratRange: { min: 1, max: 10.0 },
      clarities: ['IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2'],
      colors: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
      cutGrades: Object.keys(CUT_VALUES),
      certificates: ['IGI', 'GIA'],
      requiresPuppeteer: true,
      crawlType: 'inventory'
    }
  }

  async initialize() {
    try {
      await browserPool.getPage('grownbrilliance.com', 'https://www.grownbrilliance.com/')
      this._ready = true
      console.log('[GB] Initialized with Puppeteer')
    } catch (error) {
      console.error('[GB] Failed to initialize:', error.message)
      this._ready = false
    }
  }

  async crawl(filters = {}, callbacks = {}) {
    const { onProgress, onResult } = callbacks
    const shapes = filters.shapes || Object.keys(SHAPE_IDS)
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const cutGrades = filters.cutGrades || ['EXCELLENT']
    const caratRange = filters.caratRange || { min: 1, max: 10.0 }
    const results = []

    // 构建任务列表：shape × colorClarityPair × cutGrade（仅培育钻）
    const tasks = []
    for (const shape of shapes) {
      for (const pair of colorClarityPairs) {
        for (const cutGrade of cutGrades) {
          const cutValue = CUT_VALUES[cutGrade]
          if (!cutValue) continue
          tasks.push({ shape, color: pair.color, clarity: pair.clarity, cutGrade, cutValue })
        }
      }
    }

    let tasksDone = 0
    const totalTasks = tasks.length

    for (const task of tasks) {
      const shapeId = SHAPE_IDS[task.shape]
      if (shapeId === undefined) { tasksDone++; continue }

      let page = 0 // 0-based
      let hasMore = true
      let taskFetched = 0
      const taskLabel = `LAB ${task.shape} ${task.color}+${task.clarity} ${task.cutGrade}`

      while (hasMore) {
        try {
          const params = this._buildQueryParams({
            shapeId, color: task.color, clarity: task.clarity,
            cutValue: task.cutValue, caratRange, page
          })

          const data = await this._fetchPage(params)
          if (!data || !data.totalDiamond) {
            hasMore = false
            break
          }

          const totalHits = parseInt(String(data.totalDiamond).replace(/,/g, ''), 10) || 0
          const diamonds = this._parseHTML(data.html)

          if (diamonds.length === 0) {
            hasMore = false
            break
          }

          // 截断：只取到 totalHits 数量为止
          const remaining = totalHits - taskFetched
          const diamondsToProcess = remaining < diamonds.length ? diamonds.slice(0, remaining) : diamonds

          for (const d of diamondsToProcess) {
            const normalized = normalizeDiamond({
              stoneType: 'lab',
              shape: d.shape,
              carat: d.carat,
              color: d.color,
              clarity: d.clarity,
              cut: d.cut,
              certificate: d.lab,
              priceUSD: d.price,
              priceCurrency: 'USD',
              sourceId: d.sourceId
            }, 'GB')

            results.push(normalized)
            if (onResult) onResult(normalized)
          }

          taskFetched += diamondsToProcess.length
          const totalPages = data.lastPage || Math.ceil(totalHits / PAGE_SIZE) || 1

          if (onProgress) {
            const detail = `${taskLabel} - page ${page + 1}/${totalPages} (${totalHits} hits, ${taskFetched} fetched)`
            onProgress(tasksDone, totalTasks, results.length, detail)
          }

          hasMore = taskFetched < totalHits && diamonds.length >= PAGE_SIZE
          page++
          await this.sleep(600)
        } catch (error) {
          console.error(`[GB] Error ${taskLabel} page ${page}:`, error.message)
          hasMore = false
        }
      }

      tasksDone++
      if (onProgress) {
        onProgress(tasksDone, totalTasks, results.length, `${taskLabel} - done`)
      }
      console.log(`[GB] Task ${tasksDone}/${totalTasks} done: ${taskLabel} (${results.length} diamonds)`)
      await this.sleep(300)
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[GB] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }

  _buildQueryParams({ shapeId, color, clarity, cutValue, caratRange, page }) {
    const colorQ = `'${color}'`
    const clarityQ = `'${clarity}'`
    const cutQ = `'${cutValue}'`

    const params = new URLSearchParams()
    params.set('is_ajax_call', '1')
    params.set('orignal_update_slider', 'clarity')
    params.set('shapes', String(shapeId))
    params.set('fromPrice', '100')
    params.set('toPrice', '500000')
    params.set('fromCarat', caratRange.min.toFixed(2))
    params.set('toCarat', caratRange.max.toFixed(2))
    params.set('fromCut', cutQ)
    params.set('toCut', cutQ)
    params.set('fromColor', colorQ)
    params.set('toColor', colorQ)
    params.set('fromClarity', clarityQ)
    params.set('toClarity', clarityQ)
    params.set('fromRatio', '0.63')
    params.set('toRatio', '2.23')
    params.set('fromTable', '0.00')
    params.set('toTable', '80.00')
    params.set('fromDepth', '0.00')
    params.set('toDepth', '77.90')
    params.set('stone_type', 'labdiamond')
    params.set('sortBy', '13')
    params.set('sortByOrder', 'asc')
    params.set('pageSize', String(PAGE_SIZE))
    params.set('viewstr', 'normal')
    params.set('page', String(page))
    params.set('diamond_data_display_view', 'visual')

    return params.toString()
  }

  /**
   * 从 API 返回的 HTML 片段中解析钻石数据
   */
  _parseHTML(html) {
    if (!html) return []
    const diamonds = []

    // 从产品链接 URL 解析: /lab-created-{carat}-carat-{color}-color-{clarity}-clarity-{cut}-cut-{lab}/did/{id}.html
    const rowRegex = /<tr class="ds_rtable_row">([\s\S]*?)<\/tr>/g
    let match

    while ((match = rowRegex.exec(html)) !== null) {
      const row = match[1]

      // 解析 URL
      const urlMatch = row.match(/href="[^"]*\/lab-created-([\d.]+)-carat-(\w+)-color-(\w+)-clarity-(\w[\w\s]*?)-cut-(\w+)\/did\/([\w-]+)\.html"/)
      if (!urlMatch) continue

      const carat = parseFloat(urlMatch[1])
      const color = urlMatch[2].toUpperCase()
      const clarity = urlMatch[3].toUpperCase()
      const cut = urlMatch[4]
      const lab = urlMatch[5].toUpperCase()
      const sourceId = urlMatch[6]

      // 解析形状
      const shapeMatch = row.match(/<td class="shape-ds">[\s\S]*?<span class="text">([\w\s]+)<\/span>/)
      const shape = shapeMatch ? shapeMatch[1].trim() : ''

      // 解析价格
      const priceMatch = row.match(/class="dmd-price price">\s*\$([\d,]+)\s*</)
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0

      if (carat && price && shape) {
        diamonds.push({ shape, carat, color, clarity, cut, lab, price, sourceId })
      }
    }

    return diamonds
  }

  async _fetchPage(queryString) {
    const url = `${API_PATH}?${queryString}`

    return this.fetchWithRetry(async () => {
      const page = await browserPool.getPage('grownbrilliance.com')
      const result = await page.evaluate(async (fetchUrl) => {
        try {
          const res = await fetch(fetchUrl, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
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

module.exports = GBCrawler
