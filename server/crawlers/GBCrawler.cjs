/**
 * Grown Brilliance 爬虫
 * REST API（POST form 参数）
 * 需要 Puppeteer（Cloudflare 保护）
 * 仅支持培育钻
 * API 返回 HTML 片段，需解析 DOM
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const browserPool = require('../browserPool.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')
const cheerio = require('cheerio')

const API_PATH = '/diamond_search_result_ajax'
const SITE_URL = 'https://www.grownbrilliance.com/lab-grown-diamonds-search'
const TARGET_SEARCH_URL = `${SITE_URL}?dmdSearch=first&min_carat=1.00&max_carat=10.00&fromPrice=565.00&toPrice=38400.00&shapes=1,2,8,4,6,10,3,5,7,9,11&fromCut=Excellent&toCut=Excellent&fromClarity=VVS1&toClarity=VVS1&fromColor=E&toColor=E`

const SHAPE_IDS = {
  'ROUND': 1, 'OVAL': 2, 'PRINCESS': 3, 'PEAR': 4,
  'MARQUISE': 5, 'EMERALD': 6, 'ASSCHER': 7, 'CUSHION': 8,
  'HEART': 9, 'RADIANT': 10, 'ELONGATED_CUSHION': 11
}

const PAGE_SIZE = 20
const TARGET_SEARCH = {
  shapeIds: [1, 2, 8, 4, 6, 10, 3, 5, 7, 9, 11],
  fromPrice: '565.00',
  toPrice: '38400.00',
  caratRange: { min: 1, max: 10 },
  color: 'E',
  clarity: 'VVS1',
  cutValue: 'Excellent'
}

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
      clarities: ['VVS1'],
      colors: ['E'],
      cutGrades: ['EXCELLENT'],
      certificates: ['IGI', 'GIA'],
      requiresPuppeteer: true,
      crawlType: 'inventory'
    }
  }

  async initialize() {
    try {
      await this._getSearchPage()
      this._ready = true
      console.log('[GB] Initialized with Puppeteer')
    } catch (error) {
      console.error('[GB] Failed to initialize:', error.message)
      this._ready = false
    }
  }

  async crawl(filters = {}, callbacks = {}) {
    const { onProgress, onResult } = callbacks
    const results = []
    const taskLabel = `LAB all shapes ${TARGET_SEARCH.color}+${TARGET_SEARCH.clarity} Excellent 1.00-10.00 $565-$38400`

    let page = 0 // GB API uses 0-based page indexes.
    let hasMore = true
    let fetched = 0
    let totalHits = 0
    let totalPages = 1
    let completedPages = 0

    while (hasMore) {
      try {
        const params = this._buildQueryParams({ page })
        const data = await this._fetchPage(params)

        if (!data || !data.totalDiamond) {
          break
        }

        totalHits = parseInt(String(data.totalDiamond).replace(/,/g, ''), 10) || 0
        totalPages = data.lastPage || Math.ceil(totalHits / PAGE_SIZE) || 1
        const diamonds = this._parseHTML(data.html)

        if (diamonds.length === 0) {
          break
        }

        const remaining = totalHits - fetched
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

        fetched += diamondsToProcess.length
        completedPages++

        if (onProgress) {
          const detail = `${taskLabel} - page ${completedPages}/${totalPages} (${totalHits} hits, ${fetched} fetched)`
          onProgress(completedPages, totalPages, results.length, detail)
        }

        const nextPage = parseInt(data.nextPage, 10)
        hasMore = fetched < totalHits && completedPages < totalPages && diamonds.length >= PAGE_SIZE && Number.isFinite(nextPage)
        page = hasMore ? nextPage : page + 1
        await this.sleep(600)
      } catch (error) {
        console.error(`[GB] Error ${taskLabel} page ${page}:`, error.message)
        hasMore = false
      }
    }

    if (onProgress) {
      onProgress(totalPages, totalPages, results.length, `${taskLabel} - done (${results.length}/${totalHits || results.length})`)
    }
    console.log(`[GB] Done: ${results.length} inventory rows`)
    return { rows: results }
  }

  _buildQueryParams({ page }) {
    const colorQ = `'${TARGET_SEARCH.color}'`
    const clarityQ = `'${TARGET_SEARCH.clarity}'`
    const cutQ = `'${TARGET_SEARCH.cutValue}'`

    const params = new URLSearchParams()
    params.set('is_ajax_call', '1')
    params.set('orignal_update_slider', '')
    params.set('shapes', TARGET_SEARCH.shapeIds.join(','))
    params.set('fromPrice', TARGET_SEARCH.fromPrice)
    params.set('toPrice', TARGET_SEARCH.toPrice)
    params.set('fromCarat', TARGET_SEARCH.caratRange.min.toFixed(2))
    params.set('toCarat', TARGET_SEARCH.caratRange.max.toFixed(2))
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
    const $ = cheerio.load(html)

    $('tr.ds_rtable_row').each((_, row) => {
      const $row = $(row)
      const href = $row.find('a[href*="/did/"]').first().attr('href') || ''
      const urlMatch = href.match(/\/lab-created-([\d.]+)-carat-([a-z]+)-color-([a-z0-9]+)-clarity-([a-z0-9-]+)-cut-([a-z0-9]+)\/did\/([^/?#]+)\.html/i)
      if (!urlMatch) return

      const carat = parseFloat(urlMatch[1])
      const color = urlMatch[2].toUpperCase()
      const clarity = urlMatch[3].toUpperCase()
      const cut = urlMatch[4]
      const lab = urlMatch[5].toUpperCase()
      const sourceId = urlMatch[6]
      const shape = $row.find('td.shape-ds .text').first().text().trim()
      const price = parseFloat($row.find('.dmd-price.price').first().text().replace(/[$,\s]/g, '')) || 0

      if (carat && price && shape) {
        diamonds.push({ shape, carat, color, clarity, cut, lab, price, sourceId })
      }
    })

    return diamonds
  }

  async _getSearchPage() {
    const page = await browserPool.getPage('grownbrilliance.com', TARGET_SEARCH_URL)
    if (!page.url().startsWith(SITE_URL)) {
      await page.goto(TARGET_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
    }
    await page.waitForSelector('meta[name="csrf-token"], input[name="_token"]', { timeout: 30000 }).catch(() => {})
    return page
  }

  async _fetchPage(queryString) {
    return this.fetchWithRetry(async () => {
      const page = await this._getSearchPage()
      const result = await page.evaluate(async (fetchUrl, fetchBody) => {
        try {
          const token = document.querySelector('meta[name="csrf-token"]')?.content ||
            document.querySelector('input[name="_token"]')?.value ||
            ''
          if (!token) {
            return { error: 'Missing CSRF token' }
          }

          const params = new URLSearchParams(fetchBody)
          params.set('_token', token)

          const res = await fetch(fetchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: params.toString()
          })

          const text = await res.text()
          if (res.status !== 200) {
            return { error: `HTTP ${res.status}: ${text.substring(0, 160)}`, status: res.status }
          }

          try {
            return { data: JSON.parse(text), status: res.status }
          } catch (e) {
            return { error: `Invalid JSON: ${text.substring(0, 160)}`, status: res.status }
          }
        } catch (e) {
          return { error: e.message }
        }
      }, `${API_PATH}?`, queryString)

      if (result.error) {
        if (result.status === 419) {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {})
        }
        throw new Error(result.error)
      }
      return result.data
    })
  }
}

module.exports = GBCrawler
