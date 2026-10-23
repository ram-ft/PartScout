# PartScout

Compare electronics parts, from ESP32 boards to M3 bolts, across many shops in one list.

Stack: Svelte 5 + Vite (frontend), Hono on Node (backend), Lucide icons. No Next.js.

## Run

    npm install
    npm run dev

Open http://localhost:5173. The Vite dev server runs the Hono API in-process, so no second terminal is needed.

Production:

    npm run build
    npm start

Open http://127.0.0.1:8787

## Deploy on Render

This app needs a Node host. GitHub Pages only serves static files and cannot run the Hono API
(search, images, SerpAPI direct links, AI), so it shows a blank page for this repo. The included
`render.yaml` deploys the full app.

1. Push to GitHub, then in Render choose **New → Blueprint** and select this repo.
2. Enter `SERPAPI_KEY` and `AI_API_KEY` when Render asks; they stay server-side.
3. Deploy and open the Render URL (`https://<service>.onrender.com`).

Manual setup: a Web Service with build command `npm ci --include=dev && npm run build`, start
command `npm start`, and env vars `HOST=0.0.0.0`, `SERPAPI_KEY`, `AI_API_KEY`. Free instances
sleep after inactivity, so the first request can take about a minute. `.env` is gitignored and is
never uploaded; set the keys in Render. Disable GitHub Pages for this repo if it is enabled.

## Data

PartScout only shows real product listings. There is no sample or fallback catalogue.

Live store connectors (public product search endpoints, Shopify or WooCommerce): Robocraze,
ThinkRobotics, Quartz Components. Add more from the Customize page by domain. Shipping rules
are editable there too. Clicking a product image opens a gallery popup. For the three built-in
live shops, Shopify product.js and the WooCommerce Store API supply all published images on
demand (30-minute cache, no HTML scraping); Google Shopping rows only expose one thumbnail per
listing.

When `SERPAPI_KEY` is set in `.env`, Google Shopping is added as a fourth live connector via
SerpAPI. It returns marketplace listings from Amazon.in, Flipkart and other sellers with the
merchant shown in the Shop column. Google Shopping does not expose merchant URLs, so every offer
links to `/api/merchant-link`; on click the server asks the Google immersive product API for the
matched store and redirects to the exact merchant product page (for example `amazon.in/dp/...`).
That resolution costs one SerpAPI credit per unique offer and is cached for 6 hours; if it fails,
the link falls back to the Google Shopping product page. The feed does not quote shipping, so
Google Shopping totals exclude delivery. The key stays server-side; never put it in frontend code.
Listings are cached for 10 minutes to limit SerpAPI credits.

Amazon, Flipkart, Robu, Evelta, Sunrom, IndiaMART, LCSC, Mouser and DigiKey are also shown in the
same shops list as one-click marketplace searches. These sites do not provide free product
search APIs, so their direct results open on-site. Each marketplace can be turned on or off from
Customize → Connected Distributors; delivery rules apply to the live connectors only. A
Google Shopping link sits at the end of the same list as a free cross-marketplace comparison.

## AI search assist

When `AI_API_KEY` is set in `.env`, each search also asks an OpenAI-compatible gateway (OpenLLM by
default) for a query plan: a normalized part name plus up to two alternate storefront searches.
The alternates run only on the free live-shop APIs, never on SerpAPI, and every listing still comes
from a real shop feed. The result strip shows what the AI understood and how many extra listings
the alternates added. Plans are cached for 12 hours; if the model is slow or unavailable, the plain
search result is returned unchanged. `AI_BASE_URL` and `AI_MODEL` override the gateway if needed.
The key stays server-side and is never sent to the browser.

The same key powers a grounded Shortlist review. The Shortlist page sends the deterministic
optimizer result (parts, per-shop coverage and totals, single-store cart, split cart, savings,
picks) to `/api/ai/bom` and shows a review card. The prompt forbids inventing products, shops or
prices; the model only rephrases numbers that were computed from live listings. Summaries are
cached for 30 minutes and fail silently, leaving the page unchanged.

## Layout

    server/app.js       Hono API (sources, search, image gallery, BOM review)
    server/index.js     production server + static assets
    server/sources.js   live shop adapters, marketplace links, cache
    server/ai.js        AI query planning and BOM review (OpenLLM)
    server/pack.js      pack-size detection, matching
    src/lib/store.svelte.js   settings, shortlist, hash routing
    src/views/          Search, Shortlist, Customize

URLs use the hash only (`#search?q=m3 bolt&qty=50`), so there are no path slashes.
