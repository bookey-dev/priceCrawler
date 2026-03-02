import fs from 'fs';
import path from 'path';
// 直接导入爬虫模块的依赖
import axios from 'axios';
import cookieManager from './server/cookieManager.cjs';

// 从 crawler.cjs 复制必要的配置和函数
const PRODUCT_ID = 14885;

// Option IDs mapping based on the actual API
const OPTION_IDS = {
  metal: 1,        // option[1] - Metal type
  ringSize: 3,     // option[3] - Ring size
  stoneType: 6,    // option[6] - Stone type (Natural/Lab)
  shape: 7,        // option[7] - Shape
  carat: 8,        // option[8] - Carat (min)
  clarity: 9,      // option[9] - Clarity
  color: 10,       // option[10] - Color
  cutGrade: 11,    // option[11] - Cut Grade
  certificate: 12  // option[12] - Certificate
};

// Value mappings
const STONE_TYPE_VALUES = {
  'DI': 122,   // Natural Diamond
  'LAB': 958   // Lab-Created Diamond
};

const SHAPE_VALUES = {
  'RND': 125,  // Round
  'PRN': 126,  // Princess
  'EMR': 127,  // Emerald
  'MQS': 128,  // Marquise
  'OVL': 129,  // Oval
  'RAD': 130,  // Radiant
  'PER': 131,  // Pear
  'HRT': 132,  // Heart
  'CUS': 133,  // Cushion
  'ASC': 135   // Asscher
};

const CLARITY_VALUES = {
  'FL': 139,
  'IF': 140,
  'VVS1': 141,
  'VVS2': 142,
  'VS1': 143,
  'VS2': 144,
  'SI1': 145,
  'SI2': 146,
  'I1': 147
};

const COLOR_VALUES = {
  'D': 150,
  'E': 151,
  'F': 152,
  'G': 153,
  'H': 154,
  'I': 155,
  'J': 853,
  'K': 854,
  'L': 855
};

const CUT_VALUES = {
  'EX': 156,  // Excellent
  'VG': 157,  // Very Good
  'GD': 158,  // Good
  'FR': 230   // Fair
};

const CERTIFICATE_VALUES = {
  'DF': 161,
  'EGL': 186,   // EGL/SGL
  'IGI': 185,   // IGI/HRD
  'GIA': 187
};

const CARAT_VALUES = {
  '0.20': { min: '0.20', max: '30.00', code: '20', name: '0.20', optionValue: 191 },
  '0.30': { min: '0.30', max: '30.00', code: '30', name: '0.30', optionValue: 193 },
  '0.40': { min: '0.40', max: '30.00', code: '40', name: '0.40', optionValue: 195 },
  '0.50': { min: '0.50', max: '30.00', code: '50', name: '0.50', optionValue: 197 },
  '0.60': { min: '0.60', max: '30.00', code: '60', name: '0.60', optionValue: 199 },
  '0.70': { min: '0.70', max: '30.00', code: '70', name: '0.70', optionValue: 201 },
  '0.80': { min: '0.80', max: '30.00', code: '80', name: '0.80', optionValue: 203 },
  '0.90': { min: '0.90', max: '30.00', code: '90', name: '0.90', optionValue: 205 },
  '1.00': { min: '1.00', max: '30.00', code: '100', name: '1.00', optionValue: 207 },
  '1.20': { min: '1.20', max: '30.00', code: '120', name: '1.20', optionValue: 473 },
  '1.50': { min: '1.50', max: '30.00', code: '150', name: '1.50', optionValue: 209 },
  '1.70': { min: '1.70', max: '30.00', code: '170', name: '1.70', optionValue: 481 },
  '2.00': { min: '2.00', max: '30.00', code: '200', name: '2.00', optionValue: 211 },
  '2.50': { min: '2.50', max: '30.00', code: '250', name: '2.50', optionValue: 213 },
  '3.00': { min: '3.00', max: '30.00', code: '300', name: '3.00', optionValue: 215 },
  '3.50': { min: '3.50', max: '30.00', code: '350', name: '3.50', optionValue: 217 },
  '4.00': { min: '4.00', max: '30.00', code: '400', name: '4.00', optionValue: 219 },
  '4.50': { min: '4.50', max: '30.00', code: '450', name: '4.50', optionValue: 221 },
  '5.00': { min: '5.00', max: '30.00', code: '500', name: '5.00', optionValue: 223 },
  '5.50': { min: '5.50', max: '30.00', code: '550', name: '5.50', optionValue: 428 },
  '6.00': { min: '6.00', max: '30.00', code: '600', name: '6.00', optionValue: 430 },
  '6.50': { min: '6.50', max: '30.00', code: '650', name: '6.50', optionValue: 432 },
  '7.00': { min: '7.00', max: '30.00', code: '700', name: '7.00', optionValue: 434 },
  '7.50': { min: '7.50', max: '30.00', code: '750', name: '7.50', optionValue: 436 },
  '8.00': { min: '8.00', max: '30.00', code: '800', name: '8.00', optionValue: 438 },
  '8.50': { min: '8.50', max: '30.00', code: '850', name: '8.50', optionValue: 440 },
  '9.00': { min: '9.00', max: '30.00', code: '900', name: '9.00', optionValue: 442 },
  '9.50': { min: '9.50', max: '30.00', code: '950', name: '9.50', optionValue: 444 },
  '10.00': { min: '10.00', max: '30.00', code: '1000', name: '10.00', optionValue: 446 }
};

