/**
 * Taylor & Hart 爬虫
 * GraphQL API，纯 HTTP，无需 Puppeteer
 * 非SKU模型（定价层级），数据量小（~251条），无分页
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const API_URL = 'https://taylorandhart.com/graphql'

const GRAPHQL_QUERY = `query($filters: NonSkuLabGrownDiamondsFilters!, $sort: NonSkuLabGrownDiamondSortInput!, $currency: CurrencyInput!, $region: RegionCode!, $locale: Locale!) {
  nonSkuLabGrownDiamonds(region: $region, currency: $currency, filters: $filters, sort: $sort) {
    id
    salePrice(currency: $currency, region: $region) { amount currency }
    shape { systemCode translation(locale: $locale) { name } }
    caratWeight
    color { systemCode translation(locale: $locale) { name } }
    clarity { abbreviation systemCode translation(locale: $locale) { name } }
    cut { systemCode translation(locale: $locale) { name } }
  }
  nonSkuLabGrownDiamondsBounds {
    caratWeight { min max }
    price(currency: $currency, region: $region) { min { amount currency } max { amount currency } }
    shapes { systemCode translation(locale: $locale) { name } }
    colors { systemCode translation(locale: $locale) { name } }
  }
}`

class THCrawler extends BaseCrawler {
  constructor() {
    super('TH', 'Taylor & Hart')
    this._ready = true
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: false, // Taylor & Hart 主要提供培育钻
      shapes: ['ROUND', 'OVAL', 'CUSHION', 'PEAR', 'EMERALD', 'PRINCESS', 'HEART', 'MARQUISE', 'RADIANT', 'ASSCHER'],
      caratRange: { min: 0.7, max: 10.0 },
      clarities: ['VVS2', 'VS1'],
      colors: ['D', 'F'],
      cutGrades: ['EXCELLENT'],
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
    // TH only supports lab-grown, stoneCertPairs not needed for iteration
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]

    try {
      const variables = {
        filters: {},
        sort: { field: 'PRICE', direction: 'ASC' },
        currency: { code: 'USD', region: 'US' },
        region: 'US',
        locale: 'en-US'
      }

      // 添加 shape 过滤
      if (filters.shapes && filters.shapes.length === 1) {
        variables.filters.shape = filters.shapes[0]
      }

      const data = await this._fetch(variables)
      if (!data || !data.nonSkuLabGrownDiamonds) return []

      const diamonds = data.nonSkuLabGrownDiamonds
      const results = []

      for (let i = 0; i < diamonds.length; i++) {
        const d = diamonds[i]

        // Filter by fixed clarity+color pairs
        const dColor = d.color?.translation?.name || d.color?.systemCode?.replace('DIAMOND_', '')
        const dClarity = d.clarity?.abbreviation || d.clarity?.translation?.name
        const matchesPair = colorClarityPairs.some(p => p.color === dColor && p.clarity === dClarity)
        if (!matchesPair) continue

        const normalized = normalizeDiamond({
          stoneType: 'lab',
          shape: d.shape?.translation?.name || d.shape?.systemCode,
          carat: parseFloat(d.caratWeight),
          color: d.color?.translation?.name || d.color?.systemCode?.replace('DIAMOND_', ''),
          clarity: d.clarity?.abbreviation || d.clarity?.translation?.name,
          cut: d.cut?.translation?.name || d.cut?.systemCode,
          certificate: null, // TH 不在列表中返回证书
          priceUSD: parseFloat(d.salePrice?.amount),
          priceCurrency: d.salePrice?.currency || 'USD',
          sourceId: d.id
        }, 'TH')

        results.push(normalized)
        if (onResult) onResult(normalized)
      }

      if (onProgress) {
        onProgress(diamonds.length, diamonds.length, results.length)
      }

      return results
    } catch (error) {
      console.error('[TH] Error:', error.message)
      return []
    }
  }

  async _fetch(variables) {
    return this.fetchWithRetry(async () => {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ query: GRAPHQL_QUERY, variables })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json()
      return json.data
    })
  }
}

module.exports = THCrawler
