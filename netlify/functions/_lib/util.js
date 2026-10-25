// Общие серверные утилиты: ответы API, чтение тела, IP-хеш, токены, CORS.

// Все API-ответы — без кэширования нигде и никогда
const NO_STORE = 'no-store, no-cache, must-revalidate';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': NO_STORE,
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export function error(status, code, message) {
  return json({ error: code, message }, status);
}

// Чтение JSON-тела с жёстким лимитом размера (по умолчанию 64 КБ)
export async function readJson(request, maxBytes = 64 * 1024) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) return null;
  let text;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (!text || text.length > maxBytes) return null;
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

// CORS: работаем только со своим доменом. Сторонний Origin — 403.
// Same-origin запросы могут не иметь Origin вовсе — пропускаем.
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const host = request.headers.get('host');
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// IP только как соль-хеш (без хранения самого адреса), для rate limit
export async function ipHash(request) {
  const envSalt = globalThis.NETLIFY_ENV_SALT || process.env.PB_SALT || 'pbk-dev-salt';
  const ip =
    request.headers.get('x-nf-client-connection-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(envSalt + '|' + ip));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Постоянное сравнение секретов (токенов) — без утечки по времени
export async function tokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('pbk-token|' + token));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Криптостойкий идентификатор (по умолчанию 16 символов base64url ≈ 96 бит)
export function randomId(bytes = 9) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString('base64url');
}

export function randomToken() {
  return randomId(32);
}

// Параметр маршрута: редиректы netlify.toml передают его query-параметром,
// паттерны функций v2 — через context.params. Поддерживаем оба варианта.
export function routeParam(request, context, name) {
  const fromQuery = new URL(request.url).searchParams.get(name);
  if (fromQuery) return fromQuery;
  return context?.params?.[name];
}
