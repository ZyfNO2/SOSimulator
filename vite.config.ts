import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const logFilePath = path.join(rootDir, 'app.log')

async function readRequestBody(request: NodeJS.ReadableStream) {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8')
}

function appLogPlugin(): Plugin {
  const handler = async (request: any, response: any, next: () => void) => {
    if (request.method !== 'POST' || request.url !== '/__log') {
      next()
      return
    }

    try {
      const body = await readRequestBody(request)
      const payload = body.length > 0 ? JSON.parse(body) : {}
      const timestamp = new Date().toISOString()
      const level = payload.level ?? 'info'
      const scope = payload.scope ?? 'app'
      const message = payload.message ?? ''
      const suffix =
        typeof payload.data === 'undefined' ? '' : ` ${JSON.stringify(payload.data)}`

      await mkdir(path.dirname(logFilePath), { recursive: true })
      await appendFile(logFilePath, `${timestamp} [${level}] [${scope}] ${message}${suffix}\n`)

      response.statusCode = 204
      response.end()
    } catch (error) {
      response.statusCode = 500
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown log write error',
        }),
      )
    }
  }

  return {
    name: 'app-log-plugin',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

export default defineConfig({
  plugins: [react(), appLogPlugin()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.trycloudflare.com'],
  },
})
