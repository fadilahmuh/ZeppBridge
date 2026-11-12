import http from 'node:http';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { authMiddleware } from './utils/auth.js';
import { register as registerHealth, handleHealth } from './routes/health.js';

process.env.TZ ||= 'Asia/Jakarta';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.join(SRC_DIR, 'routes');
export const BASE_PATH = '/api/v1';

// Route mount table: sibling PRs (workouts, ai, dashboard, etc.) drop modules in src/routes/
const OPTIONAL_ROUTE_MODULES = ['workouts.js', 'ai.js', 'dashboard.js', 'daily.js', 'sleep.js', 'readiness.js', 'stats.js', 'metrics.js'];

export function sendJson(res, statusCode, data) {
  if (res.writableEnded) return;
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function compilePath(routePath) {
  const keys = [];
  const normalized = routePath.length > 1 ? routePath.replace(/\/+$/, '') : routePath;
  const pattern = normalized
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([A-Za-z0-9_]+)/g, (_m, key) => {
      keys.push(key);
      return '([^/]+)';
    });
  return { regex: new RegExp(`^${pattern}$`), keys, raw: normalized };
}

export function createRouter() {
  const table = [];
  const prefixHandlers = [];

  const router = {
    table,
    add(method, routePath, handler, options = {}) {
      const upperMethod = String(method || 'GET').toUpperCase();
      const paths = [routePath];
      if (routePath !== '/health' && !routePath.startsWith(BASE_PATH)) {
        paths.push(`${BASE_PATH}${routePath.startsWith('/') ? '' : '/'}${routePath}`);
      }
      for (const p of paths) {
        const compiled = compilePath(p);
        const requiresAuth = options.auth ?? p.startsWith(BASE_PATH);
        table.push({
          method: upperMethod,
          ...compiled,
          handler,
          auth: requiresAuth,
        });
      }
      return router;
    },
    get(routePath, handler, options) {
      return router.add('GET', routePath, handler, options);
    },
    use(prefix, handler, options = {}) {
      prefixHandlers.push({
        prefix,
        handler,
        auth: options.auth ?? prefix.startsWith(BASE_PATH),
      });
      return router;
    },
    async dispatch(req, res) {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
      const method = (req.method || 'GET').toUpperCase();

      req.pathname = pathname;
      req.query = Object.fromEntries(url.searchParams.entries());
      req.searchParams = url.searchParams;

      if (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`)) {
        if (!authMiddleware(req, res)) return;
      }

      if (pathname === BASE_PATH && method === 'GET') {
        return handleHealth(req, res);
      }

      let pathMatched = false;
      for (const entry of table) {
        const match = pathname.match(entry.regex);
        if (!match) continue;
        pathMatched = true;
        if (entry.method !== method && entry.method !== 'ALL') continue;

        if (entry.auth && !authMiddleware(req, res)) return;

        const params = {};
        entry.keys.forEach((k, idx) => {
          params[k] = decodeURIComponent(match[idx + 1]);
        });
        req.params = params;

        const result = await entry.handler(req, res, {
          params,
          query: req.query,
          searchParams: url.searchParams,
          url,
          sendJson: (code, body) => sendJson(res, code, body),
          sendError: (code, msg) => sendError(res, code, msg),
        });

        if (!res.writableEnded && result !== undefined) {
          if (result && typeof result === 'object' && 'status' in result && 'body' in result) {
            sendJson(res, result.status, result.body);
          } else {
            sendJson(res, 200, result);
          }
        }
        return;
      }

      for (const sub of prefixHandlers) {
        if (pathname === sub.prefix || pathname.startsWith(`${sub.prefix}/`)) {
          if (sub.auth && !authMiddleware(req, res)) return;
          const handled = await sub.handler(req, res, { pathname, query: req.query, url });
          if (res.writableEnded || handled === true) return;
        }
      }

      if (pathMatched) {
        return sendError(res, 405, 'Method not allowed');
      }
      return sendError(res, 404, 'Not found');
    },
  };

  return router;
}

function mountModule(router, mod, fileName) {
  if (!mod) return;
  if (typeof mod.register === 'function') {
    mod.register(router);
    return;
  }
  if (Array.isArray(mod.routes)) {
    for (const r of mod.routes) {
      if (Array.isArray(r)) {
        router.add(r[0], r[1], r[2], r[3]);
      } else if (r && r.path && r.handler) {
        router.add(r.method || 'GET', r.path, r.handler, { auth: r.auth });
      }
    }
    return;
  }
  if (typeof mod.default === 'function') {
    if (mod.default.length <= 1) {
      mod.default(router);
    } else {
      const base = path.basename(fileName, '.js');
      router.use(`${BASE_PATH}/${base}`, mod.default);
    }
    return;
  }
  if (Array.isArray(mod.default)) {
    for (const r of mod.default) {
      if (r && r.path && r.handler) {
        router.add(r.method || 'GET', r.path, r.handler, { auth: r.auth });
      }
    }
    return;
  }
  if (mod.default && typeof mod.default === 'object') {
    for (const [key, handler] of Object.entries(mod.default)) {
      if (typeof handler !== 'function') continue;
      const [m, p] = key.includes(' ') ? key.split(/\s+/, 2) : ['GET', key];
      router.add(m, p, handler);
    }
  }
}

export async function loadRoutes(router) {
  registerHealth(router);

  if (!existsSync(ROUTES_DIR)) return router;
  const discovered = new Set([
    ...OPTIONAL_ROUTE_MODULES,
    ...readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js')),
  ]);
  discovered.delete('health.js');

  for (const file of discovered) {
    const fullPath = path.join(ROUTES_DIR, file);
    if (!existsSync(fullPath)) continue;
    try {
      const mod = await import(pathToFileURL(fullPath).href);
      mountModule(router, mod, file);
    } catch (err) {
      console.error(`Failed loading route module ${file}:`, err.message);
    }
  }
  return router;
}

export async function createServer() {
  const router = createRouter();
  await loadRoutes(router);

  const server = http.createServer(async (req, res) => {
    try {
      await router.dispatch(req, res);
    } catch (err) {
      const status = err?.statusCode || err?.status || 500;
      sendError(res, status, err?.message || 'Internal server error');
    }
  });

  return { server, router };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const port = Number(process.env.PORT) || 8080;
  const { server } = await createServer();
  server.listen(port, () => {
    console.log(`zeppbridge-api listening on http://localhost:${port}`);
  });
}
