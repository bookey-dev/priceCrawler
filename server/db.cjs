const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_DIR = path.join(__dirname, 'data')
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

const DB_PATH = path.join(DB_DIR, 'diamonds.db')

let db = null

function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema() {
  const d = getDb()

  d.exec(`
    CREATE TABLE IF NOT EXISTS diamond_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      stone_type TEXT NOT NULL,
      shape TEXT NOT NULL,
      carat REAL NOT NULL,
      color TEXT NOT NULL,
      clarity TEXT NOT NULL,
      cut TEXT NOT NULL,
      certificate TEXT,
      price_usd REAL NOT NULL,
      price_original REAL,
      price_currency TEXT DEFAULT 'USD',
      source_id TEXT,
      carat_bucket TEXT NOT NULL,
      grade_key TEXT NOT NULL,
      crawl_session_id INTEGER,
      crawled_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dp_brand ON diamond_prices(brand);
    CREATE INDEX IF NOT EXISTS idx_dp_crawled_at ON diamond_prices(crawled_at);
    CREATE INDEX IF NOT EXISTS idx_dp_grade_key ON diamond_prices(grade_key);
    CREATE INDEX IF NOT EXISTS idx_dp_brand_grade ON diamond_prices(brand, stone_type, shape, carat_bucket, color, clarity, cut);
    CREATE INDEX IF NOT EXISTS idx_dp_session ON diamond_prices(crawl_session_id);

    CREATE TABLE IF NOT EXISTS crawl_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT DEFAULT 'running',
      total_diamonds INTEGER DEFAULT 0,
      error TEXT,
      filters_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_cs_brand ON crawl_sessions(brand);
    CREATE INDEX IF NOT EXISTS idx_cs_status ON crawl_sessions(status);
  `)

  // 迁移：添加进度追踪列
  const migrationCols = [
    { name: 'progress_completed', def: 'INTEGER DEFAULT 0' },
    { name: 'progress_total', def: 'INTEGER DEFAULT 0' },
    { name: 'progress_success', def: 'INTEGER DEFAULT 0' },
    { name: 'progress_detail', def: "TEXT DEFAULT ''" }
  ]
  for (const col of migrationCols) {
    try {
      d.exec(`ALTER TABLE crawl_sessions ADD COLUMN ${col.name} ${col.def}`)
    } catch (e) {
      // Column already exists, ignore
    }
  }

  d.exec(`
    CREATE TABLE IF NOT EXISTS price_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      stone_type TEXT NOT NULL,
      shape TEXT NOT NULL,
      carat_bucket TEXT NOT NULL,
      color TEXT NOT NULL,
      clarity TEXT NOT NULL,
      cut TEXT NOT NULL,
      avg_price REAL NOT NULL,
      min_price REAL,
      max_price REAL,
      diamond_count INTEGER NOT NULL,
      snapshot_date TEXT NOT NULL,
      UNIQUE(brand, stone_type, shape, carat_bucket, color, clarity, cut, snapshot_date)
    );

    CREATE INDEX IF NOT EXISTS idx_ps_comparison ON price_snapshots(stone_type, shape, carat_bucket, color, clarity, cut, snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_ps_brand_date ON price_snapshots(brand, snapshot_date);
  `)
}

// ========== Crawl Sessions ==========

function createCrawlSession(brand, filtersJson) {
  const d = getDb()
  const stmt = d.prepare(`
    INSERT INTO crawl_sessions (brand, started_at, status, filters_json)
    VALUES (?, datetime('now'), 'running', ?)
  `)
  const result = stmt.run(brand, JSON.stringify(filtersJson || {}))
  return result.lastInsertRowid
}

function completeCrawlSession(sessionId, totalDiamonds, error = null) {
  const d = getDb()
  const status = error ? 'failed' : 'completed'
  d.prepare(`
    UPDATE crawl_sessions SET completed_at = datetime('now'), status = ?, total_diamonds = ?, error = ?
    WHERE id = ?
  `).run(status, totalDiamonds, error, sessionId)
}

function updateSessionProgress(sessionId, completed, total, successCount, detail) {
  const d = getDb()
  d.prepare(`
    UPDATE crawl_sessions SET progress_completed = ?, progress_total = ?, progress_success = ?, progress_detail = ?
    WHERE id = ?
  `).run(completed, total, successCount, detail || '', sessionId)
}

function getCrawlSessionById(sessionId) {
  const d = getDb()
  return d.prepare('SELECT * FROM crawl_sessions WHERE id = ?').get(sessionId)
}

function getCrawlSessions(brand = null, limit = 50) {
  const d = getDb()
  if (brand) {
    return d.prepare('SELECT * FROM crawl_sessions WHERE brand = ? ORDER BY started_at DESC LIMIT ?').all(brand, limit)
  }
  return d.prepare('SELECT * FROM crawl_sessions ORDER BY started_at DESC LIMIT ?').all(limit)
}

// ========== Diamond Prices ==========

