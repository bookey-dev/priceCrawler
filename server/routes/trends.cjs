/**
 * 价格趋势 API 路由
 */
const express = require('express')
const router = express.Router()
const db = require('../db.cjs')

// 获取多品牌价格趋势（折线图数据）
router.get('/trends/average', (req, res) => {
  try {
    const filters = {}
    if (req.query.stoneType) filters.stoneType = req.query.stoneType
    if (req.query.shape) filters.shape = req.query.shape
    if (req.query.caratBucket) filters.caratBucket = req.query.caratBucket
    if (req.query.color) filters.color = req.query.color
    if (req.query.clarity) filters.clarity = req.query.clarity
    if (req.query.cut) filters.cut = req.query.cut
    if (req.query.period) filters.period = req.query.period

    const data = db.getTrendData(filters)

    // 转换为前端折线图格式: [{ date, BN: avgPrice, DF: avgPrice, ... }]
    const dateMap = {}
    for (const row of data) {
      if (!dateMap[row.snapshot_date]) {
        dateMap[row.snapshot_date] = { date: row.snapshot_date }
      }
      dateMap[row.snapshot_date][row.brand] = row.avg_price
    }

    res.json(Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取单品牌价格趋势详情
router.get('/trends/brand', (req, res) => {
  try {
    const filters = {}
    if (req.query.brand) filters.brand = req.query.brand
    if (req.query.stoneType) filters.stoneType = req.query.stoneType
    if (req.query.shape) filters.shape = req.query.shape
    if (req.query.caratBucket) filters.caratBucket = req.query.caratBucket
    if (req.query.color) filters.color = req.query.color
    if (req.query.clarity) filters.clarity = req.query.clarity
    if (req.query.cut) filters.cut = req.query.cut
    if (req.query.period) filters.period = req.query.period

    const data = db.getTrendData(filters)

    // 返回: [{ date, avgPrice, minPrice, maxPrice, count }]
    const results = data.map(row => ({
      date: row.snapshot_date,
      avgPrice: row.avg_price,
      minPrice: row.min_price,
      maxPrice: row.max_price,
      count: row.diamond_count
    }))

    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