/**
 * Crawl diamond price for a specific configuration
 */
async function crawlDiamondPrices(productId, config) {
  const { stoneType, shape, carat, clarity, color, cutGrade, certificate } = config;

  // Get option values
  const stoneTypeValue = STONE_TYPE_VALUES[stoneType] || 958;
  const shapeValue = SHAPE_VALUES[shape] || 126;
  const clarityValue = CLARITY_VALUES[clarity] || 142;
  const colorValue = COLOR_VALUES[color] || 152;
  const cutValue = CUT_VALUES[cutGrade] || 170;
  const certValue = CERTIFICATE_VALUES[certificate] || 161;
  const caratConfig = CARAT_VALUES[carat] || CARAT_VALUES['0.20'];

  // Build form data matching the actual API format
  const params = new URLSearchParams();

  // Basic options
  params.append('option[1]', '14');  // Metal - 14K White Gold
  params.append('option[3]', '76');  // Ring size placeholder
  params.append('option[6]', stoneTypeValue.toString()); // Stone type
  params.append('option[7]', shapeValue.toString());

  // Carat settings
  params.append('stone_carat_min', caratConfig.min);
  params.append('stone_carat_max', '30.00');
  params.append('min_carat_code', caratConfig.code);
  params.append('min_carat_name', caratConfig.name);
  params.append('ct_rng', '1');

  // Diamond properties
  params.append('option[8]', caratConfig.optionValue.toString());
  params.append('option[9]', clarityValue.toString());
  params.append('option[10]', colorValue.toString());
  params.append('option[11]', cutValue.toString() || '');
  params.append('option[12]', certValue.toString());

  // Price range
  params.append('stone_price_min', '100');
  params.append('stone_price_max', '5000000');

  // Empty optional fields
  params.append('colored_stone_type', '');
  params.append('option[13]', '');
  params.append('option[14]', '');
  params.append('option[15]', '');
  params.append('hidden_diamond_code', '');
  params.append('diamond_code', '');
  params.append('carat_weight', '');

  // Product info
  params.append('active_diamond_tab', stoneType);  // 'LAB' or 'DI'
  params.append('quantity', '1');
  params.append('product_id', PRODUCT_ID.toString());
  params.append('edit_product', '0');
  params.append('img_src', '');
  params.append('product_namer', 'Prong Setting Solitaire Engagement Ring');
  params.append('stone_ids', '');
  params.append('cart_rnnumber', '');
  params.append('text_image', 'catalog/view/theme/default/image/PD360_Arrow.png');
  params.append('tag_no', '');

  // Instock options
  params.append('instock_ring_size', '');
  params.append('instock_backing', '');
  params.append('instock_chain_type', '');
  params.append('instock_chain_length', '');
  params.append('instock_metal_purity', '');
  params.append('hidden_instock_price', '0');
  params.append('hidden_instock_option_id', '');
  params.append('isMobile', '0');
  params.append('shipping_message', 'Estimated Delivery 2-3 working weeks.');
  params.append('hidden_stone_size', '');
  params.append('ship_date', '');
  params.append('dispatch_date', '');
  params.append('instock', 'no');

  // Pricing placeholders
  params.append('mpf', '0');
  params.append('spf', '0');
  params.append('amp', '0');
  params.append('asp', '0');
  params.append('assp', '');
  params.append('acp', '');
  params.append('cpf', '');
  params.append('chain_weight', '0.00');
  params.append('metal_wt', '0');
  params.append('total_markup', '0');
  params.append('chkdt', '');
  params.append('offer_discount', '0');
  params.append('offer_percantage_get', '25');
  params.append('th_march_insurance', '');
  params.append('sub_category', 'Solitaire');
  params.append('subcategoryid', '40');
  params.append('breadcrumb_url', 'https://www.diamondsfactory.com/engagement-rings/classic-solitaire');
  params.append('partner_id', '0');
  params.append('sets_products', '0');
  params.append('is_platinum', '0');
  params.append('top_category_id', '1');
  params.append('platinum_upgrade_json', '');
  params.append('bundle_total_weight', '');
  params.append('newimage', '0');
  params.append('vimeo_videos_json', '');
  params.append('product_videos_json', '');

  const url = 'https://www.diamondsfactory.com/index.php?route=product/product/add';
  const configKey = `${stoneType}/${shape}/${carat}/${clarity}/${color}/${cutGrade}/${certificate}`;

  console.log(`[API Request] ${configKey} -> ${url}`);
  const startTime = Date.now();

  try {
    // 获取动态 Cookie
    const cookieString = await cookieManager.getCookieString();

    const response = await axios.post(
      url,
      params.toString(),
      {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://www.diamondsfactory.com',
          'Referer': `https://www.diamondsfactory.com/design/prong-setting-solitaire-engagement-ring-clrn0709701?stone_shape=${shape}`,
          'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'Cookie': cookieString
        },
        timeout: 30000
      }
    );

    const duration = Date.now() - startTime;
    let data = response.data;

    console.log(`[API Response] ${configKey} | Status: ${response.status} | Time: ${duration}ms`);

    // If response is a string with HTML notices, try to extract JSON
    if (typeof data === 'string') {
      const jsonMatch = data.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse JSON from response');
        }
      }
    }

    // Extract price from the response
    let price = null;
    let sku = `clrn0709701-${stoneType}-${shape}-${carat}-${clarity}-${color}-${cutGrade}-${certificate}`;

    if (typeof data === 'object' && data !== null) {
      // spf is the stone/diamond price
      if (data.spf && typeof data.spf === 'number' && data.spf > 0) {
        price = data.spf;
      } else if (data.offer_price && typeof data.offer_price === 'number' && data.offer_price > 0) {
        price = data.offer_price;
      }
    }

    return {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      sku: sku,
      config: {
        stoneType,
        shape,
        carat,
        clarity,
        color,
        cutGrade,
        certificate
      },
      price: price,
      currency: 'GBP',
      timestamp: new Date()
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Error] ${configKey} | Time: ${duration}ms | Error: ${error.message}`);

    return {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      sku: `clrn0709701-${stoneType}-${shape}-${carat}-${clarity}-${color}-${cutGrade}-${certificate}`,
      config: {
        stoneType,
        shape,
        carat,
        clarity,
        color,
        cutGrade,
        certificate
      },
      price: null,
      currency: 'GBP',
      timestamp: new Date(),
      error: error.message
    };
  }
}

// 配置
const TASKS_DIR = './tasks';
const CONCURRENCY = 10; // 并发数
const DELAY = 500; // 每批之间的延迟（毫秒）

/**
 * 读取所有任务文件
 */
function getAllTaskFiles() {
  return fs.readdirSync(TASKS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(TASKS_DIR, file));
}

/**
 * 修复单个任务文件中的null价格
 */
async function fixTaskFile(filePath) {
  console.log(`Processing file: ${filePath}`);
  
  // 读取文件内容
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const task = JSON.parse(fileContent);
  
  if (!task.results || !Array.isArray(task.results)) {
    console.log(`No results found in ${filePath}, skipping...`);
    return;
  }
  
  // 找出price为null的条目
  const nullPriceItems = task.results.filter(item => item.price === null);
  
  if (nullPriceItems.length === 0) {
    console.log(`No null prices found in ${filePath}, skipping...`);
    return;
  }
  
  console.log(`Found ${nullPriceItems.length} items with null price in ${filePath}`);
  
  // 分批处理，每批CONCURRENCY个
  let fixedCount = 0;
  
  for (let i = 0; i < nullPriceItems.length; i += CONCURRENCY) {
    const batch = nullPriceItems.slice(i, i + CONCURRENCY);
    console.log(`Processing batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(nullPriceItems.length / CONCURRENCY)} (${batch.length} items)`);
    
    // 并发处理当前批次
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const result = await crawlDiamondPrices('clrn0709701', item.config);
          return { originalId: item.id, result };
        } catch (error) {
          console.error(`Failed to crawl ${item.sku}: ${error.message}`);
          return { originalId: item.id, result: null };
        }
      })
    );
    
    // 更新结果
    batchResults.forEach(({ originalId, result }) => {
      if (result && result.price !== null) {
        // 找到原始条目并更新价格
        const index = task.results.findIndex(item => item.id === originalId);
        if (index !== -1) {
          task.results[index].price = result.price;
          task.results[index].timestamp = result.timestamp;
          task.results[index].error = result.error || null;
          fixedCount++;
          console.log(`Fixed price for ${result.sku}: $${result.price} GBP`);
        }
      }
    });
    
    // 保存当前进度
    fs.writeFileSync(filePath, JSON.stringify(task, null, 2), 'utf-8');
    console.log(`Progress saved: ${fixedCount}/${nullPriceItems.length} fixed`);
    
    // 批次之间的延迟
    if (i + CONCURRENCY < nullPriceItems.length) {
      console.log(`Waiting ${DELAY}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY));
    }
  }
  
  console.log(`Completed processing ${filePath}: ${fixedCount}/${nullPriceItems.length} items fixed`);
  return fixedCount;
}

