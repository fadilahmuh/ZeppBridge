import { buildAiContext } from '../transforms/ai_export.js';

export function handleAiContext(req, res, ctx = {}) {
  const query = ctx.query || req.query || {};
  const format = String(query.format || 'markdown').toLowerCase();
  if (format !== 'markdown' && format !== 'md' && format !== 'json') {
    const errPayload = JSON.stringify({
      error: 'Invalid format parameter; expected markdown or json',
    });
    res.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(errPayload),
    });
    res.end(errPayload);
    return;
  }

  const { markdown, json } = buildAiContext({
    days: query.days,
    from: query.from,
    to: query.to,
  });

  if (format === 'json') {
    const payload = JSON.stringify(json);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Length': Buffer.byteLength(markdown),
  });
  res.end(markdown);
}

export const routes = [
  { method: 'GET', path: '/api/v1/ai/context', auth: true, handler: handleAiContext },
];

export function register(router) {
  for (const route of routes) {
    router.add(route.method, route.path, route.handler, { auth: route.auth });
  }
}

export default register;
