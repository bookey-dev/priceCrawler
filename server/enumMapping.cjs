/**
 * 钻石属性枚举映射
 * 将爬取数据中的代码值映射到枚举值/友好名称
 */

// 钻石来源/类型
const StoneType = {
  LAB: 'LAB_GROWN',      // 实验室培育钻石
  DI: 'NATURAL'          // 天然钻石
}

const StoneTypeLabel = {
  LAB: 'Lab-Grown Diamond',
  DI: 'Natural Diamond'
}

// 形状
const Shape = {
  RND: 'ROUND',          // 圆形
  PRN: 'PRINCESS',       // 公主方形
  EMR: 'EMERALD',        // 祖母绿形
  MQS: 'MARQUISE',       // 马眼形/榄尖形
  OVL: 'OVAL',           // 椭圆形
  RAD: 'RADIANT',        // 雷地恩形
  PER: 'PEAR',           // 梨形/水滴形
  HRT: 'HEART',          // 心形
  CUS: 'CUSHION',        // 垫形
  ASC: 'ASSCHER'         // 阿斯切形
}

const ShapeLabel = {
  RND: 'Round',
  PRN: 'Princess',
  EMR: 'Emerald',
  MQS: 'Marquise',
  OVL: 'Oval',
  RAD: 'Radiant',
  PER: 'Pear',
  HRT: 'Heart',
  CUS: 'Cushion',
  ASC: 'Asscher'
}

// 净度 (从高到低)
const Clarity = {
  FL: 'FL',              // Flawless 无瑕
  IF: 'IF',              // Internally Flawless 内部无瑕
  VVS1: 'VVS1',          // Very Very Slightly Included 1 极轻微内含物1
  VVS2: 'VVS2',          // Very Very Slightly Included 2 极轻微内含物2
  VS1: 'VS1',            // Very Slightly Included 1 轻微内含物1
  VS2: 'VS2',            // Very Slightly Included 2 轻微内含物2
  SI1: 'SI1',            // Slightly Included 1 微内含物1
  SI2: 'SI2',            // Slightly Included 2 微内含物2
  I1: 'I1'               // Included 1 内含物1
}

const ClarityLabel = {
  FL: 'Flawless',
  IF: 'Internally Flawless',
  VVS1: 'Very Very Slightly Included 1',
  VVS2: 'Very Very Slightly Included 2',
  VS1: 'Very Slightly Included 1',
  VS2: 'Very Slightly Included 2',
  SI1: 'Slightly Included 1',
  SI2: 'Slightly Included 2',
  I1: 'Included 1'
}

// 颜色 (从高到低: D最白, L偏黄)
const Color = {
  D: 'D',                // 无色
  E: 'E',                // 无色
  F: 'F',                // 无色
  G: 'G',                // 近无色
  H: 'H',                // 近无色
  I: 'I',                // 近无色
  J: 'J',                // 近无色
  K: 'K',                // 微黄
  L: 'L'                 // 微黄
}

const ColorLabel = {
  D: 'D (Colorless)',
  E: 'E (Colorless)',
  F: 'F (Colorless)',
  G: 'G (Near Colorless)',
  H: 'H (Near Colorless)',
  I: 'I (Near Colorless)',
  J: 'J (Near Colorless)',
  K: 'K (Faint Yellow)',
  L: 'L (Faint Yellow)'
}

// 切工等级 (从高到低)
const CutGrade = {
  EX: 'EXCELLENT',       // 极优
  VG: 'VERY_GOOD',       // 很好
  GD: 'GOOD',            // 好
  FR: 'FAIR'             // 一般
}

const CutGradeLabel = {
  EX: 'Excellent',
  VG: 'Very Good',
  GD: 'Good',
  FR: 'Fair'
}

// 证书
const Certificate = {
  DF: 'DF',              // Diamond Factory (内部)
  EGL: 'EGL',            // European Gemological Laboratory
  IGI: 'IGI',            // International Gemological Institute
  GIA: 'GIA'             // Gemological Institute of America (最权威)
}

