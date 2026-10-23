import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app } from './app.js'

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'

app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`PartScout on http://${HOST}:${info.port}  (live shops only)`)
})
