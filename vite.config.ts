import { defineConfig, loadEnv, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'

// Serves the /api serverless functions during `vite dev` / `vite preview`, so
// the local preview behaves like the Vercel deployment (same-origin API).
// On Vercel the files in /api run as real serverless functions instead.
function apiDevServer(): Plugin {
  const routes: Record<string, string> = {
    '/api/owat': './api/owat.js',
    '/api/search': './api/search.js',
    '/api/auth/login': './api/auth/login.js',
    '/api/auth/me': './api/auth/me.js',
    '/api/auth/logout': './api/auth/logout.js',
    '/api/auth/register': './api/auth/register.js',
  }

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const reqUrl = (req as { url?: string }).url || ''
    const path = reqUrl.split('?')[0]
    const modPath = routes[path]
    if (!modPath) return next()

    const shim = {
      setHeader: (k: string, v: string) => res.setHeader(k, v),
      status(code: number) {
        res.statusCode = code
        return this
      },
      json(obj: unknown) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(obj))
      },
    }

    try {
      const mod = await import(modPath)
      await mod.default(req, shim)
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: String(err) }))
    }
  }

  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Expose auth env vars from .env to the in-process /api handlers during dev.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['ADMIN_EMAIL', 'ADMIN_PASSWORD_SHA256', 'AUTH_SECRET', 'BLOB_READ_WRITE_TOKEN']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }
  return {
    plugins: [apiDevServer(), react()],
  }
})
