import fs from 'fs';
import path from 'path';

// 配置
const TASKS_DIR = './tasks';
const EXPORT_DIR = './exports';

/**
 * 确保目录存在
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 导出数据为 CSV 格式
 */
function exportToCSV(prices, filename) {
  const headers = ['Stone Type', 'Shape', 'Carat', 'Clarity', 'Color', 'Cut Grade', 'Certificate', 'Price (GBP)', 'Error'];
  const rows = prices.map(item => [
    item.config.stoneType || 'LAB',
    item.config.shape,
    item.config.carat,
    item.config.clarity,
    item.config.color,
    item.config.cutGrade,
    item.config.certificate,
    item.price || '',
    item.error || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const filepath = path.join(EXPORT_DIR, filename);
  fs.writeFileSync(filepath, csvContent, 'utf-8');
  console.log(`Exported CSV: ${filepath}`);
  return filepath;
}

/**
 * 导出数据为 JSON 格式
 */
function exportToJSON(prices, filename) {
  const filepath = path.join(EXPORT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(prices, null, 2), 'utf-8');
  console.log(`Exported JSON: ${filepath}`);
  return filepath;
}

/**
 * 从任务文件生成导出文件
 */
function generateExportsFromTask(taskFile) {
  console.log(`Processing task file: ${taskFile}`);
  
  // 读取任务文件
  const taskContent = fs.readFileSync(taskFile, 'utf-8');
  const task = JSON.parse(taskContent);
  
  if (!task.results || !Array.isArray(task.results) || task.results.length === 0) {
    console.log(`No results found in ${taskFile}, skipping...`);
    return 0;
  }
  
  // 从任务选项中获取carat值
  const carat = task.options?.carats?.[0] || 'unknown';
  
  // 生成与原导出文件相同格式的文件名
  // 原格式: diamond-prices-2026-01-22-15-00-37-carat-0.20.csv
  
  // 使用任务的completedAt时间戳，格式化为YYYY-MM-DD-HH-mm-ss
  const completedDate = new Date(task.completedAt);
  const year = completedDate.getFullYear();
  const month = String(completedDate.getMonth() + 1).padStart(2, '0');
  const day = String(completedDate.getDate()).padStart(2, '0');
  const hours = String(completedDate.getHours()).padStart(2, '0');
  const minutes = String(completedDate.getMinutes()).padStart(2, '0');
  const seconds = String(completedDate.getSeconds()).padStart(2, '0');
  const timestamp = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
  
  const baseFilename = `diamond-prices-${timestamp}-carat-${carat}`;
  
  // 导出为CSV和JSON
  const csvFile = exportToCSV(task.results, `${baseFilename}.csv`);
  const jsonFile = exportToJSON(task.results, `${baseFilename}.json`);
  
  return 1;
}

/**
 * 主函数
 */
function main() {
  console.log('Starting to regenerate export files from task files...');
  
  // 确保导出目录存在
  ensureDirExists(EXPORT_DIR);
  
  // 获取所有任务文件
  const taskFiles = fs.readdirSync(TASKS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(TASKS_DIR, file));
  
  console.log(`Found ${taskFiles.length} task files`);
  
  let totalGenerated = 0;
  let totalProcessed = 0;
  
  for (const taskFile of taskFiles) {
    try {
      const generated = generateExportsFromTask(taskFile);
      totalGenerated += generated;
      totalProcessed++;
    } catch (error) {
      console.error(`Error processing ${taskFile}: ${error.message}`);
      console.error(error.stack);
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Processed ${totalProcessed}/${taskFiles.length} task files`);
  console.log(`Generated ${totalGenerated * 2} export files (${totalGenerated} CSV + ${totalGenerated} JSON)`);
  console.log('All tasks completed!');
}

// 执行主函数
main();
