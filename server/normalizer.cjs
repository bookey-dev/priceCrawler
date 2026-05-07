/**
 * 数据标准化模块
 * 将各品牌返回的不同格式数据统一为 NormalizedDiamond
 */

// ========== Shape 标准化映射 ==========
const SHAPE_MAP = {
  // 通用
  'round': 'ROUND', 'rnd': 'ROUND', 'round-cut': 'ROUND',
  'princess': 'PRINCESS', 'prn': 'PRINCESS', 'princess-cut': 'PRINCESS',
  'emerald': 'EMERALD', 'emr': 'EMERALD', 'emerald-cut': 'EMERALD',
  'marquise': 'MARQUISE', 'mqs': 'MARQUISE', 'marquise-cut': 'MARQUISE',
  'oval': 'OVAL', 'ovl': 'OVAL', 'oval-cut': 'OVAL',
  'radiant': 'RADIANT', 'rad': 'RADIANT', 'radiant-cut': 'RADIANT',
  'pear': 'PEAR', 'per': 'PEAR', 'pear-cut': 'PEAR',
  'heart': 'HEART', 'hrt': 'HEART', 'heart-cut': 'HEART',
  'cushion': 'CUSHION', 'cus': 'CUSHION', 'cushion-cut': 'CUSHION',
  'cushion modified': 'CUSHION', 'elongated cushion': 'CUSHION',
  'asscher': 'ASSCHER', 'asc': 'ASSCHER', 'asscher-cut': 'ASSCHER',
  'hexagonal': 'OTHER', 'octagon': 'OTHER', 'old cuts': 'OTHER',
  'kites & shields': 'OTHER', 'triangulars': 'OTHER'
}

// ========== Cut 标准化映射 ==========
const CUT_MAP = {
  'excellent': 'EXCELLENT', 'ex': 'EXCELLENT', 'ideal': 'EXCELLENT',
  'super ideal': 'EXCELLENT', 'true hearts': 'EXCELLENT',
  "cupid's ideal": 'EXCELLENT', 'astor ideal': 'EXCELLENT',
  'very good': 'VERY_GOOD', 'vg': 'VERY_GOOD', 'very-good': 'VERY_GOOD',
  'good': 'GOOD', 'gd': 'GOOD',
  'fair': 'FAIR', 'fr': 'FAIR',
  'poor': 'POOR'
}

// ========== Clarity 标准化映射 ==========
const CLARITY_MAP = {
  'fl': 'FL', 'flawless': 'FL',
  'if': 'IF', 'internally flawless': 'IF',
  'vvs1': 'VVS1', 'vvs2': 'VVS2',
  'vs1': 'VS1', 'vs2': 'VS2',
  'si1': 'SI1', 'si2': 'SI2',
  'i1': 'I1', 'i2': 'I2'
}

// ========== Color 标准化映射 ==========
const COLOR_MAP = {
  'd': 'D', 'e': 'E', 'f': 'F', 'g': 'G', 'h': 'H',
  'i': 'I', 'j': 'J', 'k': 'K', 'l': 'L', 'm': 'M'
}

// ========== 克拉分桶 ==========
function getCaratBucket(carat) {
  const c = parseFloat(carat)
  if (c < 0.30) return '0.20-0.29'
  if (c < 0.50) return '0.30-0.49'
  if (c < 0.70) return '0.50-0.69'
  if (c < 1.00) return '0.70-0.99'
  if (c < 1.50) return '1.00-1.49'
  if (c < 2.00) return '1.50-1.99'
  if (c < 3.00) return '2.00-2.99'
  if (c < 5.00) return '3.00-4.99'
  return '5.00+'
}

// ========== 标准化函数 ==========

function normalizeShape(raw) {
  if (!raw) return 'UNKNOWN'
  return SHAPE_MAP[raw.toLowerCase().trim()] || raw.toUpperCase().trim()
}

function normalizeCut(raw) {
  if (!raw) return 'UNKNOWN'
  return CUT_MAP[raw.toLowerCase().trim()] || raw.toUpperCase().trim()
}

