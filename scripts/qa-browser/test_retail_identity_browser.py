#!/usr/bin/env python3
"""Read-only PF/PJ browser regression using isolated, loopback-only QA storefront.

This intentionally stops BEFORE submitting an order or opening WhatsApp.
It verifies visible interaction, not checkout persistence or tracking.
"""
from __future__ import annotations

import re
import sys

from playwright.sync_api import sync_playwright, expect
from test_b2b_access_browser import guarded_context, require_loopback


def main() -> int:
    frontend = require_loopback("QA_BASE_URL")
    backend = require_loopback("QA_SUPABASE_URL")
    if frontend == backend:
        sys.exit("BLOCKED: frontend and Supabase must use separate local QA endpoints.")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            ctx, page, private_catalog_requests, rejected_origins = guarded_context(browser, frontend)
            order_requests: list[str] = []
            page.on(
                "request",
                lambda req: order_requests.append("checkout")
                if "submit-order-checkout" in req.url else None,
            )
            try:
                page.goto(frontend, wait_until="domcontentloaded", timeout=20000)
                expect(page.locator("#btn-mode-retail")).to_be_visible(timeout=20000)
                add = page.get_by_role("button", name=re.compile(r"^Adicionar \(\d+ [^)]+\)$")).first
                expect(add).to_be_enabled(timeout=20000)
                add.click()
                expect(page.locator("#floating-open-cart-btn")).to_be_visible(timeout=10000)
                page.locator("#floating-open-cart-btn").click()
                proceed = page.locator("#btn-cart-proceed")
                expect(proceed).to_be_enabled(timeout=10000)
                proceed.click()
                pj = page.get_by_role("button", name="Pessoa Jurídica (CNPJ)")
                pf = page.get_by_role("button", name="Pessoa Física (CPF)")
                expect(pj).to_be_visible()
                expect(pf).to_be_visible()

                # PF => document CPF, without a retail-PJ company name input.
                pf.click()
                expect(page.get_by_placeholder("000.000.000-00")).to_be_visible()
                expect(page.get_by_placeholder("Supermercado Silva Ltda")).to_have_count(0)

                # PJ => document CNPJ + company name input.
                pj.click()
                expect(page.get_by_placeholder("00.000.000/0001-00")).to_be_visible()
                expect(page.get_by_placeholder("Supermercado Silva Ltda")).to_be_visible()

                # Reversing buyer type must remove the PJ-only field.
                pf.click()
                expect(page.get_by_placeholder("000.000.000-00")).to_be_visible()
                expect(page.get_by_placeholder("Supermercado Silva Ltda")).to_have_count(0)

                assert not private_catalog_requests, "Retail UI attempted a private wholesale catalog request"
                assert not order_requests, "Read-only PF/PJ test must not submit an order"
                assert not rejected_origins, "Non-local network request attempted; route blocked"
                print("B2B-13 PF/PJ browser UI: PASS (local QA only; no checkout, tracking, WhatsApp or PDF).")
            finally:
                ctx.close()
        finally:
            browser.close()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"FAIL/BLOCKED: {type(error).__name__}; inspect local QA without logging credentials.", file=sys.stderr)
        raise SystemExit(1)
