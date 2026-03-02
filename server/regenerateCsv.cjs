/**
 * 从已修复的 JSON 文件重新生成 CSV 文件
 */

const fs = require('fs');
const path = require('path');

const EXPORT_DIR = path.join(__dirname, '..', 'exports');

function jsonToCsv(data) {
  if (!data || data.length === 0) return '';

  // CSV 头部
  const headers = ['origin', 'shape', 'carat', 'clarity', 'color', 'cut', 'certificate', 'price', 'error'];

  // 生成 CSV 行
  const rows = data.map(item => {
    const config = item.config || {};
    return [
      `"${config.origin || ''}"`,
      `"${config.shape || ''}"`,
      `"${config.carat || ''}"`,
      `"${config.clarity || ''}"`,
      `"${config.color || ''}"`,
      `"${config.cut || ''}"`,
      `"${config.certificate || ''}"`,
      `"${item.price !== null ? item.price : ''}"`,
      `"${item.error || ''}"`
    ].join(',');
  });

  return [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
}

async function regenerateCsv() {
  console.log('============================================================');
  console.log('从 JSON 文件重新生成 CSV 文件');
  console.log('============================================================');

  // 获取所有 JSON 文件
  const files = fs.readdirSync(EXPORT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`找到 ${files.length} 个 JSON 文件\n`);

  let totalUpdated = 0;

  for (const jsonFile of files) {
    const jsonPath = path.join(EXPORT_DIR, jsonFile);
    const csvFile = jsonFile.replace('.json', '.csv');
    const csvPath = path.join(EXPORT_DIR, csvFile);

    try {
      // 读取 JSON 数据
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

      // 生成 CSV
      const csvContent = jsonToCsv(data);

      // 写入 CSV 文件
      fs.writeFileSync(csvPath, csvContent);

      // 统计有多少有价格的项目
      const priceCount = data.filter(item => item.price !== null).length;
      console.log(`[✓] ${csvFile} - ${priceCount}/${data.length} 有价格`);
      totalUpdated++;

    } catch (error) {
      console.error(`[✗] ${jsonFile} - 错误: ${error.message}`);
    }
  }

  console.log('\n============================================================');
  console.log(`完成！已更新 ${totalUpdated} 个 CSV 文件`);
  console.log('============================================================');
}

regenerateCsv();
