import axios from 'axios'
import type { Brand, ComparisonRow, TrendPoint, BrandTrendPoint, CrawlSession } from '@/types/diamond'

const api = axios.create({
  baseURL: '/api',
  timeout: 3600000  // 1小时，全量爬取需要很长时间
})

export async function getBrands(): Promise<Brand[]> {
  const response = await api.get('/brands')
  return response.data
}

export async function triggerBrandCrawl(brandId: string, filters: any = {}): Promise<{ sessionId: number; brand: string; status: string }> {
  const response = await api.post(`/brands/${brandId}/crawl`, filters)
  return response.data
}

export async function getBrandSessions(brandId: string): Promise<CrawlSession[]> {
  const response = await api.get(`/brands/${brandId}/sessions`)
  return response.data
}

export async function getBrandSessionById(brandId: string, sessionId: number): Promise<CrawlSession> {
  const response = await api.get(`/brands/${brandId}/sessions/${sessionId}`)
  return response.data
}

export async function getBrandStatus(brandId: string): Promise<Brand> {
  const response = await api.get(`/brands/${brandId}/status`)
  return response.data
}

export async function getBrandLatest(brandId: string, params: any = {}): Promise<any[]> {
  const response = await api.get(`/brands/${brandId}/latest`, { params })
  return response.data
}

export async function getComparison(params: {
  stoneType?: string; shape?: string; caratBucket?: string;
  color?: string; clarity?: string; cut?: string; date?: string
}): Promise<ComparisonRow[]> {
  const response = await api.get('/comparison', { params })
  return response.data
}

export async function getComparisonMatrix(body: {
  stoneType?: string; shape?: string; caratBuckets?: string[];
  colors?: string[]; clarities?: string[]; cuts?: string[]
}): Promise<ComparisonRow[]> {
  const response = await api.post('/comparison/matrix', body)
  return response.data
}

export async function getAverageTrends(params: {
  stoneType?: string; shape?: string; caratBucket?: string;
  color?: string; clarity?: string; cut?: string; period?: string
}): Promise<TrendPoint[]> {
  const response = await api.get('/trends/average', { params })
  return response.data
}

export async function getBrandTrend(params: {
  brand?: string; stoneType?: string; shape?: string; caratBucket?: string;
  color?: string; clarity?: string; cut?: string; period?: string
}): Promise<BrandTrendPoint[]> {
  const response = await api.get('/trends/brand', { params })
  return response.data
}
