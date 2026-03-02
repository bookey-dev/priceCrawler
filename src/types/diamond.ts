export interface DiamondConfig {
  stoneType: string
  shape: string
  carat: string
  clarity: string
  color: string
  certificate: string
  cutGrade: string
}

export interface DiamondPrice {
  id: string
  sku: string
  config: DiamondConfig
  price: number | null
  currency: string
  timestamp: Date
  error?: string
  rawResponse?: any
}

export interface CrawlResult {
  id: string
  crawledAt: Date
  totalItems: number
  prices: DiamondPrice[]
}

export interface CrawlSettings {
  intervalMinutes: number
  isRunning: boolean
  baseUrl: string
  productId: string
}

// Available options for the diamond configurator
export const DIAMOND_OPTIONS = {
  stoneTypes: [
    { value: 'LAB', label: 'Lab-Created Diamond' },
    { value: 'DI', label: 'Natural Diamond' }
  ],
  shapes: [
    { value: 'RND', label: 'Round' },
    { value: 'PRN', label: 'Princess' },
    { value: 'EMR', label: 'Emerald' },
    { value: 'MQS', label: 'Marquise' },
    { value: 'OVL', label: 'Oval' },
    { value: 'RAD', label: 'Radiant' },
    { value: 'PER', label: 'Pear' },
    { value: 'HRT', label: 'Heart' },
    { value: 'CUS', label: 'Cushion' },
    { value: 'ASC', label: 'Asscher' }
  ],
  carats: [
    '0.20', '0.30', '0.40', '0.50', '0.60', '0.70', '0.80', '0.90', '1.00',
    '1.20', '1.50', '1.70', '2.00', '2.50', '3.00',
    '3.50', '4.00', '4.50', '5.00', '5.50', '6.00', '6.50', '7.00', '7.50',
    '8.00', '8.50', '9.00', '9.50', '10.00'
  ],
  clarities: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1'],
  colors: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
  certificates: [
    { value: 'DF', label: 'DF' },
    { value: 'EGL', label: 'EGL/SGL' },
    { value: 'IGI', label: 'IGI/HRD' },
    { value: 'GIA', label: 'GIA' }
  ],
  cutGrades: [
    { value: 'EX', label: 'Excellent' },
    { value: 'VG', label: 'Very Good' },
    { value: 'GD', label: 'Good' },
    { value: 'FR', label: 'Fair' }
  ]
}
