/**
 * Прокси API на Vercel: браузер ходит на тот же домен `/api/...`, эта Edge-функция
 * пересылает запрос на Render/Railway. В Vercel → Settings → Environment Variables:
 * MINKERT_BACKEND_ORIGIN = https://ваш-сервис.onrender.com (без /api в конце).
 */
export const config = { runtime: 'edge' };

function readBackendOrigin(): string | undefined {
  const proc = (globalThis as Record<string, unknown>).process as
    | { env?: Record<string, string | undefined> }
    | undefined;
  return proc?.env?.MINKERT_BACKEND_ORIGIN?.trim().replace(/\/$/, '');
}

export default async function handler(request: Request): Promise<Response> {
  const origin = readBackendOrigin();
  if (!origin) {
    return new Response(
      JSON.stringify({
        message:
          'На Vercel не задан MINKERT_BACKEND_ORIGIN. Откройте проект → Settings → Environment Variables → Add: имя MINKERT_BACKEND_ORIGIN, значение адрес вашего API без /api (например https://minkert-xxxx.onrender.com) → Save → вкладка Deployments → у последнего деплоя кнопка Redeploy.',
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