/**
 * 主函数
 */
async function main() {
  console.log('Starting to fix null prices in task files...');
  
  // 初始化 Cookie Manager
  console.log('Initializing Cookie Manager...');
  await cookieManager.initialize();
  
  // 检查 Cookie 状态
  const cookieStatus = cookieManager.getCookieStatus();
  if (!cookieStatus.hasCookie || !cookieStatus.hasCfClearance) {
    console.log('========================================');
    console.log('需要设置 Cookie！请按照以下步骤获取：');
    console.log('1. 用 Chrome 访问 https://www.diamondsfactory.com');
    console.log('2. 完成 Cloudflare 验证');
    console.log('3. 按 F12 打开开发者工具');
    console.log('4. 点击 Network 标签页');
    console.log('5. 刷新页面');
    console.log('6. 点击任意请求');
    console.log('7. 在 Headers 中找到 Cookie 字段');
    console.log('8. 复制全部 Cookie 内容');
    console.log('========================================');
    
    // 交互式获取 Cookie
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const cookie = await new Promise((resolve) => {
      rl.question('请输入 Cookie 内容: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
    
    if (!cookie) {
      console.error('ERROR: Cookie 不能为空！');
      process.exit(1);
    }
    
    // 设置 Cookie
    cookieManager.setManualCookie(cookie);
    console.log('Cookie 设置成功！');
    
    // 重新检查 Cookie 状态
    const newCookieStatus = cookieManager.getCookieStatus();
    if (!newCookieStatus.hasCfClearance) {
      console.error('ERROR: Cookie 中缺少 cf_clearance 字段！请确保复制了完整的 Cookie 内容。');
      process.exit(1);
    }
  }
  
  // 检查 Cookie 是否快过期
  if (cookieStatus.isExpiringSoon) {
    console.warn(`Warning: Cookie 已使用 ${cookieStatus.ageMinutes} 分钟，可能即将过期！`);
  }
  
  const taskFiles = getAllTaskFiles();
  console.log(`Found ${taskFiles.length} task files`);
  
  let totalFixed = 0;
  let totalProcessed = 0;
  
  for (const filePath of taskFiles) {
    try {
      const fixed = await fixTaskFile(filePath);
      totalFixed += fixed;
      totalProcessed++;
    } catch (error) {
      console.error(`Error processing ${filePath}: ${error.message}`);
      console.error(error.stack);
    }
    
    // 文件之间的延迟
    if (totalProcessed < taskFiles.length) {
      console.log('\nWaiting 1 second before next file...\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Processed ${totalProcessed}/${taskFiles.length} files`);
  console.log(`Fixed ${totalFixed} items with null prices`);
  console.log('All tasks completed!');
}

// 执行主函数
main().catch(error => {
  console.error('Error in main function:', error);
  process.exit(1);
});
