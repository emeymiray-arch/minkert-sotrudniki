/**
 * Прокси `/api/*` → Nest. Используется, если в Vercel **Root Directory = `frontend`**.
 * Если Root Directory **пустой** (корень репозитория), используется `../middleware.ts`.
 *
 * MINKERT_BACKEND_ORIGIN = https://....onrender.com (без /api)
 *
 * Синхронизируйте правки с корневым `middleware.ts`.
 */
export const config = {
  matcher: ['/api/:path*', '/api'],
};

const UPSTREAM_FETCH_MS = 55_000;

async function fetchUpstream(targetUrl: string, init: RequestInit): Promise<Response | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), UPSTREAM_FETCH_MS);
  try {
    return await fetch(targetUrl, { ...init, signal: c.signal, redirect: 'manual' });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function readBackendOrigin(): string | undefined {
  const proc = (globalThis as Record<string, unknown>).process as
    | { env?: Record<string, string | undefined> }
    | undefined;
  const raw = proc?.env?.MINKERT_BACKEND_ORIGIN?.trim();
  if (!raw) return undefined;
  let o = raw.replace(/\/$/, '');
  if (o.endsWith('/api')) {
    o = o.slice(0, -4).replace(/\/$/, '');
  }
  return o;
}

export default async function middleware(request: Request): Promise<Response> {
  const origin = readBackendOrigin();
  if (!origin) {
    return new Response(
      JSON.stringify({
        message:
          'Не задан MINKERT_BACKEND_ORIGIN. Vercel → Settings → Environment Variables → добавьте MINKERT_BACKEND_ORIGIN = https://ваш-api.onrender.com (без /api) → Redeploy.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  const src = new URL(request.url);
  const targetUrl = `${origin}${src.pathname}${src.search}`;

  const hop = new Set([
    'connection',
    'content-length',
    'expect',
    'host',
    'keep-alive',
    'te',
    'transfer-encoding',
    'upgrade',
  ]);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (hop.has(k) || k.startsWith('access-control-')) return;
    headers.set(key, value);
  });

  const method = request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const buf = hasBody ? await request.arrayBuffer() : undefined;
  const body = buf && buf.byteLength > 0 ? buf : undefined;

  const upstream = await fetchUpstream(targetUrl, { method, headers, body });
  if (!upstream) {
    return new Response(
      JSON.stringify({
        message:
          'Таймаут при обращении к API на Render (часто бесплатный план: сервис «спит» до ~1 мин). Зайдите на render.com → ваш Web Service → Open app, подождите, затем обновите сайт. Либо откройте в браузере …onrender.com/api/health.',
      }),
      { status: 504, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (hop.has(k) || k.startsWith('access-control-')) return;
    out.set(key, value);
  });
  out.set('x-minkert-proxy', '1');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}
