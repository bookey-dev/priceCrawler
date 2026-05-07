/**
 * 价格对比 API 路由
 */
const express = require('express')
const router = express.Router()
const db = require('../db.cjs')

// 获取对比数据（按品级分组，跨品牌对比）
router.get('/comparison', (req, res) => {
  try {
    const filters = {}
    if (req.query.stoneType) filters.stoneType = req.query.stoneType
    if (req.query.shape) filters.shape = req.query.shape
    if (req.query.caratBucket) filters.caratBucket = req.query.caratBucket
    if (req.query.color) filters.color = req.query.color
    if (req.query.clarity) filters.clarity = req.query.clarity
    if (req.query.cut) filters.cut = req.query.cut
    if (req.query.date) filters.date = req.query.date

    const data = db.getComparisonData(filters)

    // 转换为矩阵格式: { gradeKey -> { brand -> priceData } }
    const matrix = {}
    for (const row of data) {
      const key = `${row.stone_type}|${row.shape}|${row.carat_bucket}|${row.color}|${row.clarity}|${row.cut}`
      if (!matrix[key]) {
        matrix[key] = {
          stoneType: row.stone_type,
          shape: row.shape,
          caratBucket: row.carat_bucket,
          color: row.color,
          clarity: row.clarity,
          cut: row.cut,
          snapshotDate: row.snapshot_date,
          brands: {}
        }
      }
      matrix[key].brands[row.brand] = {
        avgPrice: row.avg_price,
        minPrice: row.min_price,
        maxPrice: row.max_price,
        count: row.diamond_count
      }
    }

    res.json(Object.values(matrix))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST 批量对比（支持更复杂的过滤条件）
router.post('/comparison/matrix', (req, res) => {
  try {
    const { stoneType, shape, caratBuckets, colors, clarities, cuts, date } = req.body
    const results = []

    const buckets = caratBuckets || ['1.00-1.49']
    const colorList = colors || ['D', 'E', 'F', 'G']
    const clarityList = clarities || ['VVS1', 'VVS2', 'VS1', 'VS2']
    const cutList = cuts || ['EXCELLENT']

    for (const bucket of buckets) {
      for (const color of colorList) {
        for (const clarity of clarityList) {
          for (const cut of cutList) {
            const filters = {
              stoneType: stoneType || 'LAB',
              shape: shape || 'ROUND',
              caratBucket: bucket,
              color, clarity, cut
            }
            if (date) filters.date = date

            const data = db.getComparisonData(filters)
            if (data.length > 0) {
              const brands = {}
              for (const row of data) {
                brands[row.brand] = {
                  avgPrice: row.avg_price,
                  minPrice: row.min_price,
                  maxPrice: row.max_price,
                  count: row.diamond_count
                }
              }
              results.push({ ...filters, brands })
            }
          }
        }
      }
    }

    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
