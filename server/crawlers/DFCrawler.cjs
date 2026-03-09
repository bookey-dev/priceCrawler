/**
 * Diamonds Factory 爬虫
 * 配置器模型：POST 配置组合，返回单个价格
 */
const BaseCrawler = require('./BaseCrawler.cjs')
const browserPool = require('../browserPool.cjs')
const { normalizeDiamond } = require('../normalizer.cjs')

const TARGET_URL = 'https://www.diamondsfactory.com/design/prong-setting-solitaire-engagement-ring-clrn0709701'
const API_URL = 'https://www.diamondsfactory.com/index.php?route=product/product/add'
const PRODUCT_ID = 14885

// Option ID mappings
const STONE_TYPE_VALUES = { 'DI': 122, 'LAB': 958 }
const SHAPE_VALUES = { 'RND': 125, 'PRN': 126, 'EMR': 127, 'MQS': 128, 'OVL': 129, 'RAD': 130, 'PER': 131, 'HRT': 132, 'CUS': 133, 'ASC': 135 }
const CLARITY_VALUES = { 'FL': 139, 'IF': 140, 'VVS1': 141, 'VVS2': 142, 'VS1': 143, 'VS2': 144, 'SI1': 145, 'SI2': 146, 'I1': 147 }
const COLOR_VALUES = { 'D': 150, 'E': 151, 'F': 152, 'G': 153, 'H': 154, 'I': 155, 'J': 853, 'K': 854, 'L': 855 }
const CUT_VALUES = { 'EX': 156, 'VG': 157, 'GD': 158, 'FR': 230 }
const CERTIFICATE_VALUES = { 'DF': 161, 'EGL': 186, 'IGI': 185, 'GIA': 187 }
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

const SHAPES_LIST = ['RND', 'PRN', 'EMR', 'MQS', 'OVL', 'RAD', 'PER', 'HRT', 'CUS', 'ASC']
const CARATS_LIST = Object.keys(CARAT_VALUES)
const CLARITIES_LIST = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1']
const COLORS_LIST = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const CUT_GRADES_LIST = ['EX', 'VG', 'GD', 'FR']
const CERTIFICATES_LIST = ['DF', 'EGL', 'IGI', 'GIA']

class DFCrawler extends BaseCrawler {
  constructor() {
    super('DF', 'Diamonds Factory')
  }

  getCapabilities() {
    return {
      supportsLabGrown: true,
      supportsNatural: true,
      shapes: SHAPES_LIST,
      shapeLabels: { RND: 'Round', PRN: 'Princess', EMR: 'Emerald', MQS: 'Marquise', OVL: 'Oval', RAD: 'Radiant', PER: 'Pear', HRT: 'Heart', CUS: 'Cushion', ASC: 'Asscher' },
      caratRange: { min: 0.2, max: 10.0 },
      caratValues: CARATS_LIST,
      clarities: CLARITIES_LIST,
      colors: COLORS_LIST,
      cutGrades: CUT_GRADES_LIST,
      cutGradeLabels: { EX: 'Excellent', VG: 'Very Good', GD: 'Good', FR: 'Fair' },
      certificates: CERTIFICATES_LIST,
      requiresPuppeteer: true,
      crawlType: 'configurator'
    }
  }

  async initialize() {
    try {
      await browserPool.getPage('diamondsfactory.com', TARGET_URL)
      this._ready = true
    } catch (error) {
      console.error('[DF] Failed to initialize:', error.message)
      this._ready = false
    }
  }

  getStatus() {
    const poolStatus = browserPool.getStatus()
    return {
      ready: this._ready && poolStatus.ready,
      hasInstance: poolStatus.hasInstance,
      proxyUrl: poolStatus.proxyUrl
    }
  }

