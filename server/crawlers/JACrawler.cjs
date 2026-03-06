/**
 * James Allen 爬虫
 * SSR 页面，从嵌入的 appData.ssrPageData 中提取数据
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const BASE_URL = 'https://www.jamesallen.com/loose-diamonds/all-diamonds/'
const LAB_URL = 'https://www.jamesallen.com/loose-diamonds/all-diamonds/' // JA uses same URL with isLabDiamond param

const SHAPE_SLUGS = {
  'ROUND': 'round-cut', 'PRINCESS': 'princess-cut', 'EMERALD': 'emerald-cut',
  'MARQUISE': 'marquise-cut', 'OVAL': 'oval-cut', 'RADIANT': 'radiant-cut',
  'PEAR': 'pear-cut', 'HEART': 'heart-cut', 'CUSHION': 'cushion-cut',
  'ASSCHER': 'asscher-cut'
}

class JACrawler extends BaseCrawler {
  constructor() {
    super('JA', 'James Allen')
    this._ready = true
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: true,
      shapes: Object.keys(SHAPE_SLUGS),
      caratRange: { min: 0.2, max: 9.0 },
      clarities: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2'],
      colors: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
      cutGrades: ['EXCELLENT', 'VERY_GOOD', 'GOOD'],
      certificates: ['GIA', 'IGI'],
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
    const shapes = filters.shapes || Object.keys(SHAPE_SLUGS)
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const results = []
    let totalFetched = 0

    for (const { stoneType } of stoneCertPairs) {
      // JA 培育钻和天然钻使用不同的 URL 路径
      const baseUrl = stoneType === 'LAB'
        ? 'https://www.jamesallen.com/loose-diamonds/lab-created-diamonds/'
        : BASE_URL

      for (const shape of shapes) {
        const shapeSlug = SHAPE_SLUGS[shape]
        if (!shapeSlug) continue

        let page = 1
        let hasMore = true

        while (hasMore) {
          try {
            const params = new URLSearchParams()
            params.set('Shape', shapeSlug)
            if (filters.caratRange) {
              params.set('MinCarat', filters.caratRange.min.toString())
              params.set('MaxCarat', filters.caratRange.max.toString())
            }
            params.set('Sort', 'price-asc')
            params.set('page', page.toString())

            const url = `${baseUrl}?${params.toString()}`
            const data = await this._fetchPage(url)

            if (!data || !data.items || data.items.length === 0) {
              hasMore = false
              break
            }

            for (const item of data.items) {
              const diamond = Array.isArray(item) ? item[0] : item
              if (!diamond || !diamond.stone) continue

              // Filter by fixed clarity+color pairs
              const dColor = diamond.stone.color?.name
              const dClarity = diamond.stone.clarity?.name
              const matchesPair = colorClarityPairs.some(p => p.color === dColor && p.clarity === dClarity)
              if (!matchesPair) continue

              const normalized = normalizeDiamond({
                stoneType: stoneType === 'LAB' ? 'lab' : 'natural',
                shape: diamond.stone.shape?.name || shape,
                carat: diamond.stone.carat,
                color: dColor,
                clarity: dClarity,
                cut: diamond.stone.cut?.name,
                certificate: diamond.stone.lab?.name,
                priceUSD: diamond.usdPrice || diamond.price,
                priceCurrency: 'USD',
                sourceId: diamond.sku
              }, 'JA')

              results.push(normalized)
              if (onResult) onResult(normalized)
            }

            totalFetched += data.items.length
            if (onProgress) {
              const totalHits = data.hits || totalFetched
              const detail = `${stoneType} ${shape} - page ${page}/${data.numberOfPages || '?'} (${totalHits} hits)`
              onProgress(totalFetched, totalHits, results.length, detail)
            }

            hasMore = page < (data.numberOfPages || 1)
            page++
            await this.sleep(800)
          } catch (error) {
            console.error(`[JA] Error fetching ${shape} page ${page}:`, error.message)
            hasMore = false
          }
        }
      }
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[JA] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }

  async _fetchPage(url) {
    return this.fetchWithRetry(async () => {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const html = await response.text()

      // 从 HTML 中提取嵌入的 appData JSON
      const appDataMatch = html.match(/appData\s*=\s*(\{[\s\S]*?\});\s*(?:<\/script>|window\.)/)
      if (!appDataMatch) {
        // 尝试另一种格式
        const ssrMatch = html.match(/"ssrPageData"\s*:\s*(\{[\s\S]*?\})\s*,\s*"/)
        if (!ssrMatch) throw new Error('Could not find ssrPageData in HTML')
        const ssrData = JSON.parse(ssrMatch[1])
        const pageData = ssrData['0']?.searchByIDs || ssrData.searchByIDs
        return pageData || null
      }

      try {
        const appData = JSON.parse(appDataMatch[1])
        const ssrData = appData.ssrPageData || {}
        // ssrPageData 可能嵌套在 "0" 键下
        const pageData = ssrData['0']?.searchByIDs || ssrData.searchByIDs
        return pageData || null
      } catch (parseError) {
        // 尝试更宽松的提取
        const searchMatch = html.match(/"searchByIDs"\s*:\s*(\{[\s\S]*?"items"\s*:\s*\[[\s\S]*?\]\s*\})/)
        if (searchMatch) {
          return JSON.parse(searchMatch[1])
        }
        throw new Error('Failed to parse appData JSON')
      }
    }, 2) // JA 只重试 2 次
  }
}

module.exports = JACrawler
