#!/usr/bin/env python3
"""
Базовая проверка безопасности СВОЕГО сайта / API Minkert.
Только стандартная библиотека Python 3 — ничего ставить не нужно.

Примеры:
  python3 scripts/security-check.py --url http://localhost:3000 --frontend http://localhost:5173 --yes
  python3 scripts/security-check.py --url https://ваш-api.onrender.com --yes
  python3 scripts/security-check.py --url https://ваш-сайт.vercel.app --yes

Перед проверкой локально: npm run dev
"""

from __future__ import annotations

import argparse
import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Callable

TIMEOUT = 12
USER_AGENT = "Minkert-Security-Check/1.0 (+owner self-test)"


@dataclass
class Finding:
    level: str  # OK | INFO | WARN | CRIT
    title: str
    detail: str


def normalize_base(url: str) -> str:
    u = url.strip().rstrip("/")
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    return u


def api_base(base: str) -> str:
    parsed = urllib.parse.urlparse(base)
    path = parsed.path.rstrip("/")
    if path.endswith("/api"):
        return base.rstrip("/")
    if path in ("", "/"):
        return base.rstrip("/") + "/api"
    return base.rstrip("/")


def join_url(base: str, path: str) -> str:
    return base.rstrip("/") + "/" + path.lstrip("/")


@dataclass
class HttpResult:
    status: int
    headers: dict[str, str]
    body: str
    url: str


