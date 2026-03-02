import fs from 'fs';
import path from 'path';

// 配置
const TASKS_DIR = './tasks';

/**
 * 读取所有任务文件
 */
function getAllTaskFiles() {
  return fs.readdirSync(TASKS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(TASKS_DIR, file));
}

/**
 * 移除单个任务文件中的 "error": null 字段
 */
function removeNullErrorsFromFile(filePath) {
  console.log(`Processing file: ${filePath}`);
  
  // 读取文件内容
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const task = JSON.parse(fileContent);
  
  // 统计移除的字段数量
  let removedCount = 0;
  
  // 检查任务对象本身是否有 error: null 字段
  if (task.error === null) {
    delete task.error;
    removedCount++;
  }
  
  // 遍历所有结果条目
  if (task.results && Array.isArray(task.results)) {
    for (const item of task.results) {
      // 如果 error 字段存在且为 null，则移除
      if (item.error === null) {
        delete item.error;
        removedCount++;
      }
    }
  }
  
  if (removedCount === 0) {
    console.log(`No "error": null fields found in ${filePath}, skipping...`);
    return 0;
  }
  
  // 保存更新后的文件
  fs.writeFileSync(filePath, JSON.stringify(task, null, 2), 'utf-8');
  console.log(`Removed ${removedCount} "error": null fields from ${filePath}`);
  
  return removedCount;
}

/**
 * 主函数
 */
function main() {
  console.log('Starting to remove "error": null fields from task files...');
  
  const taskFiles = getAllTaskFiles();
  console.log(`Found ${taskFiles.length} task files`);
  
  let totalRemoved = 0;
  let totalProcessed = 0;
  
  for (const filePath of taskFiles) {
    try {
      const removed = removeNullErrorsFromFile(filePath);
      totalRemoved += removed;
      totalProcessed++;
    } catch (error) {
      console.error(`Error processing ${filePath}: ${error.message}`);
      console.error(error.stack);
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Processed ${totalProcessed}/${taskFiles.length} files`);
  console.log(`Removed ${totalRemoved} "error": null fields`);
  console.log('All tasks completed!');
}

// 执行主函数
main();
