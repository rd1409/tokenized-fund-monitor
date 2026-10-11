import { timingSafeEqual } from 'node:crypto';

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// True when the request carries `Authorization: Bearer <secret>` for one of the named env vars.
export function authorized(req, ...envNames) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return false;
  return envNames.some(n => process.env[n] && safeEqual(token, process.env[n]));
}

export function requireAuth(req, res, ...envNames) {
  const configured = envNames.filter(n => process.env[n]);
  if (!configured.length) {
    send(res, 500, { error: `Set ${envNames.join(' or ')} in your Vercel project's environment variables.` });
    return false;
  }
  if (!authorized(req, ...envNames)) {
    send(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function errorMessage(e) {
  return e instanceof Error ? e.message : String(e);
}
