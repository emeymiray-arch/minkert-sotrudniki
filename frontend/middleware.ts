/**
 * Прокси `/api/*` → бэкенд (Nest). Для Vite на Vercel надёжнее, чем только `api/[...path].ts`.
 * Переменная: MINKERT_BACKEND_ORIGIN = https://ваш-сервис.onrender.com (без /api; если указали /api — отрежем).
 */
export const config = {
  matcher: '/api/:path*',
};

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
          'Не задан MINKERT_BACKEND_ORIGIN. Vercel → Project → Settings → Environment Variables: добавьте MINKERT_BACKEND_ORIGIN = https://ваш-api.onrender.com (без /api в конце) → Redeploy.',
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

  const upstream = await fetch(targetUrl, { method, headers, body, redirect: 'manual' });

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (hop.has(k) || k.startsWith('access-control-')) return;
    out.set(key, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}
