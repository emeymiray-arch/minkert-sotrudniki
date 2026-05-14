/**
 * Прокси `/api/*` → Nest на Render/Railway. Должен лежать в **корне Git-репозитория**
 * рядом с корневым `package.json`, иначе Vercel может не подхватить middleware.
 *
 * Vercel → Settings → Environment Variables:
 *   MINKERT_BACKEND_ORIGIN = https://xxxx.onrender.com  (без /api в конце)
 *
 * В настройках проекта Vercel поле **Root Directory** оставьте **пустым** (корень репо)
 * и используйте корневой `vercel.json` — см. DEPLOY.md.
 *
 * Копия логики синхронизирована с `frontend/middleware.ts`.
 */
export const config = {
  matcher: ['/api/:path*', '/api'],
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
          'Не задан MINKERT_BACKEND_ORIGIN. Vercel → Settings → Environment Variables → добавьте MINKERT_BACKEND_ORIGIN = https://ваш-api.onrender.com (без /api) → Redeploy. Адрес API один раз копируется из Render (страница сервиса → URL).',
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
  out.set('x-minkert-proxy', '1');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}
