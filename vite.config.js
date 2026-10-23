import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { app } from './server/app.js'

// Serve the Hono API from the Vite dev server itself, so `npm run dev` never
// proxies to a missing backend and cannot return a bare 500.
function apiServer() {
  return {
    name: 'partscout-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url || ''
        if (!path.startsWith('/api/')) return next()

        try {
          const headers = {}
          for (const [key, value] of Object.entries(req.headers)) {
            if (value != null) headers[key] = Array.isArray(value) ? value.join(', ') : String(value)
          }
          const init = { method: req.method, headers }
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            init.body = Buffer.concat(chunks)
          }
          const request = new Request(new URL(path, 'http://localhost'), init)
          const response = await app.fetch(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          console.error('API middleware failed:', e)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Search service failed. Check the server logs.' }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [svelte(), apiServer()],
  server: {
    port: 5173
  }
})
