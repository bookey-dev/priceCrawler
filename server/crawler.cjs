const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs')
puppeteer.use(StealthPlugin())

// Puppeteer 浏览器实例（全局共享，通过 Chromium 真实 TLS 指纹绕过 Cloudflare）
let browserInstance = null
let browserPage = null
let browserReady = false

const PROXY_URL = 'socks5://127.0.0.1:7897'
const TARGET_URL = 'https://www.diamondsfactory.com/design/prong-setting-solitaire-engagement-ring-clrn0709701'
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

/**
 * 初始化 Puppeteer 浏览器，导航到目标网站通过 Cloudflare challenge
 */
async function initBrowser() {
  if (browserReady && browserPage) {
    try {
      // 检查页面是否还活着
      await browserPage.title()
      return browserPage
    } catch (e) {
      console.log('[Browser] Page lost, reinitializing...')
      browserReady = false
    }
  }

  const executablePath = resolveChromeExecutablePath()
  console.log(`[Browser] Launching Puppeteer with Chrome: ${executablePath}`)

  if (browserInstance) {
    try { await browserInstance.close() } catch (e) {}
  }

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

  browserPage = await browserInstance.newPage()

  await browserPage.setViewport({ width: 1920, height: 1080 })

  console.log('[Browser] Navigating to target site (Cloudflare challenge)...')
  await browserPage.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 })

  // 等待 Cloudflare challenge 完成（检查页面标题不包含 "Just a moment"）
  let attempts = 0
  while (attempts < 30) {
    const title = await browserPage.title()
    if (!title.includes('Just a moment') && !title.includes('Attention Required')) {
      console.log(`[Browser] Cloudflare passed! Page title: "${title}"`)
      browserReady = true
      return browserPage
    }
    console.log(`[Browser] Waiting for Cloudflare challenge... (${title})`)
    await new Promise(r => setTimeout(r, 2000))
    attempts++
  }

  throw new Error('Failed to pass Cloudflare challenge after 60 seconds')
}

/**
 * 关闭浏览器
 */
async function closeBrowser() {
  if (browserInstance) {
    try { await browserInstance.close() } catch (e) {}
    browserInstance = null
    browserPage = null
    browserReady = false
    console.log('[Browser] Closed')
  }
}

/**
 * 获取浏览器状态
 */
function getBrowserStatus() {
  return {
    ready: browserReady,
    hasInstance: !!browserInstance,
    hasPage: !!browserPage,
    proxyUrl: PROXY_URL
  }
}

// Diamond configuration options
const STONE_TYPES = ['LAB', 'DI']  // Lab-Created Diamond (默认), Natural Diamond
const SHAPES = ['RND', 'PRN', 'EMR', 'MQS', 'OVL', 'RAD', 'PER', 'HRT', 'CUS', 'ASC']
const CARATS = [
  '0.20', '0.30', '0.40', '0.50', '0.60', '0.70', '0.80', '0.90', '1.00',
  '1.20', '1.50', '1.70', '2.00', '2.50', '3.00',
  '3.50', '4.00', '4.50', '5.00', '5.50', '6.00', '6.50', '7.00', '7.50',
  '8.00', '8.50', '9.00', '9.50', '10.00'
]
const CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1']
const COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const CUT_GRADES = ['EX', 'VG', 'GD', 'FR']
const CERTIFICATES = ['DF', 'EGL', 'IGI', 'GIA']

// Option IDs mapping based on the actual API
// These need to be mapped from the website's option system
const OPTION_IDS = {
  metal: 1,        // option[1] - Metal type
  ringSize: 3,     // option[3] - Ring size
  stoneType: 6,    // option[6] - Stone type (Natural/Lab)
  shape: 7,        // option[7] - Shape
  carat: 8,        // option[8] - Carat (min)
  clarity: 9,      // option[9] - Clarity
  color: 10,       // option[10] - Color
  cutGrade: 11,    // option[11] - Cut Grade
  certificate: 12  // option[12] - Certificate
}

// Value mappings - these are the actual option values from the website HTML
// Verified from website HTML: <li id="122" val="122" code="DI" namer="Natural Diamond">
const STONE_TYPE_VALUES = {
  'DI': 122,   // Natural Diamond
  'LAB': 958   // Lab-Created Diamond (默认)
}

