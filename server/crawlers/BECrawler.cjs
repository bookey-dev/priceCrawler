/**
 * Brilliant Earth 爬虫 (Beta)
 * 最强反爬：需要 Puppeteer stealth + SPA 无限滚动
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const browserPool = require('../browserPool.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const SHAPE_URLS = {
  'ROUND': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Round',
  'PRINCESS': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Princess',
  'EMERALD': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Emerald',
  'MARQUISE': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Marquise',
  'OVAL': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Oval',
  'RADIANT': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Radiant',
  'PEAR': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Pear',
  'HEART': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Heart',
  'CUSHION': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Cushion',
  'ASSCHER': 'https://www.brilliantearth.com/lab-diamonds-search/?shapes=Asscher'
}

const NATURAL_URLS = {
  'ROUND': 'https://www.brilliantearth.com/loose-diamonds/search/?shapes=Round',
  'OVAL': 'https://www.brilliantearth.com/loose-diamonds/search/?shapes=Oval'
  // 其他形状类似
}

class BECrawler extends BaseCrawler {
  constructor() {
    super('BE', 'Brilliant Earth')
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: true,
      shapes: ['ROUND', 'PRINCESS', 'EMERALD', 'MARQUISE', 'OVAL', 'RADIANT', 'PEAR', 'HEART', 'CUSHION', 'ASSCHER'],
      caratRange: { min: 0.2, max: 9.0 },
      clarities: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1'],
      colors: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
      cutGrades: ['EXCELLENT', 'VERY_GOOD', 'GOOD'],
      certificates: ['GIA', 'IGI', 'HRD', 'GCAL'],
      requiresPuppeteer: true,
      crawlType: 'inventory',
      beta: true // 标记为 beta
    }
  }

  async initialize() {
    try {
      await browserPool.getPage('brilliantearth.com', 'https://www.brilliantearth.com/')
      this._ready = true
    } catch (error) {
      console.error('[BE] Failed to initialize (anti-bot protection):', error.message)
      this._ready = false
    }
  }

  async crawl(filters = {}, callbacks = {}) {
    const { onProgress, onResult } = callbacks
    const stoneCertPairs = filters.stoneCertPairs || [{ stoneType: 'LAB', certificate: 'IGI' }]
    const shapes = filters.shapes || ['ROUND']
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const results = []

    for (const { stoneType } of stoneCertPairs) {
      const urlMap = stoneType === 'LAB' ? SHAPE_URLS : NATURAL_URLS

      for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i]
        const url = urlMap[shape]
        if (!url) continue

        try {
          const page = await browserPool.getPage('brilliantearth.com')

          console.log(`[BE] Navigating to ${url}`)
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
          await this.sleep(5000) // 等待 SPA 加载

          // 尝试滚动加载更多数据
          let previousCount = 0
          let scrollAttempts = 0
          const maxScrollAttempts = 10

          while (scrollAttempts < maxScrollAttempts) {
            // 提取当前可见的钻石数据
            const diamonds = await page.evaluate(() => {
              const items = []
              // BE 使用表格或卡片展示钻石
              const rows = document.querySelectorAll('tr[data-diamond-id], .diamond-row, .diamond-card, [data-testid*="diamond"]')

              for (const row of rows) {
                const cells = row.querySelectorAll('td')
                if (cells.length >= 5) {
                  const priceText = row.querySelector('.price, [data-price]')?.textContent || ''
                  items.push({
                    shape: cells[0]?.textContent?.trim(),
                    carat: parseFloat(cells[1]?.textContent) || 0,
                    cut: cells[2]?.textContent?.trim(),
                    color: cells[3]?.textContent?.trim(),
                    clarity: cells[4]?.textContent?.trim(),
                    price: parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0,
                    sourceId: row.getAttribute('data-diamond-id') || ''
                  })
                }
              }
              return items
            })

            if (diamonds.length === previousCount) break
            previousCount = diamonds.length

            // 滚动到底部
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            await this.sleep(3000)
            scrollAttempts++
          }

          // 最终提取
          const diamonds = await page.evaluate(() => {
            const items = []
            const rows = document.querySelectorAll('tr[data-diamond-id], .diamond-row, .diamond-card, [data-testid*="diamond"]')
            for (const row of rows) {
              const cells = row.querySelectorAll('td')
              if (cells.length >= 5) {
                const priceText = row.querySelector('.price, [data-price]')?.textContent || ''
                items.push({
                  shape: cells[0]?.textContent?.trim(),
                  carat: parseFloat(cells[1]?.textContent) || 0,
                  cut: cells[2]?.textContent?.trim(),
                  color: cells[3]?.textContent?.trim(),
                  clarity: cells[4]?.textContent?.trim(),
                  price: parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0,
                  sourceId: row.getAttribute('data-diamond-id') || ''
                })
              }
            }
            return items
          })

          for (const d of diamonds) {
            if (!d.price || d.price <= 0) continue

            // Filter by fixed clarity+color pairs
            const matchesPair = colorClarityPairs.some(p => p.color === d.color && p.clarity === d.clarity)
            if (!matchesPair) continue

            const normalized = normalizeDiamond({
              stoneType: stoneType === 'LAB' ? 'lab' : 'natural',
              shape: d.shape || shape.toLowerCase(),
              carat: d.carat,
              color: d.color,
              clarity: d.clarity,
              cut: d.cut,
              certificate: null,
              priceUSD: d.price,
              priceCurrency: 'USD',
              sourceId: d.sourceId
            }, 'BE')

            results.push(normalized)
            if (onResult) onResult(normalized)
          }

          if (onProgress) {
            onProgress(i + 1, shapes.length, results.length)
          }

          await this.sleep(3000)
        } catch (error) {
          console.error(`[BE] Error crawling ${shape}:`, error.message)
        }
      }
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[BE] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }
}

module.exports = BECrawler
