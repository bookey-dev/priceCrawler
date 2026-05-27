/**
 * 共享 Puppeteer 浏览器池
 * 供 DF/GB/BE 等需要浏览器的爬虫使用
 */
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs')
puppeteer.use(StealthPlugin())

const PROXY_URL = process.env.BROWSER_PROXY_URL || 'socks5://127.0.0.1:7897'
const DEFAULT_CHROME_PATHS = [
  process.env.CHROME_EXECUTABLE_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` : null,
  process.env['PROGRAMFILES(X86)'] ? `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe` : null,
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null
].filter(Boolean)

function resolveChromeExecutablePath() {
  const configuredPath = process.env.CHROME_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH
  if (configuredPath) {
    if (!fs.existsSync(configuredPath)) {
      throw new Error(`Chrome executable not found at ${configuredPath}. Set CHROME_EXECUTABLE_PATH to a valid chrome.exe path.`)
    }
    return configuredPath
  }

  const defaultPath = DEFAULT_CHROME_PATHS.find(p => fs.existsSync(p))
  if (defaultPath) return defaultPath

  throw new Error('Chrome executable not found. Set CHROME_EXECUTABLE_PATH, for example: $env:CHROME_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"')
}

let browserInstance = null
let browserReady = false
let browserLaunching = null // 防止并发 launch
const pages = new Map() // domain -> page

async function getBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.version()
      return browserInstance
    } catch (e) {
      console.log('[BrowserPool] Browser lost, relaunching...')
      browserInstance = null
      browserReady = false
      browserLaunching = null
      pages.clear()
    }
  }

  // 防止并发 launch：如果已经在 launching，等待同一个 promise
  if (browserLaunching) {
    return browserLaunching
  }

  browserLaunching = (async () => {
    const executablePath = resolveChromeExecutablePath()
    console.log(`[BrowserPool] Launching Puppeteer with Chrome: ${executablePath}`)
    browserInstance = await puppeteer.launch({
      executablePath,
      headless: 'new',
      args: [
        `--proxy-server=${PROXY_URL}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    })
    browserReady = true
    browserLaunching = null
    return browserInstance
  })()

  return browserLaunching
}

/**
 * 获取指定域名的页面（带 Cloudflare 挑战处理）
 */
async function getPage(domain, targetUrl) {
  // 复用已有页面
  if (pages.has(domain)) {
    const page = pages.get(domain)
    try {
      await page.title()
      return page
    } catch (e) {
      pages.delete(domain)
    }
  }

  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1080 })

  if (targetUrl) {
    console.log(`[BrowserPool] Navigating to ${domain}...`)
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 90000 })

    // 等待 Cloudflare challenge 完成
    let attempts = 0
    while (attempts < 30) {
      const title = await page.title()
      if (!title.includes('Just a moment') && !title.includes('Attention Required')) {
        if (title.includes('Access denied')) {
          console.error(`[BrowserPool] ${domain} blocked by Cloudflare: "${title}"`)
          throw new Error(`Cloudflare Access denied for ${domain}`)
        }
        console.log(`[BrowserPool] ${domain} ready! Title: "${title}"`)
        break
      }
      console.log(`[BrowserPool] Waiting for Cloudflare on ${domain}...`)
      await new Promise(r => setTimeout(r, 2000))
      attempts++
    }
  }

  pages.set(domain, page)
  return page
}

async function releasePage(domain) {
  const page = pages.get(domain)
  if (page) {
    try { await page.close() } catch (e) {}
    pages.delete(domain)
  }
}

async function shutdown() {
  for (const [domain, page] of pages) {
    try { await page.close() } catch (e) {}
  }
  pages.clear()

  if (browserInstance) {
    try { await browserInstance.close() } catch (e) {}
    browserInstance = null
    browserReady = false
    browserLaunching = null
  }
  console.log('[BrowserPool] Shutdown complete')
}

function getStatus() {
  let chromeExecutablePath = null
  try {
    chromeExecutablePath = resolveChromeExecutablePath()
  } catch (e) {}

  return {
    ready: browserReady,
    hasInstance: !!browserInstance,
    activeDomains: Array.from(pages.keys()),
    proxyUrl: PROXY_URL,
    chromeExecutablePath
  }
}

module.exports = { getBrowser, getPage, releasePage, shutdown, getStatus, PROXY_URL }