def request(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json_body: dict | None = None,
    allow_redirects: bool = True,
) -> HttpResult | None:
    hdrs = {"User-Agent": USER_AGENT, "Accept": "application/json, text/plain, */*"}
    if headers:
        hdrs.update(headers)
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        hdrs["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    ctx = ssl.create_default_context()

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    handlers: list = [urllib.request.HTTPSHandler(context=ctx)]
    if not allow_redirects:
        opener = urllib.request.build_opener(NoRedirect, *handlers)
    else:
        opener = urllib.request.build_opener(*handlers)

    try:
        with opener.open(req, timeout=TIMEOUT) as resp:
            raw = resp.read(100_000)
            text = raw.decode("utf-8", errors="replace")
            return HttpResult(
                status=resp.status,
                headers={k.lower(): v for k, v in resp.headers.items()},
                body=text,
                url=resp.geturl(),
            )
    except urllib.error.HTTPError as err:
        raw = err.read(100_000)
        text = raw.decode("utf-8", errors="replace")
        return HttpResult(
            status=err.code,
            headers={k.lower(): v for k, v in err.headers.items()},
            body=text,
            url=url,
        )
    except (urllib.error.URLError, TimeoutError, OSError):
        return None


def check_reachable(findings: list[Finding], api: str) -> HttpResult | None:
    res = request("GET", join_url(api, "health"))
    if res is None:
        findings.append(Finding("CRIT", "API недоступна", f"Нет ответа от {join_url(api, 'health')}"))
        return None
    if res.status == 200:
        findings.append(Finding("OK", "API отвечает", f"GET /health → {res.status}"))
    else:
        findings.append(Finding("WARN", "Health не 200", f"GET /health → {res.status}"))
    return res


def check_https(findings: list[Finding], api: str) -> None:
    parsed = urllib.parse.urlparse(api)
    if parsed.scheme == "https":
        findings.append(Finding("OK", "HTTPS", "API использует защищённое соединение"))
        return
    if parsed.hostname in ("localhost", "127.0.0.1"):
        findings.append(Finding("INFO", "HTTP на localhost", "Для продакшена нужен HTTPS"))
        return
    findings.append(Finding("CRIT", "Нет HTTPS", "Публичный сайт должен работать только по https://"))


def check_security_headers(findings: list[Finding], label: str, url: str) -> None:
    res = request("GET", url)
    if res is None:
        findings.append(Finding("WARN", f"Заголовки ({label})", f"Нет ответа от {url}"))
        return

    h = res.headers
    recommended = {
        "strict-transport-security": "HSTS — браузер всегда использует HTTPS",
        "x-content-type-options": "Защита от MIME-sniffing",
        "x-frame-options": "Защита от clickjacking",
        "referrer-policy": "Контроль утечки URL в Referer",
    }
    for key, desc in recommended.items():
        if key in h:
            findings.append(Finding("OK", f"{label}: {key}", h[key][:120]))
        else:
            findings.append(Finding("WARN", f"{label}: нет {key}", desc))

    if "content-security-policy" in h:
        findings.append(Finding("OK", f"{label}: CSP", "Политика контента задана"))
    else:
        findings.append(
            Finding(
                "INFO",
                f"{label}: нет CSP",
                "В Minkert CSP в helmet отключена — для продакшена имеет смысл настроить",
            )
        )

    if "x-powered-by" in h:
        findings.append(Finding("WARN", f"{label}: X-Powered-By", "Лучше не раскрывать стек сервера"))


def check_auth_required(findings: list[Finding], api: str) -> None:
    url = join_url(api, "users/me")
    res = request("GET", url)
    if res is None:
        findings.append(Finding("WARN", "Защита API", f"Нет ответа от {url}"))
        return
    if res.status in (401, 403):
        findings.append(Finding("OK", "JWT защита", f"Без токена /users/me → {res.status}"))
    elif res.status == 200:
        findings.append(Finding("CRIT", "Утечка без авторизации", "/users/me отдаёт данные без токена"))
    else:
        findings.append(Finding("INFO", "Ответ без токена", f"/users/me → {res.status}"))


def check_cors(findings: list[Finding], api: str) -> None:
    evil = "https://evil-security-check.example"
    res = request(
        "OPTIONS",
        join_url(api, "health"),
        headers={
            "Origin": evil,
            "Access-Control-Request-Method": "GET",
        },
    )
    if res is None:
        findings.append(Finding("WARN", "CORS", "Не удалось проверить preflight"))
        return

    acao = res.headers.get("access-control-allow-origin", "")
    if acao == "*":
        findings.append(Finding("WARN", "CORS: Allow-Origin *", "Проверьте CORS_ORIGIN на бэкенде"))
    elif acao == evil:
        findings.append(Finding("CRIT", "CORS отражает чужой Origin", f"Разрешён Origin: {evil}"))
    elif acao:
        findings.append(Finding("OK", "CORS ограничен", f"Access-Control-Allow-Origin: {acao}"))
    else:
        findings.append(Finding("OK", "CORS", "Чужой Origin не принят"))


def check_sensitive_paths(findings: list[Finding], site_root: str) -> None:
    for p in (".env", ".git/HEAD", "backend/.env"):
        url = join_url(site_root, p)
        res = request("GET", url, allow_redirects=False)
        if res is None:
            continue
        if res.status == 200:
            if any(x in res.body for x in ("DATABASE_URL", "JWT_", "ref: refs/")):
                findings.append(Finding("CRIT", f"Открыт {p}", url))
            else:
                findings.append(Finding("WARN", f"Ответ 200 на {p}", f"Проверьте: {url}"))
        elif res.status in (401, 403, 404):
            findings.append(Finding("OK", f"Скрыт {p}", f"→ {res.status}"))


def check_bootstrap_closed(findings: list[Finding], api: str) -> None:
    res = request(
        "POST",
        join_url(api, "auth/bootstrap"),
        json_body={
            "email": "security-check@example.invalid",
            "password": "NotARealPassword1!",
            "name": "Security Check",
        },
    )
    if res is None:
        findings.append(Finding("WARN", "bootstrap", "Нет ответа"))
        return
    if res.status in (400, 403, 409, 422):
        findings.append(Finding("OK", "bootstrap закрыт", f"→ {res.status} (норма после seed)"))
    elif res.status in (200, 201):
        findings.append(
            Finding("CRIT", "Открыт bootstrap", "Можно создать первого админа — закройте после настройки")
        )
    else:
        findings.append(Finding("INFO", "bootstrap", f"→ {res.status}: {res.body[:180]}"))


def check_login_rate(findings: list[Finding], api: str) -> None:
    url = join_url(api, "auth/login")
    last = None
    for i in range(5):
        res = request("POST", url, json_body={"email": "nobody@example.com", "password": f"wrong-{i}"})
        if res:
            last = res.status
    if last == 429:
        findings.append(Finding("OK", "Rate limit на login", "После попыток → 429"))
    else:
        findings.append(
            Finding(
                "INFO",
                "Нет rate limit на login",
                "Для продакшена добавьте лимит (Cloudflare, nginx, @nestjs/throttler)",
            )
        )


def check_api_root(findings: list[Finding], api: str) -> None:
    parsed = urllib.parse.urlparse(api)
    root = f"{parsed.scheme}://{parsed.netloc}/"
    res = request("GET", root)
    if res and res.status == 200:
        try:
            body = json.loads(res.body)
            findings.append(Finding("INFO", "Корень API", json.dumps(body, ensure_ascii=False)[:200]))
        except json.JSONDecodeError:
            pass


def confirm_ownership(base: str, skip: bool) -> None:
    host = urllib.parse.urlparse(base).hostname or ""
    if skip or host in ("localhost", "127.0.0.1", "::1"):
        return
    print("\n⚠️  Проверяйте только СВОИ сайты или с письменным разрешением.")
    print(f"    URL: {base}")
    if input("Продолжить? (yes/no): ").strip().lower() not in ("yes", "y", "да"):
        print("Отменено.")
        sys.exit(0)


def print_report(findings: list[Finding]) -> int:
    icons = {"OK": "✅", "INFO": "ℹ️ ", "WARN": "⚠️ ", "CRIT": "❌"}
    order = {"CRIT": 0, "WARN": 1, "INFO": 2, "OK": 3}
    findings.sort(key=lambda f: (order.get(f.level, 9), f.title))

    print("\n" + "=" * 60)
    print("ОТЧЁТ ПРОВЕРКИ БЕЗОПАСНОСТИ")
    print("=" * 60)
    for f in findings:
        print(f"\n{icons.get(f.level, '•')} [{f.level}] {f.title}")
        print(f"   {f.detail}")

    crit = sum(1 for f in findings if f.level == "CRIT")
    warn = sum(1 for f in findings if f.level == "WARN")
    print("\n" + "-" * 60)
    print(f"Итого: критичных {crit}, предупреждений {warn}")
    print("Это базовая проверка. Глубже — Burp Suite + PortSwigger Academy.")
    return 2 if crit else (1 if warn else 0)


def main() -> None:
    parser = argparse.ArgumentParser(description="Проверка безопасности своего сайта Minkert")
    parser.add_argument("--url", required=True, help="URL API (http://localhost:3000 или продакшен)")
    parser.add_argument("--frontend", help="URL фронта (http://localhost:5173)")
    parser.add_argument("--yes", action="store_true", help="Без вопроса для публичных URL")
    args = parser.parse_args()

    base = normalize_base(args.url)
    api = api_base(base)
    frontend = normalize_base(args.frontend) if args.frontend else None

    confirm_ownership(base, args.yes)

    findings: list[Finding] = []
    checks: list[tuple[str, Callable[[], None]]] = [
        ("HTTPS", lambda: check_https(findings, api)),
        ("Health", lambda: check_reachable(findings, api)),
        ("Headers API", lambda: check_security_headers(findings, "API", join_url(api, "health"))),
        ("JWT", lambda: check_auth_required(findings, api)),
        ("CORS", lambda: check_cors(findings, api)),
        ("bootstrap", lambda: check_bootstrap_closed(findings, api)),
        ("Login", lambda: check_login_rate(findings, api)),
        ("Root", lambda: check_api_root(findings, api)),
    ]
    if frontend:
        checks.append(("Headers front", lambda: check_security_headers(findings, "Frontend", frontend)))
        checks.append(("Secrets front", lambda: check_sensitive_paths(findings, frontend)))

    origin = api.removesuffix("/api") if api.endswith("/api") else base
    checks.append(("Secrets", lambda: check_sensitive_paths(findings, origin)))

    for name, fn in checks:
        try:
            fn()
        except Exception as exc:
            findings.append(Finding("WARN", f"Сбой: {name}", str(exc)))

    sys.exit(print_report(findings))


if __name__ == "__main__":
    main()
