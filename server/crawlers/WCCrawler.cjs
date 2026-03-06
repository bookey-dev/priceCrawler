/**
 * With Clarity 爬虫
 * REST API，纯 HTTP
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const API_URL = 'https://vportalwithclarity.com/fetchdirectdiamond/'

class WCCrawler extends BaseCrawler {
  constructor() {
    super('WC', 'With Clarity')
    this._ready = true
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: true,
      shapes: ['ROUND', 'PRINCESS', 'RADIANT', 'PEAR', 'CUSHION', 'ASSCHER', 'EMERALD', 'MARQUISE', 'OVAL', 'HEART'],
      caratRange: { min: 0.25, max: 9.0 },
      clarities: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1'],
      colors: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
      cutGrades: ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR'],
      certificates: ['GCAL', 'IGI', 'GIA'],
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
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const results = []
    let totalFetched = 0

    for (const { stoneType } of stoneCertPairs) {
      const diamondType = stoneType === 'LAB' ? 'lab' : 'natural'
      let page = 1
      let hasMore = true
      let totalCount = 0

      while (hasMore) {
        try {
          const filterArray = this._buildFilterArray(filters, diamondType, page)
          const data = await this._fetchPage(filterArray)

          if (!data || !data.data?.liveDiamondData?.diamond) {
            hasMore = false
            break
          }

          const diamonds = data.data.liveDiamondData.diamond
          totalCount = data.data.liveDiamondData.originalCount || totalCount

          if (diamonds.length === 0) {
            hasMore = false
            break
          }

          for (const d of diamonds) {
            // Filter by fixed clarity+color pairs
            const matchesPair = colorClarityPairs.some(p => p.color === d.color && p.clarity === d.clarity)
            if (!matchesPair) continue

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

          totalFetched += diamonds.length
          if (onProgress) {
            const totalPages = Math.ceil(totalCount / 50) || '?'
            const detail = `${stoneType} ${diamondType} - page ${page}/${totalPages} (${totalCount} hits)`
            onProgress(totalFetched, totalCount, results.length, detail)
          }

          hasMore = totalFetched < totalCount
          page++
          await this.sleep(600)
        } catch (error) {
          console.error(`[WC] Error page ${page}:`, error.message)
          hasMore = false
        }
      }
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[WC] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }

  _buildFilterArray(filters, diamondType, page) {
    const shapes = filters.shapes
      ? filters.shapes.map(s => s.charAt(0) + s.slice(1).toLowerCase())
      : []

    return [
      { shapes },
      { cuts: [0, 1, 2, 3] },
      { colors: diamondType === 'lab' ? [4, 5, 6, 7, 8, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { claritys: diamondType === 'lab' ? [3, 4, 5, 6, 7, 8, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { labs: [] },
      { polish: [0, 1, 2, 3] },
      { symmetrys: [0, 1, 2, 3] },
      { price: `${filters.priceRange?.min || 100},${filters.priceRange?.max || 700000}` },
      { carat: `${filters.caratRange?.min || 0.25},${filters.caratRange?.max || 20}` },
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
      { country: 'US' },
      { color_intensity: [] }
    ]
  }

  async _fetchPage(filterArray) {
    return this.fetchWithRetry(async () => {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ filter: filterArray })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    })
  }
}

module.exports = WCCrawler
