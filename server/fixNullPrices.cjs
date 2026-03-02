/**
 * 修复 exports 中 price 为 null 的数据
 * 重新请求并更新文件
 */
const fs = require('fs')
const path = require('path')
const { crawlDiamondPrices, PRODUCT_ID } = require('./crawler.cjs')
const cookieManager = require('./cookieManager.cjs')

const EXPORT_DIR = path.join(__dirname, '../exports')

// 延迟函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fixNullPrices() {
  console.log('='.repeat(60))
  console.log('修复 exports 中 price 为 null 的数据')
  console.log('='.repeat(60))

  // 初始化 Cookie Manager
  await cookieManager.initialize()

  // 获取所有 JSON 文件
  const files = fs.readdirSync(EXPORT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()

  console.log(`\n找到 ${files.length} 个 JSON 文件\n`)

  let totalNullCount = 0
  let totalFixedCount = 0
  let totalFailedCount = 0

  for (const file of files) {
    const filePath = path.join(EXPORT_DIR, file)
    let data

    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (e) {
      console.log(`[Error] 无法读取文件: ${file}`)
      continue
    }

    // 找出 price 为 null 的项目
    const nullItems = data.filter(item => item.price === null)

    if (nullItems.length === 0) {
      continue
    }

    console.log(`\n[${file}] 发现 ${nullItems.length} 个 null 价格项目`)
    totalNullCount += nullItems.length

    // 重新请求每个 null 项目
    let fixedCount = 0
    let failedCount = 0

    for (let i = 0; i < nullItems.length; i++) {
      const item = nullItems[i]
      const config = item.config

      console.log(`  [${i + 1}/${nullItems.length}] 重新请求: ${config.stoneType}/${config.shape}/${config.carat}/${config.clarity}/${config.color}/${config.cutGrade}/${config.certificate}`)

      try {
        const result = await crawlDiamondPrices(PRODUCT_ID, config)

        if (result.price !== null && !result.error) {
          // 更新数据
          const idx = data.findIndex(d => d.sku === item.sku)
          if (idx !== -1) {
            data[idx] = result
            fixedCount++
            console.log(`    ✓ 获取成功: ${result.price} GBP`)
          }
        } else {
          failedCount++
          console.log(`    ✗ 仍然失败: ${result.error || 'null price'}`)
        }
      } catch (error) {
        failedCount++
        console.log(`    ✗ 请求错误: ${error.message}`)
      }

      // 请求间隔
      if (i < nullItems.length - 1) {
        await sleep(500)
      }
    }

    totalFixedCount += fixedCount
    totalFailedCount += failedCount

    // 保存更新后的文件
    if (fixedCount > 0) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
      console.log(`  [Saved] ${file} - 修复 ${fixedCount} 项`)
    }

    console.log(`  结果: 修复 ${fixedCount}/${nullItems.length}, 仍失败 ${failedCount}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('修复完成！')
  console.log(`总共发现 ${totalNullCount} 个 null 价格`)
  console.log(`成功修复 ${totalFixedCount} 个`)
  console.log(`仍然失败 ${totalFailedCount} 个`)
  console.log('='.repeat(60))
}

// 运行
fixNullPrices().catch(console.error)
