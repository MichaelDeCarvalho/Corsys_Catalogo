#!/usr/bin/env python3
"""B2B checkout with real local Auth/Edge/Postgres in disposable CI; no external messaging."""
from __future__ import annotations

import os
import re
import sys
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright
from test_b2b_access_browser import guarded_context, require_fixture, require_loopback, verify_safe


def main() -> None:
    frontend = require_loopback("QA_BASE_URL")
    backend = require_loopback("QA_SUPABASE_URL")
    if (os.getenv("GITHUB_ACTIONS") != "true"
            or os.getenv("QA_CONFIRM_DISPOSABLE_STACK") != "yes"
            or os.getenv("QA_ALLOW_SYNTHETIC_LOCAL_ORDER") != "yes"
            or os.getenv("SUPABASE_ACCESS_TOKEN")
            or os.getenv("SUPABASE_PROJECT_ID")
            or os.getenv("SUPABASE_DB_PASSWORD")
            or urlsplit(frontend).netloc == urlsplit(backend).netloc):
        sys.exit("BLOCKED: disposable loopback QA authorization missing")
    email, password = require_fixture("approved_a")
    endpoint = backend.rstrip("/") + "/functions/v1/submit-order-checkout"

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        try:
            ctx, page, private_catalog, external = guarded_context(browser, frontend, backend)
            submissions = []
            ctx.on("request", lambda req: submissions.append("submit")
                   if req.method == "POST" and req.url.startswith(endpoint) else None)
            # Close only the neutral window, synchronously, before checkout returns.
            # Any attempt to open an external destination fails the test.
            page.add_init_script("""(() => {
                window.__qaClosedCount = 0;
                const nativeOpen = window.open.bind(window);
                window.open = (url, target, features) => {
                    if (url !== 'about:blank' || target !== '_blank') {
                        throw new Error('unexpected popup destination');
                    }
                    const popup = nativeOpen(url, target, features);
                    if (popup) { popup.close(); window.__qaClosedCount++; }
                    return popup;
                };
            })();""")
            try:
                page.goto(frontend, wait_until="domcontentloaded", timeout=25000)
                expect(page.locator("#btn-mode-wholesale")).to_be_visible(timeout=25000)
                page.locator("#btn-mode-wholesale").click()
                page.locator("#btn-b2b-already-have-access").click()
                page.locator('input[type="email"]').fill(email)
                page.locator('input[type="password"]').fill(password)
                with page.expect_response(
                    lambda r: r.url.startswith(backend.rstrip("/") + "/rest/v1/rpc/get_my_wholesale_status")
                    and r.request.method == "POST", timeout=25000
                ) as login_result:
                    page.get_by_role("button", name="Entrar no Sistema").click()
                assert login_result.value.ok and login_result.value.json().get("status") == "approved"
                expect(page.locator("#btn-mode-wholesale")).to_contain_text("Liberado", timeout=15000)
                page.locator("#btn-mode-wholesale").click()
                expect(page.get_by_text("R$ 20,00").first).to_be_visible(timeout=15000)
                assert private_catalog, "Approved account never requested its private catalog"
                add = page.get_by_role(
                    "button", name=re.compile(r"^Adicionar Atacado \(\d+ [^)]+\)$")
                ).first
                expect(add).to_be_enabled()
                add.click()
                page.locator("#floating-open-cart-btn").click()
                page.locator("#btn-cart-proceed").click()
                expect(page.get_by_placeholder("Nome completo")).to_have_count(0)
                page.get_by_label("E-mail", exact=True).fill("buyer@qa.invalid")
                page.get_by_label("Cidade", exact=True).fill("Curitiba")
                page.get_by_label("Logradouro", exact=True).fill("Rua Fictícia QA")
                page.locator("#btn-validate-quote").click()
                expect(page.locator("#btn-submit-order")).to_be_enabled(timeout=10000)

                with page.expect_response(
                    lambda r: r.url.startswith(endpoint) and r.request.method == "POST",
                    timeout=45000,
                ) as result:
                    page.locator("#btn-submit-order").click()
                response = result.value
                assert response.status == 201, "Wholesale Edge checkout did not return 201"
                payload = response.json()
                receipt = payload.get("order", {}) if isinstance(payload, dict) else {}
                assert payload.get("success") is True
                assert receipt.get("orderNumber") and receipt.get("shoppingMode") == "wholesale"
                assert receipt.get("status") == "pending"
                assert receipt.get("items") and receipt["items"][0].get("quantity") == 5
                assert float(receipt["items"][0]["unitPrice"]) == 20
                assert float(receipt["total"]) == 100, "Wholesale total was not server-authoritative"
                expect(page.get_by_text(
                    "Pedido registrado. Clique novamente para abrir o WhatsApp.", exact=False
                )).to_be_visible(timeout=12000)
                assert len(submissions) == 1 and page.evaluate("window.__qaClosedCount") == 1

                # The buyer may retry WhatsApp handoff without recreating the order.
                page.locator("#btn-submit-order").click()
                expect(page.get_by_text(
                    "Pedido registrado. Clique novamente para abrir o WhatsApp.", exact=False
                )).to_be_visible(timeout=12000)
                assert len(submissions) == 1 and page.evaluate("window.__qaClosedCount") == 2

                # Same authenticated user must see the official persisted B2B order in tracking.
                page.get_by_title("Fechar carrinho").click()
                with page.expect_response(
                    lambda r: "list-my-customer-orders" in r.url and r.request.method == "POST",
                    timeout=30000,
                ) as tracking:
                    page.locator("#header-my-orders-button").click()
                assert tracking.value.ok, "B2B tracking gateway rejected approved buyer"
                expect(page.get_by_text("Histórico de Atacado")).to_be_visible(timeout=12000)
                expect(page.get_by_text("#" + receipt["orderNumber"])).to_be_visible(timeout=12000)
                page.get_by_role("button", name=re.compile(r"Pedidos Recentes de Varejo")).click()
                expect(page.get_by_text("#" + receipt["orderNumber"])).to_have_count(0)
                verify_safe([], external)  # Private-catalog requests are expected for approved buyers.
                print("LOCAL-B2B: PASS Auth/Edge checkout, canonical R$100, one submission, retry, B2B tracking and retail separation; no WhatsApp sent", flush=True)
            finally:
                ctx.close()
        finally:
            browser.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        # Exception values may contain URLs, customer data, JWTs or tokens: never print them.
        print("LOCAL-B2B: FAIL/BLOCKED (" + type(err).__name__ + ")", file=sys.stderr)
        raise SystemExit(1)