function insertDiamondPrices(diamonds, sessionId = null) {
  const d = getDb()
  const stmt = d.prepare(`
    INSERT INTO diamond_prices (brand, stone_type, shape, carat, color, clarity, cut, certificate,
      price_usd, price_original, price_currency, source_id, carat_bucket, grade_key, crawl_session_id, crawled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)

  const insertMany = d.transaction((items) => {
    for (const item of items) {
      stmt.run(
        item.brand, item.stoneType, item.shape, item.carat,
        item.color, item.clarity, item.cut, item.certificate || null,
        item.priceUSD, item.priceOriginal || item.priceUSD, item.priceCurrency || 'USD',
        item.sourceId || null, item.caratBucket, item.gradeKey,
        sessionId
      )
    }
  })

  insertMany(diamonds)
  return diamonds.length
}

function getDiamondPrices(filters = {}) {
  const d = getDb()
  const conditions = []
  const params = []

  if (filters.brand) { conditions.push('brand = ?'); params.push(filters.brand) }
  if (filters.stoneType) { conditions.push('stone_type = ?'); params.push(filters.stoneType) }
  if (filters.shape) { conditions.push('shape = ?'); params.push(filters.shape) }
  if (filters.color) { conditions.push('color = ?'); params.push(filters.color) }
  if (filters.clarity) { conditions.push('clarity = ?'); params.push(filters.clarity) }
  if (filters.cut) { conditions.push('cut = ?'); params.push(filters.cut) }
  if (filters.caratBucket) { conditions.push('carat_bucket = ?'); params.push(filters.caratBucket) }
  if (filters.dateFrom) { conditions.push('crawled_at >= ?'); params.push(filters.dateFrom) }
  if (filters.dateTo) { conditions.push('crawled_at <= ?'); params.push(filters.dateTo) }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit || 1000
  params.push(limit)

  return d.prepare(`SELECT * FROM diamond_prices ${where} ORDER BY crawled_at DESC LIMIT ?`).all(...params)
}

// ========== Price Snapshots ==========

function computeAndSaveSnapshots(brand, date = null) {
  const d = getDb()
  const snapshotDate = date || new Date().toISOString().split('T')[0]

  // 计算当天该品牌各品级的聚合价格
  const rows = d.prepare(`
    SELECT brand, stone_type, shape, carat_bucket, color, clarity, cut,
      AVG(price_usd) as avg_price,
      MIN(price_usd) as min_price,
      MAX(price_usd) as max_price,
      COUNT(*) as diamond_count
    FROM diamond_prices
    WHERE brand = ? AND date(crawled_at) = ?
    GROUP BY brand, stone_type, shape, carat_bucket, color, clarity, cut
  `).all(brand, snapshotDate)

  if (rows.length === 0) return 0

  const stmt = d.prepare(`
    INSERT OR REPLACE INTO price_snapshots
      (brand, stone_type, shape, carat_bucket, color, clarity, cut, avg_price, min_price, max_price, diamond_count, snapshot_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertAll = d.transaction((items) => {
    for (const row of items) {
      stmt.run(row.brand, row.stone_type, row.shape, row.carat_bucket, row.color, row.clarity, row.cut,
        row.avg_price, row.min_price, row.max_price, row.diamond_count, snapshotDate)
    }
  })

  insertAll(rows)
  return rows.length
}

function getComparisonData(filters = {}) {
  const d = getDb()
  const conditions = []
  const params = []

  if (filters.stoneType) { conditions.push('stone_type = ?'); params.push(filters.stoneType) }
  if (filters.shape) { conditions.push('shape = ?'); params.push(filters.shape) }
  if (filters.caratBucket) { conditions.push('carat_bucket = ?'); params.push(filters.caratBucket) }
  if (filters.color) { conditions.push('color = ?'); params.push(filters.color) }
  if (filters.clarity) { conditions.push('clarity = ?'); params.push(filters.clarity) }
  if (filters.cut) { conditions.push('cut = ?'); params.push(filters.cut) }

  // 默认取最近一天的快照
  if (filters.date) {
    conditions.push('snapshot_date = ?')
    params.push(filters.date)
  } else {
    conditions.push('snapshot_date = (SELECT MAX(snapshot_date) FROM price_snapshots)')
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return d.prepare(`
    SELECT brand, stone_type, shape, carat_bucket, color, clarity, cut,
      avg_price, min_price, max_price, diamond_count, snapshot_date
    FROM price_snapshots ${where}
    ORDER BY stone_type, shape, carat_bucket, color, clarity, cut, brand
  `).all(...params)
}

function getTrendData(filters = {}) {
  const d = getDb()
  const conditions = []
  const params = []

  if (filters.brand) { conditions.push('brand = ?'); params.push(filters.brand) }
  if (filters.stoneType) { conditions.push('stone_type = ?'); params.push(filters.stoneType) }
  if (filters.shape) { conditions.push('shape = ?'); params.push(filters.shape) }
  if (filters.caratBucket) { conditions.push('carat_bucket = ?'); params.push(filters.caratBucket) }
  if (filters.color) { conditions.push('color = ?'); params.push(filters.color) }
  if (filters.clarity) { conditions.push('clarity = ?'); params.push(filters.clarity) }
  if (filters.cut) { conditions.push('cut = ?'); params.push(filters.cut) }

  // 时间范围
  if (filters.period) {
    const days = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 }[filters.period] || 30
    conditions.push(`snapshot_date >= date('now', '-${days} days')`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return d.prepare(`
    SELECT brand, snapshot_date, avg_price, min_price, max_price, diamond_count
    FROM price_snapshots ${where}
    ORDER BY snapshot_date ASC, brand ASC
  `).all(...params)
}

function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

module.exports = {
  getDb,
  createCrawlSession,
  completeCrawlSession,
  updateSessionProgress,
  getCrawlSessionById,
  getCrawlSessions,
  insertDiamondPrices,
  getDiamondPrices,
  computeAndSaveSnapshots,
  getComparisonData,
  getTrendData,
  closeDb
}