function normalizeClarity(raw) {
  if (!raw) return 'UNKNOWN'
  return CLARITY_MAP[raw.toLowerCase().trim()] || raw.toUpperCase().trim()
}

function normalizeColor(raw) {
  if (!raw) return 'UNKNOWN'
  // 处理 Taylor & Hart 格式: DIAMOND_D -> D
  const cleaned = raw.replace(/^DIAMOND_/i, '')
  return COLOR_MAP[cleaned.toLowerCase().trim()] || cleaned.toUpperCase().trim()
}

function normalizeStoneType(raw) {
  if (!raw) return 'LAB'
  const lower = raw.toLowerCase().trim()
  if (lower.includes('lab') || lower === 'lab' || lower === 'lab-grown' || lower === 'lab_grown_diamond') return 'LAB'
  if (lower.includes('natural') || lower === 'di' || lower === 'natural diamond') return 'NATURAL'
  return raw.toUpperCase()
}

function normalizeCertificate(raw) {
  if (!raw) return null
  const upper = raw.toUpperCase().trim()
  // 统一常见缩写
  if (upper === 'DF') return 'DF'
  if (upper === 'EGL' || upper === 'SGL' || upper === 'EGL/SGL') return 'EGL'
  if (upper === 'IGI' || upper === 'HRD' || upper === 'IGI/HRD') return 'IGI'
  if (upper === 'GIA') return 'GIA'
  if (upper === 'GCAL') return 'GCAL'
  if (upper === 'AGS') return 'AGS'
  return upper
}

/**
 * 生成品级分组 key
 */
function makeGradeKey(stoneType, shape, caratBucket, color, clarity, cut) {
  return `${stoneType}|${shape}|${caratBucket}|${color}|${clarity}|${cut}`
}

/**
 * 标准化单条钻石数据
 * @param {object} raw - 原始数据
 * @param {string} brand - 品牌ID
 * @returns {object} NormalizedDiamond
 */
function normalizeDiamond(raw, brand) {
  const stoneType = normalizeStoneType(raw.stoneType)
  const shape = normalizeShape(raw.shape)
  const carat = parseFloat(raw.carat)
  const color = normalizeColor(raw.color)
  const clarity = normalizeClarity(raw.clarity)
  const cut = normalizeCut(raw.cut)
  const certificate = normalizeCertificate(raw.certificate)
  const caratBucket = getCaratBucket(carat)
  const gradeKey = makeGradeKey(stoneType, shape, caratBucket, color, clarity, cut)

  return {
    brand,
    stoneType,
    shape,
    carat,
    color,
    clarity,
    cut,
    certificate,
    priceUSD: parseFloat(raw.priceUSD) || 0,
    priceOriginal: parseFloat(raw.priceOriginal) || parseFloat(raw.priceUSD) || 0,
    priceCurrency: raw.priceCurrency || 'USD',
    sourceId: raw.sourceId || null,
    caratBucket,
    gradeKey,
    crawledAt: raw.crawledAt || new Date().toISOString()
  }
}

// 所有标准化的 shape/cut/clarity/color 值（用于 UI 过滤器）
const STANDARD_SHAPES = ['ROUND', 'PRINCESS', 'EMERALD', 'MARQUISE', 'OVAL', 'RADIANT', 'PEAR', 'HEART', 'CUSHION', 'ASSCHER']
const STANDARD_CUTS = ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR']
const STANDARD_CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1']
const STANDARD_COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
const STANDARD_CARAT_BUCKETS = ['0.20-0.29', '0.30-0.49', '0.50-0.69', '0.70-0.99', '1.00-1.49', '1.50-1.99', '2.00-2.99', '3.00-4.99', '5.00+']

module.exports = {
  normalizeShape,
  normalizeCut,
  normalizeClarity,
  normalizeColor,
  normalizeStoneType,
  normalizeCertificate,
  getCaratBucket,
  makeGradeKey,
  normalizeDiamond,
  STANDARD_SHAPES,
  STANDARD_CUTS,
  STANDARD_CLARITIES,
  STANDARD_COLORS,
  STANDARD_CARAT_BUCKETS
}
