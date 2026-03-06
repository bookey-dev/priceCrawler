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
      caratRange: { min: 0.3, max: 9.0 },
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
    const results = []
    let totalFetched = 0

    for (const { stoneType } of stoneCertPairs) {
      const stoneTypeId = stoneType === 'LAB' ? 3 : 1

      for (const shape of shapes) {
        const shapeId = SHAPE_IDS[shape]
        if (!shapeId) continue

        // Crawl each clarity+color pair separately
        for (const pair of colorClarityPairs) {
          const colorId = COLOR_IDS[pair.color]
          const clarityId = CLARITY_IDS[pair.clarity]
          if (!colorId || !clarityId) continue

        let page = 1
        let hasMore = true

        while (hasMore) {
          try {
            const body = {
              categoryId: 7,
              itemId: -1,
              stoneType: stoneTypeId,
              diamondType: -1,
              metalId: null,
              shapes: [shapeId],
              isGroupedShapes: false,
              CurrentPageNumber: page,
              ResultsPerPage: 50,
              colors: [colorId],
              clarities: [clarityId],
              cuts: filters.cutIds || null,
              Certificates: filters.certIds || null,
              Polishes: null,
              Symmetries: null,
              Fluorescences: null,
              Intensities: null,
              minCarat: filters.caratRange?.min || 0.3,
              maxCarat: filters.caratRange?.max || 30,
              minPrice: filters.priceRange?.min || 100,
              maxPrice: filters.priceRange?.max || 5000000,
              minRatio: 1,
              maxRatio: 5,
              minDepth: 0, maxDepth: 0,
              minTable: 0, maxTable: 0,
              WithMedia: false,
              QuickShipping: false,
              CountryId: 840,
              CurrencyId: 3, // USD
              LanguageId: 1,
              UserPreference: { CountryId: 840, CurrencyId: 3, LanguageId: 1, DiscountCode: null },
              Url: SITE_URL
            }

            const data = await this._fetchPage(body)
            if (!data || !data.Diamonds || data.Diamonds.length === 0) {
              hasMore = false
              break
            }

            for (const d of data.Diamonds) {
              const normalized = normalizeDiamond({
                stoneType: stoneTypeId === 3 ? 'lab' : 'natural',
                shape: d.ShapeName || shape,
                carat: d.CaratWeight || d.Carat,
                color: d.Color,
                clarity: d.Clarity,
                cut: d.Cut,
                certificate: d.Cert,
                priceUSD: d.FinalSalePriceUSD || d.FinalSalePriceGBP,
                priceOriginal: d.FinalSalePriceGBP,
                priceCurrency: 'GBP',
                sourceId: d.Code || d.StockNumber
              }, '77D')

              results.push(normalized)
              if (onResult) onResult(normalized)
            }

            totalFetched += data.Diamonds.length
            const totalCount = data.Total || totalFetched
            if (onProgress) {
              const totalPages = Math.ceil(totalCount / 50)
              const detail = `${stoneType} ${shape} ${pair.color}+${pair.clarity} - page ${page}/${totalPages} (${totalCount} hits)`
              onProgress(totalFetched, totalCount, results.length, detail)
            }

            hasMore = data.Diamonds.length >= 50 && totalFetched < (data.Total || Infinity)
            page++
            await this.sleep(800)
          } catch (error) {
            console.error(`[77D] Error fetching ${shape} page ${page}:`, error.message)
            // 尝试刷新 session
            if (error.message.includes('500') || error.message.includes('403')) {
              await this._getSessionCookies()
            }
            hasMore = false
          }
        }
        } // end colorClarityPairs
      }
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
