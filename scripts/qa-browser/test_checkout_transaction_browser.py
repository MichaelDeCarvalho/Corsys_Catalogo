#!/usr/bin/env python3
"""One real fictitious checkout in disposable local Supabase; no WhatsApp message sent.

Tests local Auth/Edge/Postgres and closes the neutral popup before external navigation.
Never point this test to hosted systems or use a real recipient.
"""
from __future__ import annotations

import os
import re
import sys
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, expect
from test_b2b_access_browser import guarded_context, require_loopback, verify_safe


def main() -> None:
    frontend = require_loopback("QA_BASE_URL")
    backend = require_loopback("QA_SUPABASE_URL")
    if (os.getenv("GITHUB_ACTIONS") != "true"
            or os.getenv("QA_CONFIRM_DISPOSABLE_STACK") != "yes"
            or os.getenv("QA_ALLOW_SYNTHETIC_LOCAL_ORDER") != "yes"
            or os.getenv("SUPABASE_ACCESS_TOKEN")
            or os.getenv("SUPABASE_PROJECT_ID")):
        sys.exit("BLOCKED: local-only disposable synthetic-order authorization missing")
    if urlsplit(frontend).netloc == urlsplit(backend).netloc:
        sys.exit("BLOCKED: frontend and backend must use distinct loopback origins")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        try:
            ctx, page, private, external = guarded_context(browser, frontend, backend)
            submits: list[str] = []
            popups: list[str] = []

            def observe_request(req):
                if (req.url.startswith(backend.rstrip("/") + "/functions/v1/submit-order-checkout")
                        and req.method == "POST"):
                    submits.append("submit")

            def close_neutral_popup(popup):
                popups.append("closed")
                # Closing about:blank before navigation prevents sending any WhatsApp message.
                popup.close()

            ctx.on("request", observe_request)
            page.on("popup", close_neutral_popup)
            try:
                page.goto(frontend, wait_until="domcontentloaded", timeout=25000)
                expect(page.get_by_text("Loja Oficial QA", exact=True).first).to_be_visible(timeout=25000)
                add = page.get_by_role("button", name=re.compile(r"^Adicionar \(\d+ [^)]+\)$")).first
                add.click()
                page.locator("#floating-open-cart-btn").click()
                page.locator("#btn-cart-proceed").click()
                page.get_by_placeholder("Nome completo").fill("Comprador Fictício QA")
                page.get_by_placeholder("00.000.000/0001-00").fill("11.222.333/0001-81")
                page.get_by_label("Razão social (varejo PJ)").fill("Empresa Fictícia QA")
                page.get_by_label("E-mail", exact=True).fill("comprador@qa.invalid")
                page.get_by_label("Cidade", exact=True).fill("Curitiba")
                page.get_by_placeholder("Ex: 41987654321").fill("41999999999")
                page.get_by_label("Logradouro", exact=True).fill("Rua Fictícia QA")
                page.locator("#btn-validate-quote").click()
                expect(page.locator("#btn-submit-order")).to_be_enabled(timeout=10000)

                print("LOCAL-ORDER: submitting one fictitious PJ retail order", flush=True)
                with page.expect_response(
                    lambda r: (r.url.startswith(backend.rstrip("/") + "/functions/v1/submit-order-checkout")
                               and r.request.method == "POST"), timeout=45000
                ) as completion:
                    page.locator("#btn-submit-order").click()
                response = completion.value
                print("LOCAL-ORDER: Edge HTTP", response.status, flush=True)
                assert response.status == 201, "Local Edge checkout did not return 201"
                body = response.json()
                receipt = body.get("order", {}) if isinstance(body, dict) else {}
                assert body.get("success") is True and receipt.get("orderNumber"), "Missing server receipt"
                assert receipt.get("shoppingMode") == "retail", "Incorrect checkout mode"
                assert receipt.get("items") and receipt.get("total") > 0, "Receipt missing canonical items"
                expect(page.get_by_text("Pedido registrado. Clique novamente para abrir o WhatsApp.", exact=False)).to_be_visible(timeout=15000)
                assert len(submits) == 1 and len(popups) == 1, "Expected one order and closed neutral popup"

                print("LOCAL-ORDER: retrying the same order after closing popup", flush=True)
                page.locator("#btn-submit-order").click()
                expect(page.get_by_text("Pedido registrado. Clique novamente para abrir o WhatsApp.", exact=False)).to_be_visible(timeout=12000)
                assert len(submits) == 1 and len(popups) == 2, "Retry duplicated order or failed to open neutral popup"

                print("LOCAL-ORDER: changing buyer contact before retry", flush=True)
                page.get_by_role("button", name="Voltar e editar").click()
                page.get_by_placeholder("Ex: 41987654321").fill("41988888888")
                page.locator("#btn-validate-quote").click()
                page.locator("#btn-submit-order").click()
                expect(page.get_by_text("O pedido anterior já foi registrado com outros dados.", exact=False)).to_be_visible(timeout=12000)
                assert len(submits) == 1, "Modified draft attempted another order"
                verify_safe(private, external)
                print("LOCAL-ORDER: PASS real Edge/Postgres receipt, closed popup, idempotent retry, stale draft denied; no WhatsApp sent", flush=True)
            finally:
                ctx.close()
        finally:
            browser.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        # No URLs, tokens, customer PII or message contents in CI logs.
        print("LOCAL-ORDER: FAIL/BLOCKED (" + type(err).__name__ + ")", file=sys.stderr)
        raise SystemExit(1)