// Verified from website HTML: <li id="125" val="125" code="RND" namer="Round">
const SHAPE_VALUES = {
  'RND': 125,  // Round
  'PRN': 126,  // Princess (code is PRN not PR)
  'EMR': 127,  // Emerald
  'MQS': 128,  // Marquise (code is MQS not MQ)
  'OVL': 129,  // Oval (code is OVL not OV)
  'RAD': 130,  // Radiant
  'PER': 131,  // Pear (code is PER not PS)
  'HRT': 132,  // Heart
  'CUS': 133,  // Cushion (code is CUS not CU)
  'ASC': 135   // Asscher (code is ASC not AS, value is 135 not 134)
}

// Verified from website HTML: <li id="141" val="141" code="VVS1" namer="VVS1">
const CLARITY_VALUES = {
  'FL': 139,
  'IF': 140,
  'VVS1': 141,
  'VVS2': 142,
  'VS1': 143,
  'VS2': 144,
  'SI1': 145,
  'SI2': 146,
  'I1': 147
}

// Verified from website HTML: <li id="150" val="150" code="D" namer="D">
const COLOR_VALUES = {
  'D': 150,
  'E': 151,
  'F': 152,
  'G': 153,
  'H': 154,
  'I': 155,
  'J': 853,  // Note: J,K,L have different values
  'K': 854,
  'L': 855
}

// Verified from website HTML: <li id="156" val="156" code="EX" namer="Excellent">
const CUT_VALUES = {
  'EX': 156,  // Excellent
  'VG': 157,  // Very Good
  'GD': 158,  // Good
  'FR': 230   // Fair (value is 230, not 159)
}

// Verified from website HTML: <li id="161" val="161" code="DF" namer="DF">
const CERTIFICATE_VALUES = {
  'DF': 161,
  'EGL': 186,   // EGL/SGL
  'IGI': 185,   // IGI/HRD
  'GIA': 187
}

// Verified from website HTML: <li id="191" val="191" code="20" namer="0.20">
const CARAT_VALUES = {
  '0.20': { min: '0.20', max: '30.00', code: '20', name: '0.20', optionValue: 191 },
  '0.30': { min: '0.30', max: '30.00', code: '30', name: '0.30', optionValue: 193 },
  '0.40': { min: '0.40', max: '30.00', code: '40', name: '0.40', optionValue: 195 },
  '0.50': { min: '0.50', max: '30.00', code: '50', name: '0.50', optionValue: 197 },
  '0.60': { min: '0.60', max: '30.00', code: '60', name: '0.60', optionValue: 199 },
  '0.70': { min: '0.70', max: '30.00', code: '70', name: '0.70', optionValue: 201 },
  '0.80': { min: '0.80', max: '30.00', code: '80', name: '0.80', optionValue: 203 },
  '0.90': { min: '0.90', max: '30.00', code: '90', name: '0.90', optionValue: 205 },
  '1.00': { min: '1.00', max: '30.00', code: '100', name: '1.00', optionValue: 207 },
  '1.20': { min: '1.20', max: '30.00', code: '120', name: '1.20', optionValue: 473 },
  '1.50': { min: '1.50', max: '30.00', code: '150', name: '1.50', optionValue: 209 },
  '1.70': { min: '1.70', max: '30.00', code: '170', name: '1.70', optionValue: 481 },
  '2.00': { min: '2.00', max: '30.00', code: '200', name: '2.00', optionValue: 211 },
  '2.50': { min: '2.50', max: '30.00', code: '250', name: '2.50', optionValue: 213 },
  '3.00': { min: '3.00', max: '30.00', code: '300', name: '3.00', optionValue: 215 },
  '3.50': { min: '3.50', max: '30.00', code: '350', name: '3.50', optionValue: 217 },
  '4.00': { min: '4.00', max: '30.00', code: '400', name: '4.00', optionValue: 219 },
  '4.50': { min: '4.50', max: '30.00', code: '450', name: '4.50', optionValue: 221 },
  '5.00': { min: '5.00', max: '30.00', code: '500', name: '5.00', optionValue: 223 },
  '5.50': { min: '5.50', max: '30.00', code: '550', name: '5.50', optionValue: 428 },
  '6.00': { min: '6.00', max: '30.00', code: '600', name: '6.00', optionValue: 430 },
  '6.50': { min: '6.50', max: '30.00', code: '650', name: '6.50', optionValue: 432 },
  '7.00': { min: '7.00', max: '30.00', code: '700', name: '7.00', optionValue: 434 },
  '7.50': { min: '7.50', max: '30.00', code: '750', name: '7.50', optionValue: 436 },
  '8.00': { min: '8.00', max: '30.00', code: '800', name: '8.00', optionValue: 438 },
  '8.50': { min: '8.50', max: '30.00', code: '850', name: '8.50', optionValue: 440 },
  '9.00': { min: '9.00', max: '30.00', code: '900', name: '9.00', optionValue: 442 },
  '9.50': { min: '9.50', max: '30.00', code: '950', name: '9.50', optionValue: 444 },
  '10.00': { min: '10.00', max: '30.00', code: '1000', name: '10.00', optionValue: 446 }
}

