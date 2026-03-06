/**
 * 爬虫注册表 - 管理所有品牌爬虫
 */
class CrawlerRegistry {
  constructor() {
    this.crawlers = new Map()
  }

  register(crawler) {
    this.crawlers.set(crawler.brandId, crawler)
    console.log(`[Registry] Registered crawler: ${crawler.brandId} (${crawler.brandName})`)
  }

  getCrawler(brandId) {
    return this.crawlers.get(brandId)
  }

  getAllCrawlers() {
    return Array.from(this.crawlers.values())
  }

  getBrandList() {
    return this.getAllCrawlers().map(c => ({
      id: c.brandId,
      name: c.brandName,
      capabilities: c.getCapabilities(),
      status: c.getStatus()
    }))
  }

  async initializeAll() {
    for (const crawler of this.crawlers.values()) {
      try {
        await crawler.initialize()
        console.log(`[Registry] Initialized: ${crawler.brandId}`)
      } catch (error) {
        console.error(`[Registry] Failed to initialize ${crawler.brandId}:`, error.message)
      }
    }
  }

  async shutdownAll() {
    for (const crawler of this.crawlers.values()) {
      try {
        await crawler.shutdown()
      } catch (error) {
        console.error(`[Registry] Failed to shutdown ${crawler.brandId}:`, error.message)
      }
    }
  }
}

// 全局单例
const registry = new CrawlerRegistry()

module.exports = registry
