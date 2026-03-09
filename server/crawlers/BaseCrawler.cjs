/**
 * 爬虫基类 - 所有品牌爬虫必须继承此类
 */
class BaseCrawler {
  constructor(brandId, brandName, options = {}) {
    this.brandId = brandId
    this.brandName = brandName
    this.options = options
    this._ready = false
  }

  /**
   * 返回该品牌支持的能力（前端根据此动态显示过滤项）
   */
  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: true,
      shapes: [],
      caratRange: { min: 0.2, max: 10.0 },
      caratValues: null, // 仅 configurator 类品牌有离散值
      clarities: [],
      colors: [],
      cutGrades: [],
      certificates: [],
      requiresPuppeteer: false,
      crawlType: 'inventory' // 'inventory' | 'configurator'
    }
  }

  /**
   * 核心爬取方法 - 子类必须实现
   * @param {object} filters - 过滤条件
   * @param {object} callbacks - 回调函数 { onProgress, onResult }
   * @returns {Promise<Array>} NormalizedDiamond 数组
   */
  async crawl(filters, callbacks = {}) {
    throw new Error(`crawl() not implemented for ${this.brandId}`)
  }

  /**
   * 初始化（如启动浏览器、建立连接等）
   */
  async initialize() {
    this._ready = true
  }

  /**
   * 关闭资源
   */
  async shutdown() {
    this._ready = false
  }

  /**
   * 获取爬虫状态
   */
  getStatus() {
    const status = { ready: this._ready }
    if (this.getCapabilities().requiresPuppeteer) {
      try {
        const browserPool = require('../browserPool.cjs')
        const poolStatus = browserPool.getStatus()
        status.hasInstance = poolStatus.hasInstance
        status.proxyUrl = poolStatus.proxyUrl
      } catch (e) {}
    }
    return status
  }

  /**
   * 辅助方法：sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 辅助方法：带重试的 HTTP 请求
   */
  /**
   * 去重：相同 stoneType+shape+carat+color+clarity 取最低价
   */
  deduplicateByLowestPrice(results) {
    const map = new Map()
    for (const d of results) {
      const key = `${d.stoneType}|${d.shape}|${d.carat}|${d.color}|${d.clarity}|${d.cut}`
      const existing = map.get(key)
      if (!existing || d.priceUSD < existing.priceUSD) {
        map.set(key, d)
      }
    }
    return Array.from(map.values())
  }

  async fetchWithRetry(fetchFn, maxRetries = 3, baseDelay = 1000) {
    let lastError = null
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fetchFn()
      } catch (error) {
        lastError = error
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1)
          console.log(`[${this.brandId}] Retry ${attempt}/${maxRetries} after ${delay}ms: ${error.message}`)
          await this.sleep(delay)
        }
      }
    }
    throw lastError
  }
}

module.exports = BaseCrawler
