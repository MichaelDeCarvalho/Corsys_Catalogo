#!/usr/bin/env python3
"""Read-only Chromium/Playwright smoke test against a *local isolated* QA stack.

Independent of Bun/CI: requires Python Playwright + a local Chromium installation.
NEVER set QA_BASE_URL or QA_SUPABASE_URL to hosted/production environments.
No fixture creation, order checkout, PDF download, or WhatsApp navigation.
"""
from __future__ import annotations

import os
import re
import sys
from urllib.parse import urlsplit

try:
    from playwright.sync_api import sync_playwright, expect
except ImportError:
    sys.exit("BLOCKED: install Python Playwright in isolated QA environment (pip install playwright).")

LOOPBACK = {"localhost", "127.0.0.1", "::1"}
STATUSES = {
    "pending": "Cadastro atacadista em análise.",
    "suspended": "Acesso atacadista temporariamente indisponível.",
    "rejected": "Cadastro atacadista não aprovado.",
}


def require_loopback(key: str) -> str:
    value = os.getenv(key, "").strip()
    parsed = urlsplit(value)
    if (parsed.scheme not in ("http", "https") or parsed.hostname not in LOOPBACK or parsed.port is None
            or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        sys.exit(f"BLOCKED: {key} must be an explicitly configured loopback HTTP(S) URL; no hosted access.")
    return value


def require_fixture(state: str) -> tuple[str, str]:
    prefix = "QA_B2B_" + state.upper()
    email = os.getenv(prefix + "_EMAIL", "").strip()
    password = os.getenv(prefix + "_PASSWORD", "")
    if not email or not password:
        sys.exit(f"BLOCKED: missing synthetic QA fixture: {prefix}_EMAIL / {prefix}_PASSWORD.")
    return email, password


def guarded_context(browser, storefront_url: str, backend_url: str):
    """Abort HTTP(S) requests outside the exact two approved local QA origins."""
    allowed = {(urlsplit(url).scheme, urlsplit(url).netloc) for url in (storefront_url, backend_url)}
    ctx = browser.new_context(accept_downloads=False)
    unexpected: list[str] = []

    def route_request(route):
        parsed = urlsplit(route.request.url)
        if parsed.scheme in ("http", "https") and (parsed.scheme, parsed.netloc) not in allowed:
            unexpected.append(parsed.hostname or "unknown")  # No path, token or PII
            route.abort("blockedbyclient")
        else:
            route.continue_()

    ctx.route("**/*", route_request)
    page = ctx.new_page()
    requests: list[str] = []
    page.on(
        "request",
        lambda request: requests.append("private-catalog")
        if "get-wholesale-catalog" in request.url else None,
    )
    return ctx, page, requests, unexpected


def verify_safe(requests, unexpected):
    assert not unexpected, "Attempted non-loopback network call(s) blocked by QA security gate"
    assert not requests, "Non-approved account attempted a private wholesale catalog request"


def main() -> int:
    frontend = require_loopback("QA_BASE_URL")
    backend = require_loopback("QA_SUPABASE_URL")
    if urlsplit(frontend).port == urlsplit(backend).port and urlsplit(frontend).hostname == urlsplit(backend).hostname:
        sys.exit("BLOCKED: frontend and Supabase QA need distinct endpoints.")
    fixtures = {status: require_fixture(status) for status in STATUSES}
    browser_bin = os.getenv("QA_CHROMIUM_EXECUTABLE", "").strip()
    results: list[tuple[str, str]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True, executable_path=browser_bin or None,
        )
        try:
            ctx, page, requests, unexpected = guarded_context(browser, frontend, backend)
            try:
                page.goto(frontend, wait_until="domcontentloaded", timeout=20000)
                expect(page.locator("#btn-mode-wholesale")).to_be_visible(timeout=20000)
                page.locator("#btn-mode-wholesale").click()
                expect(page.locator("#b2b-gate-modal")).to_be_visible(timeout=7000)
                expect(page.locator("#btn-mode-retail")).to_have_class(
                    re.compile(".*bg-white.*"), timeout=7000,
                )
                verify_safe(requests, unexpected)
                results.append(("B2B-01 (anônimo)", "PASS"))
            finally:
                ctx.close()

            for state, (email, password) in fixtures.items():
                ctx, page, requests, unexpected = guarded_context(browser, frontend, backend)
                try:
                    page.goto(frontend, wait_until="domcontentloaded", timeout=20000)
                    expect(page.locator("#btn-mode-wholesale")).to_be_visible(timeout=20000)
                    page.locator("#btn-mode-wholesale").click()
                    page.locator("#btn-b2b-already-have-access").click()
                    page.locator('input[type="email"]').fill(email)
                    page.locator('input[type="password"]').fill(password)
                    # Request is observed before the login click to avoid missing an early response.
                    with page.expect_response(
                        lambda r: (r.url.startswith(backend.rstrip("/") + "/rest/v1/rpc/get_my_wholesale_status")
                                   and r.request.method == "POST"),
                        timeout=25000,
                    ) as status_response:
                        page.get_by_role("button", name="Entrar no Sistema").click()
                    assert status_response.value.ok, "The status RPC did not succeed"
                    returned = status_response.value.json()
                    assert isinstance(returned, dict) and returned.get("status") == state, "Unexpected QA buyer status"
                    expect(page.locator("#btn-mode-wholesale")).to_be_visible(timeout=15000)
                    if state == "pending":
                        expect(page.locator("#btn-mode-wholesale")).to_contain_text("Em análise")
                    page.locator("#btn-mode-wholesale").click()
                    expect(page.get_by_text(STATUSES[state], exact=False)).to_be_visible(timeout=10000)
                    expect(page.locator("#btn-mode-retail")).to_have_class(
                        re.compile(".*bg-white.*"), timeout=7000,
                    )
                    verify_safe(requests, unexpected)
                    results.append((f"B2B-02 ({state})", "PASS"))
                finally:
                    ctx.close()
        finally:
            browser.close()

    for case, result in results:
        print(f"{case}: {result}")
    print("QA browser: read-only smoke cases completed; remaining B2B-03–13 NOT EVALUATED by this script.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        # Avoid printing exception data containing URLs, tokens or personal details.
        print(f"FAIL/BLOCKED: {type(error).__name__}; see local-only QA trace for diagnosis.", file=sys.stderr)
        raise SystemExit(1)
