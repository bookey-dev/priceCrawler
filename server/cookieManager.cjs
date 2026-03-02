/**
 * Cookie Manager - 手动设置 Cookie 模式
 * 由于 Cloudflare 能检测 Puppeteer（即使用 Stealth 插件），改为手动设置 Cookie
 *
 * 使用方法：
 * 1. 用 Chrome 浏览器访问 https://www.diamondsfactory.com
 * 2. 完成 Cloudflare 验证
 * 3. 打开开发者工具 (F12) -> Network -> 刷新页面
 * 4. 点击任意请求 -> Headers -> 找到 Cookie
 * 5. 复制整个 Cookie 值，粘贴到前端页面的 Cookie 设置框
 */
const fs = require('fs')
const path = require('path')

const COOKIE_FILE = path.join(__dirname, 'cookies.json')

// 全局 Cookie 字符串
let currentCookieString = ''
let lastRefreshTime = 0

// Cookie 有效期警告阈值（25 分钟）
const COOKIE_WARNING_THRESHOLD = 25 * 60 * 1000

/**
 * 从文件加载 Cookie
 */
function loadCookiesFromFile() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const data = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'))
      if (data.cookieString && data.timestamp) {
        const age = Date.now() - data.timestamp
        currentCookieString = data.cookieString
        lastRefreshTime = data.timestamp

        // 检查是否快过期
        if (age > COOKIE_WARNING_THRESHOLD) {
          console.log(`[CookieManager] Warning: Cookie is ${Math.round(age / 60000)} minutes old, may expire soon`)
        } else {
          console.log(`[CookieManager] Loaded cookies from file (age: ${Math.round(age / 1000)}s)`)
        }
        return true
      }
    }
  } catch (error) {
    console.error('[CookieManager] Failed to load cookies:', error.message)
  }
  return false
}

/**
 * 保存 Cookie 到文件
 */
function saveCookiesToFile() {
  try {
    fs.writeFileSync(COOKIE_FILE, JSON.stringify({
      cookieString: currentCookieString,
      timestamp: lastRefreshTime
    }, null, 2))
    console.log('[CookieManager] Cookies saved to file')
  } catch (error) {
    console.error('[CookieManager] Failed to save cookies:', error.message)
  }
}

/**
 * 获取当前 Cookie 字符串
 * 如果没有 Cookie，返回空字符串（不会自动获取）
 */
async function getCookieString() {
  if (!currentCookieString) {
    console.log('[CookieManager] No cookie available. Please set cookie manually via /api/cookie endpoint')
  }
  return currentCookieString
}

/**
 * 获取 Cookie 状态信息
 */
function getCookieStatus() {
  const age = Date.now() - lastRefreshTime
  const hasCfClearance = currentCookieString.includes('cf_clearance')
  const hasCfBm = currentCookieString.includes('__cf_bm')

  return {
    hasCookie: !!currentCookieString,
    hasCfClearance,
    hasCfBm,
    ageSeconds: Math.round(age / 1000),
    ageMinutes: Math.round(age / 60000),
    isExpiringSoon: age > COOKIE_WARNING_THRESHOLD,
    cookieLength: currentCookieString.length
  }
}

/**
 * 强制刷新 Cookie - 在手动模式下只打印提示
 */
async function forceRefreshCookies() {
  console.log('[CookieManager] ========================================')
  console.log('[CookieManager] Cookie 需要刷新！请手动设置：')
  console.log('[CookieManager] 1. 用 Chrome 访问 https://www.diamondsfactory.com')
  console.log('[CookieManager] 2. 完成 Cloudflare 验证')
  console.log('[CookieManager] 3. F12 -> Network -> 刷新 -> 点击请求 -> Headers -> 复制 Cookie')
  console.log('[CookieManager] 4. 在前端页面粘贴 Cookie，或调用 POST /api/cookie')
  console.log('[CookieManager] ========================================')

  // 返回当前的 cookie（可能是空的或过期的）
  return currentCookieString
}

/**
 * 初始化 Cookie Manager
 */
async function initialize() {
  console.log('[CookieManager] Initializing (Manual Cookie Mode)...')

  // 尝试从文件加载
  if (loadCookiesFromFile()) {
    const status = getCookieStatus()
    if (status.hasCfClearance) {
      console.log('[CookieManager] Cookie loaded with cf_clearance')
      return
    }
  }

  // 没有有效的 Cookie，打印提示
  console.log('[CookieManager] ========================================')
  console.log('[CookieManager] 没有找到有效的 Cookie！')
  console.log('[CookieManager] 请在前端页面设置 Cookie 后再开始爬取')
  console.log('[CookieManager] ========================================')
}

/**
 * 启动定时刷新 - 手动模式下不启用
 */
function startAutoRefresh() {
  console.log('[CookieManager] 手动 Cookie 模式，不启用自动刷新')
  console.log('[CookieManager] Cookie 过期后会在遇到 403 时提示手动刷新')
}

/**
 * 手动设置 Cookie（从浏览器复制）
 */
function setManualCookie(cookieString) {
  if (!cookieString || typeof cookieString !== 'string') {
    throw new Error('Invalid cookie string')
  }

  currentCookieString = cookieString.trim()
  lastRefreshTime = Date.now()
  saveCookiesToFile()

  const status = getCookieStatus()
  console.log(`[CookieManager] Manual cookie set (cf_clearance: ${status.hasCfClearance}, __cf_bm: ${status.hasCfBm})`)

  return status
}

module.exports = {
  initialize,
  getCookieString,
  getCookieStatus,
  forceRefreshCookies,
  startAutoRefresh,
  setManualCookie
}
