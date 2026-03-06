/**
 * Grown Brilliance 爬虫
 * 需要 Puppeteer（Cloudflare + AWS WAF）
 * 仅支持培育钻
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const browserPool = require('../browserPool.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const SEARCH_URL = 'https://www.grownbrilliance.com/lab-grown-diamonds-search'

const SHAPE_URLS = {
  'ROUND': '/round-lab-grown-diamonds-search',
  'OVAL': '/oval-lab-grown-diamonds-search',
  'CUSHION': '/cushion-cut-lab-grown-diamonds-search',
  'EMERALD': '/emerald-cut-lab-grown-diamonds-search',
  'PRINCESS': '/princess-cut-lab-grown-diamonds-search',
  'PEAR': '/pear-shaped-lab-grown-diamonds-search',
  'MARQUISE': '/marquise-lab-grown-diamonds-search',
  'RADIANT': '/radiant-cut-lab-grown-diamonds-search',
  'HEART': '/heart-shaped-lab-grown-diamonds-search',
  'ASSCHER': '/asscher-cut-lab-grown-diamonds-search'
}

class GBCrawler extends BaseCrawler {
  constructor() {
    super('GB', 'Grown Brilliance')
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: false, // 仅培育钻
      shapes: Object.keys(SHAPE_URLS),
      caratRange: { min: 0.5, max: 10.0 },
      clarities: ['VVS1', 'VVS2', 'VS1', 'VS2'],
      colors: ['D', 'E', 'F', 'G'],
      cutGrades: ['EXCELLENT'],
      certificates: ['IGI', 'GIA'],
      requiresPuppeteer: true,
      crawlType: 'inventory'
    }
  }

  async initialize() {
    try {
      await browserPool.getPage('grownbrilliance.com', 'https://www.grownbrilliance.com/')
      this._ready = true
    } catch (error) {
      console.error('[GB] Failed to initialize:', error.message)
      this._ready = false
    }
  }

  async crawl(filters = {}, callbacks = {}) {
    const { onProgress, onResult } = callbacks
    const shapes = filters.shapes || Object.keys(SHAPE_URLS)
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const results = []

    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i]
      const shapePath = SHAPE_URLS[shape]
      if (!shapePath) continue

      try {
        const page = await browserPool.getPage('grownbrilliance.com')

        // 导航到特定形状的搜索页面
        const url = `https://www.grownbrilliance.com${shapePath}`
        console.log(`[GB] Navigating to ${url}`)
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
        await this.sleep(3000) // 等待搜索结果加载

        // 尝试拦截 SearchSpring API 或解析 DOM
        const diamonds = await page.evaluate(() => {
          const items = []
          // 尝试从页面中提取钻石数据
          // SearchSpring 结果通常渲染为产品卡片
          const productCards = document.querySelectorAll('[data-ss-product], .ss-product, .product-card, .diamond-item, .search-result-item')

          for (const card of productCards) {
            const title = card.querySelector('.product-name, .diamond-title, h3, h4')?.textContent?.trim() || ''
            const priceText = card.querySelector('.product-price, .price, .diamond-price')?.textContent?.trim() || ''
            const link = card.querySelector('a')?.href || ''

            // 从标题或 URL 解析钻石属性
            // URL 格式: /lab-created-{carat}-carat-{color}-color-{clarity}-clarity-{cut}-cut-{cert}/did/{id}.html
            const urlMatch = link.match(/lab-created-([\d.]+)-carat-(\w+)-color-(\w+)-clarity-(\w+)-cut-(\w+)/)
            const price = parseFloat(priceText.replace(/[^0-9.]/g, ''))

            if (urlMatch && price) {
              items.push({
                carat: parseFloat(urlMatch[1]),
                color: urlMatch[2].toUpperCase(),
                clarity: urlMatch[3].toUpperCase(),
                cut: urlMatch[4],
                certificate: urlMatch[5].toUpperCase(),
                price,
                sourceId: link.match(/did\/([\w-]+)/)?.[1] || ''
              })
            }
          }
          return items
        })

        for (const d of diamonds) {
          // Filter by fixed clarity+color pairs
          const matchesPair = colorClarityPairs.some(p => p.color === d.color && p.clarity === d.clarity)
          if (!matchesPair) continue

          const normalized = normalizeDiamond({
            stoneType: 'lab',
            shape: shape.toLowerCase(),
            carat: d.carat,
            color: d.color,
            clarity: d.clarity,
            cut: d.cut,
            certificate: d.certificate,
            priceUSD: d.price,
            priceCurrency: 'USD',
            sourceId: d.sourceId
          }, 'GB')

          results.push(normalized)
          if (onResult) onResult(normalized)
        }

        if (onProgress) {
          onProgress(i + 1, shapes.length, results.length)
        }

        await this.sleep(2000)
      } catch (error) {
        console.error(`[GB] Error crawling ${shape}:`, error.message)
      }
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[GB] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }
}

module.exports = GBCrawler
