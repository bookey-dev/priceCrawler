/**
 * James Allen 爬虫
 * GraphQL API（和 BN 同属 Signet Jewelers，API 结构几乎一样）
 * JA 有 PerimeterX bot 检测，需要通过 Puppeteer 浏览器上下文发请求
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const browserPool = require('../browserPool.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const API_URL = 'https://www.jamesallen.com/service-api/ja-product-api/diamond/v/2/'
const SITE_URL = 'https://www.jamesallen.com/loose-diamonds/round-cut/'

const SHAPE_IDS = {
  'ROUND': [1], 'PRINCESS': [2], 'RADIANT': [3], 'EMERALD': [4],
  'MARQUISE': [5], 'OVAL': [6], 'PEAR': [7], 'HEART': [8],
  'ASSCHER': [9], 'CUSHION': [10]
}

const COLOR_IDS = { 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'H': 5, 'I': 6, 'J': 7, 'K': 8 }
const CLARITY_IDS = { 'FL': 1, 'IF': 2, 'VVS1': 3, 'VVS2': 4, 'VS1': 5, 'VS2': 6, 'SI1': 7, 'SI2': 8, 'I1': 9 }
const CUT_IDS = { 'TRUE_HEARTS': 0, 'EXCELLENT': 1, 'VERY_GOOD': 3, 'GOOD': 4 }

const GRAPHQL_QUERY = `query ($currency: currencies, $sort: sortBy, $price: intRange, $page: pager,
  $depth: floatRange, $ratio: floatRange, $carat: floatRange, $tableSize: floatRange,
  $color: intRange, $cut: intRange, $shapeID: [Int], $clarity: intRange,
  $shippingDays: Int, $isLabDiamond: Boolean, $isOnSale: Boolean) {
  searchByIDs(currency: $currency, sort: $sort, price: $price, page: $page,
    depth: $depth, ratio: $ratio, carat: $carat, tableSize: $tableSize,
    color: $color, cut: $cut, shapeID: $shapeID, clarity: $clarity,
    shippingDays: $shippingDays, isLabDiamond: $isLabDiamond, isOnSale: $isOnSale) {
    hits pageNumber numberOfPages total
    items {
      productID sku price usdPrice title url
      stone {
        carat shape { id name } color { id name } clarity { id name }
        cut { id name } lab { id name } depth tableSize measurements
      }
    }
  }
}`

class JACrawler extends BaseCrawler {
  constructor() {
    super('JA', 'James Allen')
    this._ready = false
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
      certificates: ['GIA', 'IGI'],
      requiresPuppeteer: true,
      crawlType: 'inventory'
    }
  }

  async initialize() {
    try {
      await browserPool.getPage('jamesallen.com', SITE_URL)
      this._ready = true
      console.log('[JA] Initialized with Puppeteer')
    } catch (e) {
      console.error('[JA] Failed to initialize:', e.message)
      this._ready = false
    }
  }

  async crawl(filters = {}, callbacks = {}) {
    const { onProgress, onResult } = callbacks
    const stoneCertPairs = filters.stoneCertPairs || [{ stoneType: 'LAB', certificate: 'IGI' }]
    const shapes = filters.shapes || Object.keys(SHAPE_IDS)
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const cutGrades = filters.cutGrades || ['EXCELLENT']
    const caratRange = filters.caratRange || { min: 0.2, max: 10.0 }
    const results = []

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
      if (colorId === undefined || clarityId === undefined) { tasksDone++; continue }

      const isLab = task.stoneType === 'LAB'
      let page = 1
      let hasMore = true
      let taskFetched = 0
      const taskLabel = `${task.stoneType} ${task.shape} ${task.color}+${task.clarity} ${task.cutGrade}`

      while (hasMore) {
        try {
          const variables = {
            currency: 'USD',
            sort: 'PriceAsc',
            page: { count: 4, size: 8, number: page },
            shapeID: shapeId,
            isLabDiamond: isLab,
            isOnSale: false,
            carat: { from: caratRange.min, to: caratRange.max },
            color: { from: colorId, to: colorId },
            clarity: { from: clarityId, to: clarityId },
            cut: { from: task.cutId, to: task.cutId },
            price: { from: 200, to: 5000000 },
            depth: { from: 46, to: 78 },
            tableSize: { from: 50, to: 80 },
            ratio: { from: 0.9, to: 2.75 },
            shippingDays: 999
          }

          const data = await this._fetchPage(variables)
          if (!data || !data.searchByIDs || !data.searchByIDs.items) {
            hasMore = false
            break
          }

          const { items, numberOfPages, hits: totalHits } = data.searchByIDs
          // items 是嵌套分组数组（count 组 × size 条），展开
          const allItems = items.flat()
          if (allItems.length === 0) {
            hasMore = false
            break
          }

          // 截断：只取到 hits 数量为止
          const remaining = (totalHits || Infinity) - taskFetched
          const itemsToProcess = remaining < allItems.length ? allItems.slice(0, remaining) : allItems

          for (const diamond of itemsToProcess) {
            if (!diamond || !diamond.stone) continue

            const normalized = normalizeDiamond({
              stoneType: isLab ? 'lab' : 'natural',
              shape: diamond.stone.shape?.name || task.shape,
              carat: diamond.stone.carat,
              color: diamond.stone.color?.name,
              clarity: diamond.stone.clarity?.name,
              cut: diamond.stone.cut?.name,
              certificate: diamond.stone.lab?.name,
              priceUSD: diamond.usdPrice || diamond.price,
              priceCurrency: 'USD',
              sourceId: diamond.sku
            }, 'JA')

            results.push(normalized)
            if (onResult) onResult(normalized)
          }

          taskFetched += itemsToProcess.length
          const realPages = Math.ceil((totalHits || 0) / allItems.length) || numberOfPages || 1

          // 分页进度
          if (onProgress) {
            const detail = `${taskLabel} - page ${page}/${realPages} (${totalHits || '?'} hits, ${taskFetched} fetched)`
            onProgress(tasksDone, totalTasks, results.length, detail)
          }

          hasMore = taskFetched < (totalHits || 0) && page < (numberOfPages || 1)
          page++
          await this.sleep(300)
        } catch (error) {
          console.error(`[JA] Error ${taskLabel} page ${page}:`, error.message)
          hasMore = false
        }
      }

      tasksDone++
      if (onProgress) {
        onProgress(tasksDone, totalTasks, results.length, `${taskLabel} - done`)
      }
      console.log(`[JA] Task ${tasksDone}/${totalTasks} done: ${taskLabel} (${results.length} diamonds)`)
      await this.sleep(300)
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[JA] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }

  async _fetchPage(variables) {
    const body = JSON.stringify({ query: GRAPHQL_QUERY, variables })

    return this.fetchWithRetry(async () => {
      const page = await browserPool.getPage('jamesallen.com')
      const result = await page.evaluate(async (fetchUrl, fetchBody) => {
        try {
          const res = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: fetchBody
          })
          if (res.status !== 200) return { error: `HTTP ${res.status}` }
          const json = await res.json()
          return { data: json.data }
        } catch (e) {
          return { error: e.message }
        }
      }, API_URL, body)

      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    })
  }
}

module.exports = JACrawler
