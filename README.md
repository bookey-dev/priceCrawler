# priceCrawler

Multi-brand diamond price crawler with a Vue 3 dashboard, an Express API, SQLite storage, and brand-specific crawlers powered by HTTP requests or Puppeteer.

## What This Project Does

- Crawls diamond prices from multiple brands.
- Stores crawl sessions and normalized price records in SQLite.
- Exposes APIs for crawl control, price comparison, trend analysis, and export download.
- Provides a small frontend for selecting brands, launching crawls, checking progress, and downloading session data.

## Current Stack

- Frontend: Vue 3 + Vite + TypeScript
- Backend: Express
- Storage: SQLite via `better-sqlite3`
- Crawling: `axios`, `cheerio`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`

## Supported Brands

The server registers these crawlers on startup:

- `df`: Diamonds Factory, configurator mode, Puppeteer required
- `bn`: Blue Nile, inventory mode
- `77d`: 77 Diamonds, inventory mode
- `wc`: With Clarity, inventory mode
- `ja`: James Allen, inventory mode, Puppeteer required
- `gb`: Grown Brilliance, inventory mode, Puppeteer required
- `be`: Brilliant Earth, inventory mode, Puppeteer required

## Project Structure

```text
priceCrawler/
├── src/                     # Vue frontend
├── server/
│   ├── crawlers/            # Brand-specific crawler implementations
│   ├── routes/              # API routes
│   ├── data/                # SQLite database directory
│   ├── ssl/                 # HTTPS certificate and key
│   ├── browserPool.cjs      # Shared Puppeteer browser pool
│   ├── cookieManager.cjs    # Cookie persistence and manual update helpers
│   ├── db.cjs               # Schema and query helpers
│   └── index.cjs            # HTTPS API entrypoint
└── package.json
```

## Requirements

- Node.js 18+
- npm
- A working local browser environment for Puppeteer
- Local HTTPS certificate files:
  - `server/ssl/server.key`
  - `server/ssl/server.cert`
- If you use Puppeteer-based brands, a reachable SOCKS proxy is currently hardcoded in [server/browserPool.cjs](/Users/lijun/GitHub/priceCrawler/server/browserPool.cjs:9):
  - `socks5://127.0.0.1:7897`

## Install

```bash
npm install
```

## Run

Start frontend and backend together:

```bash
npm start
```

Available scripts:

- `npm run dev`: frontend only
- `npm run server`: backend with `nodemon`
- `npm run server:prod`: backend without watcher
- `npm run build`: production frontend build
- `npm run preview`: preview built frontend

## Local URLs

- Frontend (Vite): usually `http://localhost:5173`
- Backend (HTTPS): `https://localhost:3005` by default

The backend port comes from `process.env.PORT` and defaults to `3005`.

## Data Storage

- SQLite database: `server/data/diamonds.db`
- Export directory: `exports/`
- Cookie cache: `server/cookies.json`

The backend automatically creates `server/data/` and `exports/` if missing.

## Main Workflow

1. Start the app with `npm start`.
2. Open the frontend and select a brand.
3. Choose crawl filters such as shape, carat, and cut grade.
4. Start a crawl from the UI.
5. Polling updates crawl progress and recent sessions automatically.
6. Download CSV or JSON exports from completed sessions.

## API Overview

Base path: `/api`

Key endpoints:

- `GET /brands`: list all brands and crawler status
- `GET /brands/:brandId/status`: get a single brand status
- `POST /brands/:brandId/crawl`: start a crawl and return `sessionId`
- `GET /brands/:brandId/sessions`: get recent crawl sessions
- `GET /brands/:brandId/sessions/:sessionId`: get one session with progress
- `GET /brands/:brandId/latest`: get latest normalized price records
- `GET /brands/:brandId/sessions/:sessionId/export?format=csv|json`: export one session
- `GET /comparison`: comparison data
- `POST /comparison/matrix`: matrix comparison data
- `GET /trends/average`: aggregate trend series
- `GET /trends/brand`: brand trend series
- `GET /exports`: list generated export files
- `GET /exports/:filename`: download an export file
- `GET /cookie/status`: inspect cookie status
- `POST /cookie`: manually set cookie string when needed
- `GET /browser/status`: inspect shared browser pool status
- `POST /browser/restart`: restart shared browser pool

## Notes And Caveats

- The backend is served over HTTPS and will fail to start if the SSL files are missing.
- Puppeteer-based brands share one browser pool and initialize serially to avoid connection issues.
- Some brands depend on Cloudflare bypass and/or valid cookies, so crawler readiness may lag behind server startup.
- Long-running crawls are expected. Both the API timeout and server timeout are intentionally set very high.
- The proxy URL is hardcoded today instead of being managed through environment variables.

## Security Notes

- `server/cookies.json` may contain real session cookies. Treat it as sensitive.
- `server/ssl/server.key` is a private key and should be handled as sensitive material.
- Review what should be committed before pushing this repository to a shared remote.

## Useful Files

- [package.json](/Users/lijun/GitHub/priceCrawler/package.json)
- [server/index.cjs](/Users/lijun/GitHub/priceCrawler/server/index.cjs)
- [server/routes/brands.cjs](/Users/lijun/GitHub/priceCrawler/server/routes/brands.cjs)
- [server/db.cjs](/Users/lijun/GitHub/priceCrawler/server/db.cjs)
- [src/App.vue](/Users/lijun/GitHub/priceCrawler/src/App.vue)
- [src/components/SingleCrawl.vue](/Users/lijun/GitHub/priceCrawler/src/components/SingleCrawl.vue)