// Product ID from the website
const PRODUCT_ID = 14885

/**
 * Crawl diamond price for a specific configuration
 */
async function crawlDiamondPrices(productId, config) {
  const { stoneType, shape, carat, clarity, color, cutGrade, certificate } = config

  // Get option values
  const stoneTypeValue = STONE_TYPE_VALUES[stoneType] || 958  // 默认 LAB
  const shapeValue = SHAPE_VALUES[shape] || 126
  const clarityValue = CLARITY_VALUES[clarity] || 142
  const colorValue = COLOR_VALUES[color] || 152
  const cutValue = CUT_VALUES[cutGrade] || 170
  const certValue = CERTIFICATE_VALUES[certificate] || 161
  const caratConfig = CARAT_VALUES[carat] || CARAT_VALUES['0.20']

  // Build form data matching the actual API format
  const params = new URLSearchParams()

  // Basic options
  params.append('option[1]', '14')  // Metal - 14K White Gold
  params.append('option[3]', '76')  // Ring size placeholder
  params.append('option[6]', stoneTypeValue.toString()) // Stone type - LAB (958) or Natural (122)
  params.append('option[7]', shapeValue.toString())

  // Carat settings
  params.append('stone_carat_min', caratConfig.min)
  params.append('stone_carat_max', '30.00')
  params.append('min_carat_code', caratConfig.code)
  params.append('min_carat_name', caratConfig.name)
  params.append('ct_rng', '1')

  // Diamond properties
  params.append('option[8]', caratConfig.optionValue.toString())
  params.append('option[9]', clarityValue.toString())
  params.append('option[10]', colorValue.toString())
  params.append('option[11]', cutValue.toString() || '')
  params.append('option[12]', certValue.toString())

  // Price range
  params.append('stone_price_min', '100')
  params.append('stone_price_max', '5000000')

  // Empty optional fields
  params.append('colored_stone_type', '')
  params.append('option[13]', '')
  params.append('option[14]', '')
  params.append('option[15]', '')
  params.append('hidden_diamond_code', '')
  params.append('diamond_code', '')
  params.append('carat_weight', '')

  // Product info
  params.append('active_diamond_tab', stoneType)  // 'LAB' or 'DI'
  params.append('quantity', '1')
  params.append('product_id', PRODUCT_ID.toString())
  params.append('edit_product', '0')
  params.append('img_src', '')
  params.append('product_namer', 'Prong Setting Solitaire Engagement Ring')
  params.append('stone_ids', '')
  params.append('cart_rnnumber', '')
  params.append('text_image', 'catalog/view/theme/default/image/PD360_Arrow.png')
  params.append('tag_no', '')

  // Instock options
  params.append('instock_ring_size', '')
  params.append('instock_backing', '')
  params.append('instock_chain_type', '')
  params.append('instock_chain_length', '')
  params.append('instock_metal_purity', '')
  params.append('hidden_instock_price', '0')
  params.append('hidden_instock_option_id', '')
  params.append('isMobile', '0')
  params.append('shipping_message', 'Estimated Delivery 2-3 working weeks.')
  params.append('hidden_stone_size', '')
  params.append('ship_date', '')
  params.append('dispatch_date', '')
  params.append('instock', 'no')

  // Pricing placeholders (will be calculated by server)
  params.append('mpf', '0')
  params.append('spf', '0')
  params.append('amp', '0')
  params.append('asp', '0')
  params.append('assp', '')
  params.append('acp', '')
  params.append('cpf', '')
  params.append('chain_weight', '0.00')
  params.append('metal_wt', '0')
  params.append('total_markup', '0')
  params.append('chkdt', '')
  params.append('offer_discount', '0')
  params.append('offer_percantage_get', '25')
  params.append('th_march_insurance', '')
  params.append('sub_category', 'Solitaire')
  params.append('subcategoryid', '40')
  params.append('breadcrumb_url', 'https://www.diamondsfactory.com/engagement-rings/classic-solitaire')
  params.append('partner_id', '0')
  params.append('sets_products', '0')
  params.append('is_platinum', '0')
  params.append('top_category_id', '1')
  params.append('platinum_upgrade_json', '')
  params.append('bundle_total_weight', '')
  params.append('newimage', '0')
  params.append('vimeo_videos_json', '')
  params.append('product_videos_json', '')

  const url = 'https://www.diamondsfactory.com/index.php?route=product/product/add'
  const configKey = `${stoneType}/${shape}/${carat}/${clarity}/${color}/${cutGrade}/${certificate}`
  const body = params.toString()

  console.log(`[API Request] ${configKey}`)
  const startTime = Date.now()

  try {
    const page = await initBrowser()

    // 在浏览器上下文中用 fetch 发请求（使用 Chrome 真实 TLS 指纹 + 自动携带 Cookie）
    const result = await page.evaluate(async (fetchUrl, fetchBody) => {
      try {
        const res = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: fetchBody
        })
        const status = res.status
        if (status !== 200) {
          return { error: `HTTP ${status}`, status }
        }
        const text = await res.text()
        try {
          return { data: JSON.parse(text), status }
        } catch (e) {
          // 尝试从包含 HTML notice 的响应中提取 JSON
          const match = text.match(/\{[\s\S]*\}$/)
          if (match) {
            return { data: JSON.parse(match[0]), status }
          }
          return { error: 'Invalid JSON response', status, text: text.substring(0, 200) }
        }
      } catch (e) {
        return { error: e.message }
      }
    }, url, body)

    const duration = Date.now() - startTime

    if (result.error) {
      console.error(`[API Error] ${configKey} | Time: ${duration}ms | Error: ${result.error}`)
      return {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        sku: `clrn0709701-${stoneType}-${shape}-${carat}-${clarity}-${color}-${cutGrade}-${certificate}`,
        config: { stoneType, shape, carat, clarity, color, cutGrade, certificate },
        price: null,
        currency: 'USD',
        timestamp: new Date(),
        error: result.error
      }
    }

    console.log(`[API Response] ${configKey} | Status: ${result.status} | Time: ${duration}ms`)

    const data = result.data
    let price = null
    if (typeof data === 'object' && data !== null && typeof data.spf === 'number') {
      price = data.spf
    }

    return {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      sku: `clrn0709701-${stoneType}-${shape}-${carat}-${clarity}-${color}-${cutGrade}-${certificate}`,
      config: { stoneType, shape, carat, clarity, color, cutGrade, certificate },
      price: price,
      currency: 'USD',
      timestamp: new Date(),
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[API Error] ${configKey} | Time: ${duration}ms | Error: ${error.message}`)

    return {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      sku: `clrn0709701-${stoneType}-${shape}-${carat}-${clarity}-${color}-${cutGrade}-${certificate}`,
      config: { stoneType, shape, carat, clarity, color, cutGrade, certificate },
      price: null,
      currency: 'USD',
      timestamp: new Date(),
      error: error.message
    }
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 带重试的单个请求
 */
async function crawlWithRetry(productId, config, maxRetries = 3, baseDelay = 1000) {
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await crawlDiamondPrices(productId, config)

      // 如果没有错误，直接返回
      if (!result.error) {
        return result
      }

      // 如果是 403 错误，重新初始化浏览器（重新通过 Cloudflare challenge）
      if (result.error.includes('403')) {
        lastError = result.error
        if (attempt < maxRetries) {
          console.log(`[403 Error] Reinitializing browser to pass Cloudflare challenge...`)
          browserReady = false
          const delay = 2000
          console.log(`Retry ${attempt}/${maxRetries} for ${config.shape}/${config.carat}/${config.clarity} after browser reinit...`)
          await sleep(delay)
          continue
        }
      }

      // 如果是 502 或超时错误，重试
      if (result.error.includes('502') || result.error.includes('timeout')) {
        lastError = result.error
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) // 指数退避: 1s, 2s, 4s
          console.log(`Retry ${attempt}/${maxRetries} for ${config.shape}/${config.carat}/${config.clarity} after ${delay}ms...`)
          await sleep(delay)
          continue
        }
      }

      // 其他错误直接返回
      return result
    } catch (error) {
      lastError = error.message
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        await sleep(delay)
      }
    }
  }

  // 所有重试都失败
  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    sku: `clrn0709701-${config.stoneType}-${config.shape}-${config.carat}-${config.clarity}-${config.color}-${config.cutGrade}-${config.certificate}`,
    config,
    price: null,
    currency: 'GBP',
    timestamp: new Date(),
    error: `Failed after ${maxRetries} retries: ${lastError}`
  }
}

/**
 * Crawl all combinations of diamond configurations with smart rate limiting
 */
async function crawlAllCombinations(productId, options = {}) {
  const {
    stoneTypes = ['LAB'],  // 默认只爬取实验室钻石，可选 ['LAB', 'DI'] 爬取两种
    shapes = SHAPES,
    carats = CARATS,
    clarities = CLARITIES,
    colors = COLORS,
    cutGrades = CUT_GRADES,
    certificates = CERTIFICATES,
    concurrency = 15,      // 并发数
    delayMs = 300,         // 每批之间的基础延迟
    maxRetries = 3,        // 最大重试次数
    onProgress = null,     // 进度回调
    onResult = null,       // 单个结果回调
    completedResults = []  // 已完成的结果（用于断点续爬）
  } = options

  // 生成所有组合
  const combinations = []
  for (const stoneType of stoneTypes) {
    for (const shape of shapes) {
      for (const carat of carats) {
        for (const clarity of clarities) {
          for (const color of colors) {
            for (const cutGrade of cutGrades) {
              for (const certificate of certificates) {
                combinations.push({ stoneType, shape, carat, clarity, color, cutGrade, certificate })
              }
            }
          }
        }
      }
    }
  }

  // 如果有已完成的结果，过滤掉已爬取的组合（断点续爬）
  let pendingCombinations = combinations
  if (completedResults && completedResults.length > 0) {
    const completedSKUs = new Set(completedResults.map(r => r.sku))
    pendingCombinations = combinations.filter(config => {
      const sku = `clrn0709701-${config.stoneType}-${config.shape}-${config.carat}-${config.clarity}-${config.color}-${config.cutGrade}-${config.certificate}`
      return !completedSKUs.has(sku)
    })
    console.log(`Resuming from checkpoint: ${completedResults.length} already completed, ${pendingCombinations.length} remaining`)
  }

  const total = combinations.length
  const alreadyCompleted = completedResults.length
  console.log(`Starting crawl of ${total} combinations (already done: ${alreadyCompleted}, remaining: ${pendingCombinations.length}, concurrency: ${concurrency}, delay: ${delayMs}ms)...`)

  const results = [...completedResults]  // 只保存成功的结果
  const failedQueue = []  // 失败队列，最后重试
  let completed = alreadyCompleted
  let consecutiveErrors = 0
  let consecutive403Errors = 0
  let currentDelay = delayMs
  let isPaused = false

  // 分批处理（只处理待完成的组合）
  for (let i = 0; i < pendingCombinations.length; i += concurrency) {
    // 检查是否因为 403 暂停
    if (isPaused) {
      console.log('[Crawler] 连续 403，重新初始化浏览器...')
      browserReady = false
      await sleep(5000)
      try { await initBrowser() } catch (e) { console.error('[Crawler] Browser reinit failed:', e.message) }
      isPaused = false
      consecutive403Errors = 0
      console.log('[Crawler] 浏览器重新初始化完成，继续爬取...')
    }

    const batch = pendingCombinations.slice(i, i + concurrency)

    // 并发执行这一批（带重试）
    const batchResults = await Promise.all(
      batch.map(config => crawlWithRetry(productId, config, maxRetries))
    )

    // 分离成功和失败的结果
    for (const result of batchResults) {
      if (result.error) {
        // 失败的放入重试队列
        failedQueue.push(result.config)

        // 检查是否是 403 错误
        if (result.error.includes('403')) {
          consecutive403Errors++
          // 连续 3 次 403 错误，暂停任务
          if (consecutive403Errors >= 3) {
            console.log('[Crawler] 连续 403 错误，Cookie 可能已失效，暂停任务...')
            isPaused = true
          }
        }
      } else {
        // 成功的添加到结果
        results.push(result)
        consecutive403Errors = 0  // 重置 403 计数

        // 触发单个结果回调
        if (onResult) {
          onResult(result)
        }
      }
    }

    completed += batch.length

    // 检查这一批是否有错误
    const errorCount = batchResults.filter(r => r.error).length
    if (errorCount > 0) {
      consecutiveErrors++
      // 连续错误时增加延迟（自适应限流）
      if (consecutiveErrors >= 3) {
        currentDelay = Math.min(currentDelay * 1.5, 5000) // 最大5秒
        console.log(`Rate limiting detected, increasing delay to ${currentDelay}ms`)
      }
    } else {
      consecutiveErrors = 0
      // 没有错误时逐渐恢复正常延迟
      currentDelay = Math.max(currentDelay * 0.9, delayMs)
    }

    // 计算成功率（基于已完成的）
    const successRate = completed > 0 ? Math.round(results.length / completed * 100) : 0

    console.log(`Progress: ${completed}/${total} (${Math.round(completed/total*100)}%) | Success: ${results.length} | Failed: ${failedQueue.length} | Rate: ${successRate}%`)

    if (onProgress) {
      onProgress(completed, total, successRate)
    }

    // 批次之间添加延迟
    if (i + concurrency < pendingCombinations.length) {
      await sleep(currentDelay)
    }
  }

  // === 最后统一重试失败的 ===
  if (failedQueue.length > 0) {
    console.log(`\n[Retry] 开始重试 ${failedQueue.length} 个失败项...`)

    // 降低并发，增加延迟，重试一次
    const retryBatchSize = Math.max(2, Math.floor(concurrency / 3))
    const retryDelay = delayMs * 2

    for (let i = 0; i < failedQueue.length; i += retryBatchSize) {
      const batch = failedQueue.slice(i, i + retryBatchSize)

      const retryResults = await Promise.all(
        batch.map(config => crawlWithRetry(productId, config, 2))  // 最多重试 2 次
      )

      // 只添加成功的结果
      for (const result of retryResults) {
        if (!result.error) {
          results.push(result)
          if (onResult) {
            onResult(result)
          }
        }
      }

      const retrySuccess = retryResults.filter(r => !r.error).length
      console.log(`[Retry] ${i + batch.length}/${failedQueue.length} | Success: ${retrySuccess}/${batch.length}`)

      if (i + retryBatchSize < failedQueue.length) {
        await sleep(retryDelay)
      }
    }
  }

  const finalFailCount = total - results.length
  console.log(`\nCrawl complete: ${results.length}/${total} successful (${Math.round(results.length/total*100)}%)`)
  if (finalFailCount > 0) {
    console.log(`[Warning] ${finalFailCount} items failed and were not included in results`)
  }

  return results
}

/**
 * Crawl a subset of combinations (for testing)
 */
async function crawlSubset(productId, subsetOptions = {}) {
  const {
    stoneTypes = ['LAB'],
    shapes = ['RND'],
    carats = ['0.20'],
    clarities = ['FL'],
    colors = ['D'],
    cutGrades = ['EX'],
    certificates = ['DF'],
    concurrency = 4,
    delayMs = 500
  } = subsetOptions

  return crawlAllCombinations(productId, {
    stoneTypes,
    shapes,
    carats,
    clarities,
    colors,
    cutGrades,
    certificates,
    concurrency,
    delayMs
  })
}

module.exports = {
  crawlDiamondPrices,
  crawlAllCombinations,
  crawlSubset,
  initBrowser,
  closeBrowser,
  getBrowserStatus,
  STONE_TYPES,
  SHAPES,
  CARATS,
  CLARITIES,
  COLORS,
  CUT_GRADES,
  CERTIFICATES,
  PRODUCT_ID
}
