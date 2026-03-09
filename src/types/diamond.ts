export interface BrandCapabilities {
  supportsLabGrown: boolean
  supportsNatural: boolean
  shapes: string[]
  caratRange: { min: number; max: number }
  caratValues?: string[] | null
  clarities: string[]
  colors: string[]
  cutGrades: string[]
  shapeLabels?: Record<string, string>
  cutGradeLabels?: Record<string, string>
  certificates: string[]
  requiresPuppeteer: boolean
  crawlType: 'inventory' | 'configurator'
  beta?: boolean
}

export interface Brand {
  id: string
  name: string
  capabilities: BrandCapabilities
  status: { ready: boolean }
}

export interface NormalizedDiamond {
  brand: string
  stoneType: string
  shape: string
  carat: number
  color: string
  clarity: string
  cut: string
  certificate: string | null
  priceUSD: number
  sourceId?: string
  caratBucket: string
  gradeKey: string
  crawledAt: string
}

export interface PriceSnapshot {
  brand: string
  stoneType: string
  shape: string
  caratBucket: string
  color: string
  clarity: string
  cut: string
  avgPrice: number
  minPrice: number
  maxPrice: number
  diamondCount: number
  snapshotDate: string
}

export interface ComparisonRow {
  stoneType: string
  shape: string
  caratBucket: string
  color: string
  clarity: string
  cut: string
  snapshotDate: string
  brands: Record<string, { avgPrice: number; minPrice: number; maxPrice: number; count: number }>
}

export interface TrendPoint {
  date: string
  [brand: string]: number | string
}

export interface BrandTrendPoint {
  date: string
  avgPrice: number
  minPrice: number
  maxPrice: number
  count: number
}

export interface CrawlSession {
  id: number
  brand: string
  started_at: string
  completed_at: string | null
  status: string
  total_diamonds: number
  error: string | null
  progress_completed?: number
  progress_total?: number
  progress_success?: number
  progress_detail?: string
  filters_json?: string
}

