import { existsSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin, type Connect, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

// Serves the /api serverless functions during `vite dev` / `vite preview`, so
// the local preview behaves like the Vercel deployment (same-origin API).
// On Vercel the files in /api run as real serverless functions instead.
function apiDevServer(): Plugin {
  // ver1 — ปลายทางเดิม อ่านข้อมูลจากไฟล์ที่แนบไปกับโปรเจกต์
  const legacyRoutes: Record<string, string> = {
    '/api/owat': './api/owat.js',
    '/api/search': './api/search.js',
    '/api/auth/login': './api/auth/login.js',
    '/api/auth/me': './api/auth/me.js',
    '/api/auth/logout': './api/auth/logout.js',
    '/api/auth/register': './api/auth/register.js',
    '/api/admin/members': './api/admin/members.js',
  }

  /**
   * ver2 — หาไฟล์ TypeScript ที่ตรงกับ path ตามกติกาเดียวกับ Vercel
   *   /api/v1/teachings          → api/v1/teachings/index.ts
   *   /api/v1/teachings/facets   → api/v1/teachings/facets.ts
   *   /api/v1/teachings/<id>     → api/v1/teachings/[id].ts   (ไฟล์ตายตัวมาก่อนเสมอ)
   */
  function resolveV1(path: string): { file: string; params: Record<string, string> } | null {
    const rel = path.replace(/^\/api\/v1\/?/, '').replace(/\/+$/, '')
    if (!rel) return null
    const segments = rel.split('/').map(decodeURIComponent)
    const exact = `api/v1/${segments.join('/')}`

    for (const candidate of [`${exact}.ts`, `${exact}/index.ts`]) {
      if (existsSync(candidate)) return { file: `./${candidate}`, params: {} }
    }

    const parent = segments.slice(0, -1).join('/')
    const dynamic = `api/v1/${parent ? `${parent}/` : ''}[id].ts`
    if (existsSync(dynamic)) {
      return { file: `./${dynamic}`, params: { id: segments[segments.length - 1] } }
    }
    return null
  }

  function makeMiddleware(loadV1: ((file: string) => Promise<Record<string, never>>) | null) {
    const middleware: Connect.NextHandleFunction = async (req, res, next) => {
      const reqUrl = (req as { url?: string }).url || ''
      const path = reqUrl.split('?')[0]

      const v1 = loadV1 && path.startsWith('/api/v1') ? resolveV1(path) : null
      const legacy = legacyRoutes[path]
      if (!v1 && !legacy) return next()

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
        if (v1 && loadV1) {
          // เติม query เอง เพราะ vite ไม่ได้แปลง url ให้เหมือน Vercel
          const search = new URLSearchParams(reqUrl.slice(reqUrl.indexOf('?') + 1))
          const query = reqUrl.includes('?') ? Object.fromEntries(search.entries()) : {}
          Object.assign(req, { query: { ...query, ...v1.params } })

          const mod = (await loadV1(v1.file)) as unknown as {
            default: (req: unknown, res: unknown) => Promise<void>
          }
          await mod.default(req, shim)
        } else {
          const mod = await import(legacy)
          await mod.default(req, shim)
        }
      } catch (err) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          JSON.stringify({ data: null, error: { code: 'INTERNAL_ERROR', message: String(err) } }),
        )
      }
    }
    return middleware
  }

  return {
    name: 'api-dev-server',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        makeMiddleware((file) => server.ssrLoadModule(file) as Promise<Record<string, never>>),
      )
    },
    configurePreviewServer(server) {
      // preview เสิร์ฟไฟล์ที่ build แล้ว ไม่มี ssrLoadModule — รองรับเฉพาะปลายทาง ver1
      server.middlewares.use(makeMiddleware(null))
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // ส่งค่าจาก .env ให้ handler ที่รันในโปรเซสเดียวกันตอน dev
  const env = loadEnv(mode, process.cwd(), '')
  const passthrough = [
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD_SHA256',
    'AUTH_SECRET',
    'BLOB_READ_WRITE_TOKEN',
    'APP_ENV',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_URL_DEV',
    'SUPABASE_SERVICE_KEY_DEV',
    'SUPABASE_URL_TEST',
    'SUPABASE_SERVICE_KEY_TEST',
    'SUPABASE_URL_PROD',
    'SUPABASE_SERVICE_KEY_PROD',
  ]
  for (const key of passthrough) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }
  return {
    plugins: [apiDevServer(), react()],
  }
})