const CertificateLabel = {
  DF: 'DF (Diamond Factory)',
  EGL: 'EGL (European Gemological Laboratory)',
  IGI: 'IGI (International Gemological Institute)',
  GIA: 'GIA (Gemological Institute of America)'
}

// 克拉数 (保持原值，仅做列表)
const Carats = [
  '0.20', '0.30', '0.40', '0.50', '0.60', '0.70', '0.80', '0.90', '1.00',
  '1.20', '1.50', '1.70', '2.00', '2.50', '3.00',
  '3.50', '4.00', '4.50', '5.00', '5.50', '6.00', '6.50', '7.00', '7.50',
  '8.00', '8.50', '9.00', '9.50', '10.00'
]

/**
 * 转换单个钻石配置到枚举格式
 */
function mapConfigToEnum(config) {
  return {
    stoneType: StoneType[config.stoneType] || config.stoneType,
    shape: Shape[config.shape] || config.shape,
    carat: parseFloat(config.carat),
    clarity: Clarity[config.clarity] || config.clarity,
    color: Color[config.color] || config.color,
    cutGrade: CutGrade[config.cutGrade] || config.cutGrade,
    certificate: Certificate[config.certificate] || config.certificate
  }
}

/**
 * 转换单个钻石配置到友好名称格式
 */
function mapConfigToLabel(config) {
  return {
    stoneType: StoneTypeLabel[config.stoneType] || config.stoneType,
    shape: ShapeLabel[config.shape] || config.shape,
    carat: `${config.carat} ct`,
    clarity: ClarityLabel[config.clarity] || config.clarity,
    color: ColorLabel[config.color] || config.color,
    cutGrade: CutGradeLabel[config.cutGrade] || config.cutGrade,
    certificate: CertificateLabel[config.certificate] || config.certificate
  }
}

/**
 * 转换完整的数据项
 */
function mapItemToEnum(item) {
  return {
    ...item,
    config: mapConfigToEnum(item.config)
  }
}

/**
 * 转换整个数据数组
 */
function mapDataToEnum(data) {
  return data.map(mapItemToEnum)
}

/**
 * 获取所有枚举定义（用于 API 返回）
 */
function getAllEnums() {
  return {
    stoneType: {
      values: StoneType,
      labels: StoneTypeLabel
    },
    shape: {
      values: Shape,
      labels: ShapeLabel
    },
    clarity: {
      values: Clarity,
      labels: ClarityLabel
    },
    color: {
      values: Color,
      labels: ColorLabel
    },
    cutGrade: {
      values: CutGrade,
      labels: CutGradeLabel
    },
    certificate: {
      values: Certificate,
      labels: CertificateLabel
    },
    carats: Carats
  }
}

/**
 * 反向映射：从枚举值到代码
 */
const StoneTypeReverse = Object.fromEntries(Object.entries(StoneType).map(([k, v]) => [v, k]))
const ShapeReverse = Object.fromEntries(Object.entries(Shape).map(([k, v]) => [v, k]))
const CutGradeReverse = Object.fromEntries(Object.entries(CutGrade).map(([k, v]) => [v, k]))

function mapEnumToCode(enumConfig) {
  return {
    stoneType: StoneTypeReverse[enumConfig.stoneType] || enumConfig.stoneType,
    shape: ShapeReverse[enumConfig.shape] || enumConfig.shape,
    carat: String(enumConfig.carat),
    clarity: enumConfig.clarity,  // 净度和颜色代码相同
    color: enumConfig.color,
    cutGrade: CutGradeReverse[enumConfig.cutGrade] || enumConfig.cutGrade,
    certificate: enumConfig.certificate
  }
}

module.exports = {
  // 枚举值
  StoneType,
  Shape,
  Clarity,
  Color,
  CutGrade,
  Certificate,
  Carats,

  // 友好名称
  StoneTypeLabel,
  ShapeLabel,
  ClarityLabel,
  ColorLabel,
  CutGradeLabel,
  CertificateLabel,

  // 转换函数
  mapConfigToEnum,
  mapConfigToLabel,
  mapItemToEnum,
  mapDataToEnum,
  mapEnumToCode,
  getAllEnums
}
