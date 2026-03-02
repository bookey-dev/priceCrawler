import axios from 'axios'
import type { CrawlResult, CrawlSettings, DiamondConfig, DiamondPrice } from '@/types/diamond'

const api = axios.create({
  baseURL: '/api',
  timeout: 3600000  // 1小时，全量爬取需要很长时间
})

export async function getSettings(): Promise<CrawlSettings> {
  const response = await api.get('/settings')
  return response.data
}

export async function updateSettings(settings: Partial<CrawlSettings>): Promise<CrawlSettings> {
  const response = await api.post('/settings', settings)
  return response.data
}

export async function getCrawlHistory(): Promise<CrawlResult[]> {
  const response = await api.get('/history')
  return response.data
}

export async function getLatestCrawl(): Promise<CrawlResult | null> {
  const response = await api.get('/latest')
  return response.data
}

export async function triggerCrawl(): Promise<CrawlResult> {
  const response = await api.post('/crawl')
  return response.data
}

export async function crawlSingle(config: DiamondConfig): Promise<DiamondPrice> {
  const response = await api.post('/crawl-single', config)
  return response.data
}

export async function startScheduler(): Promise<{ message: string; settings: CrawlSettings }> {
  const response = await api.post('/scheduler/start')
  return response.data
}

export async function stopScheduler(): Promise<{ message: string; settings: CrawlSettings }> {
  const response = await api.post('/scheduler/stop')
  return response.data
}
