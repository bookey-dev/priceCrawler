/**
 * Blue Nile 爬虫
 * GraphQL API，纯 HTTP + SOCKS5 代理（BN 有 Captcha，不能用 Puppeteer）
 */
const https = require('https')
const BaseCrawler = require('./BaseCrawler.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const API_URL = 'https://www.bluenile.com/service-api/bn-product-api/diamond/v/2/'

const SHAPE_IDS = {
  'ROUND': [1], 'PRINCESS': [2], 'RADIANT': [3], 'EMERALD': [4],
  'MARQUISE': [5], 'OVAL': [6], 'PEAR': [7], 'HEART': [8],
  'ASSCHER': [9], 'CUSHION': [10]
}

const COLOR_RANGE = { 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'H': 5, 'I': 6, 'J': 7, 'K': 8 }
const CLARITY_RANGE = { 'FL': 1, 'IF': 2, 'VVS1': 3, 'VVS2': 4, 'VS1': 5, 'VS2': 6, 'SI1': 7, 'SI2': 8 }
const CUT_RANGE = { 'IDEAL': 0, 'EXCELLENT': 1, 'VERY_GOOD': 2, 'GOOD': 3 }

const GRAPHQL_QUERY = `query ($currency: currencies, $sort: sortBy, $price: intRange, $page: pager,
  $depth: floatRange, $ratio: floatRange, $carat: floatRange, $tableSize: floatRange,
  $color: intRange, $cut: intRange, $shapeID: [Int], $clarity: intRange,
  $shippingDays: Int, $isLabDiamond: Boolean) {
  searchByIDs(currency: $currency, sort: $sort, price: $price, page: $page,
    depth: $depth, ratio: $ratio, carat: $carat, tableSize: $tableSize,
    color: $color, cut: $cut, shapeID: $shapeID, clarity: $clarity,
    shippingDays: $shippingDays, isLabDiamond: $isLabDiamond) {
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

class BNCrawler extends BaseCrawler {
  constructor() {
    super('BN', 'Blue Nile')
    this._ready = true
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: true,
      shapes: ['ROUND', 'PRINCESS', 'EMERALD', 'MARQUISE', 'OVAL', 'RADIANT', 'PEAR', 'HEART', 'CUSHION', 'ASSCHER'],
      caratRange: { min: 0.2, max: 10.0 },
      clarities: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2'],
      colors: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'],
      cutGrades: ['IDEAL', 'EXCELLENT', 'VERY_GOOD', 'GOOD'],
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
            const cutId = CUT_RANGE[cutGrade]
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
      const colorId = COLOR_RANGE[task.color]
      const clarityId = CLARITY_RANGE[task.clarity]
      if (!colorId || !clarityId) { tasksDone++; continue }

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
            page: { number: page, size: 50 },
            shapeID: shapeId,
            isLabDiamond: isLab,
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
          // items 是嵌套分组数组（10 组 × size 条），展开后每页实际 10*size 条
          const allItems = items.flat()
          if (allItems.length === 0) {
            hasMore = false
            break
          }

          // 截断：只取到 hits 数量为止，超出部分是 API 填充的重复数据
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
            }, 'BN')

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
          console.error(`[BN] Error ${task.shape}/${task.color}/${task.clarity} page ${page}:`, error.message)
          hasMore = false
        }
      }

      tasksDone++
      if (onProgress) {
        onProgress(tasksDone, totalTasks, results.length, `${taskLabel} - done`)
      }
      console.log(`[BN] Task ${tasksDone}/${totalTasks} done: ${taskLabel} (${results.length} diamonds)`)
      await this.sleep(300)
    }

    const deduplicated = this.deduplicateByLowestPrice(results)
    console.log(`[BN] Done: ${results.length} raw → ${deduplicated.length} after dedup`)
    return deduplicated
  }

  async _fetchPage(variables) {
    const body = JSON.stringify({ query: GRAPHQL_QUERY, variables })

    return this.fetchWithRetry(() => {
      return new Promise((resolve, reject) => {
        const url = new URL(API_URL)
        const req = https.request({
          hostname: url.hostname,
          port: 443,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Content-Length': Buffer.byteLength(body)
          }
        }, (res) => {
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => {
            if (res.statusCode !== 200) {
              return reject(new Error(`HTTP ${res.statusCode}`))
            }
            try {
              const json = JSON.parse(data)
              resolve(json.data)
            } catch (e) {
              reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`))
            }
          })
        })
        req.on('error', reject)
        req.write(body)
        req.end()
      })
    })
  }
}

module.exports = BNCrawler