  async crawl(filters = {}, callbacks = {}) {
    const { onProgress, onResult } = callbacks
    const stoneCertPairs = filters.stoneCertPairs || [{ stoneType: 'LAB', certificate: 'IGI' }]
    const shapes = filters.shapes || SHAPES_LIST
    const carats = filters.carats || CARATS_LIST
    const colorClarityPairs = filters.colorClarityPairs || [{ clarity: 'VVS1', color: 'E' }, { clarity: 'VS1', color: 'G' }]
    const cutGrades = filters.cutGrades || CUT_GRADES_LIST
    const concurrency = filters.concurrency || 15

    // 生成所有组合
    const combinations = []
    for (const { stoneType: st, certificate: ce } of stoneCertPairs) {
      for (const sh of shapes) {
        for (const ca of carats) {
          for (const pair of colorClarityPairs) {
            for (const cu of cutGrades) {
              combinations.push({ stoneType: st, shape: sh, carat: ca, clarity: pair.clarity, color: pair.color, cutGrade: cu, certificate: ce })
            }
          }
        }
      }
    }

    const total = combinations.length
    const results = []
    let completed = 0

    for (let i = 0; i < combinations.length; i += concurrency) {
      const batch = combinations.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(config => this._crawlSingle(config))
      )

      for (const result of batchResults) {
        if (result) {
          results.push(result)
          if (onResult) onResult(result)
        }
      }

      completed += batch.length
      if (onProgress) {
        onProgress(completed, total, results.length, `batch ${Math.ceil(completed / concurrency)}/${Math.ceil(total / concurrency)}`)
      }

      if (i + concurrency < combinations.length) {
        await this.sleep(300)
      }
    }

    return results
  }

  async _crawlSingle(config) {
    const { stoneType, shape, carat, clarity, color, cutGrade, certificate } = config
    const caratConfig = CARAT_VALUES[carat] || CARAT_VALUES['0.20']

    const params = new URLSearchParams()
    params.append('option[1]', '14')
    params.append('option[3]', '76')
    params.append('option[6]', (STONE_TYPE_VALUES[stoneType] || 958).toString())
    params.append('option[7]', (SHAPE_VALUES[shape] || 126).toString())
    params.append('stone_carat_min', caratConfig.min)
    params.append('stone_carat_max', '30.00')
    params.append('min_carat_code', caratConfig.code)
    params.append('min_carat_name', caratConfig.name)
    params.append('ct_rng', '1')
    params.append('option[8]', caratConfig.optionValue.toString())
    params.append('option[9]', (CLARITY_VALUES[clarity] || 142).toString())
    params.append('option[10]', (COLOR_VALUES[color] || 152).toString())
    params.append('option[11]', (CUT_VALUES[cutGrade] || 156).toString())
    params.append('option[12]', (CERTIFICATE_VALUES[certificate] || 161).toString())
    params.append('stone_price_min', '100')
    params.append('stone_price_max', '5000000')
    params.append('colored_stone_type', '')
    params.append('option[13]', '')
    params.append('option[14]', '')
    params.append('option[15]', '')
    params.append('hidden_diamond_code', '')
    params.append('diamond_code', '')
    params.append('carat_weight', '')
    params.append('active_diamond_tab', stoneType)
    params.append('quantity', '1')
    params.append('product_id', PRODUCT_ID.toString())
    params.append('edit_product', '0')
    params.append('img_src', '')
    params.append('product_namer', 'Prong Setting Solitaire Engagement Ring')
    params.append('stone_ids', '')
    params.append('cart_rnnumber', '')
    params.append('text_image', 'catalog/view/theme/default/image/PD360_Arrow.png')
    params.append('tag_no', '')
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

    try {
      const page = await browserPool.getPage('diamondsfactory.com', TARGET_URL)
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
          if (res.status !== 200) return { error: `HTTP ${res.status}` }
          const text = await res.text()
          try {
            return { data: JSON.parse(text) }
          } catch (e) {
            const match = text.match(/\{[\s\S]*\}$/)
            if (match) return { data: JSON.parse(match[0]) }
            return { error: 'Invalid JSON' }
          }
        } catch (e) {
          return { error: e.message }
        }
      }, API_URL, params.toString())

      if (result.error) return null

      const price = (typeof result.data?.spf === 'number') ? result.data.spf : null
      if (price === null) return null

      // DF 的 shape code 映射到标准 shape name
      const shapeNameMap = { RND: 'Round', PRN: 'Princess', EMR: 'Emerald', MQS: 'Marquise', OVL: 'Oval', RAD: 'Radiant', PER: 'Pear', HRT: 'Heart', CUS: 'Cushion', ASC: 'Asscher' }

      return normalizeDiamond({
        stoneType: stoneType === 'LAB' ? 'lab' : 'natural',
        shape: shapeNameMap[shape] || shape,
        carat: carat,
        color: color,
        clarity: clarity,
        cut: cutGrade,
        certificate: certificate,
        priceUSD: price,
        priceCurrency: 'USD',
        sourceId: `DF-${stoneType}-${shape}-${carat}-${clarity}-${color}-${cutGrade}-${certificate}`
      }, 'DF')
    } catch (error) {
      console.error(`[DF] Error crawling ${shape}/${carat}/${clarity}/${color}:`, error.message)
      return null
    }
  }
}

module.exports = DFCrawler
