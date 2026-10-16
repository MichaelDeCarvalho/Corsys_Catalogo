#!/usr/bin/env python3
"""B2B-12: revoke approved buyer in disposable local DB and verify real Edge deny.

Only synthetic identities. Never logs JWTs, order bodies, documents or URLs.
Must run AFTER all positive B2B order audits, as it intentionally suspends A.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from uuid import uuid4
from playwright.sync_api import sync_playwright
from test_b2b_access_browser import require_fixture, require_loopback


def main() -> None:
    frontend = require_loopback("QA_BASE_URL")
    backend = require_loopback("QA_SUPABASE_URL")
    if (os.getenv("GITHUB_ACTIONS") != "true"
            or os.getenv("QA_CONFIRM_DISPOSABLE_STACK") != "yes"
            or os.getenv("QA_ALLOW_SYNTHETIC_LOCAL_ORDER") != "yes"
            or backend != "http://127.0.0.1:54321"
            or any(os.getenv(key) for key in (
                "SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID", "SUPABASE_DB_PASSWORD"
            )) or frontend == backend):
        sys.exit("BLOCKED: local, unlinked, synthetic QA required")

    anon = os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY", "")
    if not anon or len(anon) < 20:
        sys.exit("BLOCKED: local-only public API key missing")
    buyer_a = require_fixture("approved_a")
    buyer_b = require_fixture("approved_b")
    containers = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}"],
        check=True, capture_output=True, text=True,
    ).stdout.splitlines()
    local_dbs = [name for name in containers if re.fullmatch(r"supabase_db_[A-Za-z0-9_-]+", name)]
    if len(local_dbs) != 1:
        sys.exit("BLOCKED: expected exactly one disposable local Postgres")

    with sync_playwright() as p:
        api = p.request.new_context(base_url=backend, extra_http_headers={"apikey": anon})
        try:
            def login(fixture: tuple[str, str]) -> str:
                r = api.post("/auth/v1/token?grant_type=password", data={
                    "email": fixture[0], "password": fixture[1]
                }, max_redirects=0, timeout=20000)
                assert r.status == 200, "Synthetic buyer login failed"
                jwt = r.json().get("access_token")
                assert isinstance(jwt, str) and jwt, "Auth did not return synthetic JWT"
                return jwt

            jwt_a, jwt_b = login(buyer_a), login(buyer_b)

            def post_edge(token: str, name: str, body: dict):
                return api.post(
                    "/functions/v1/" + name,
                    headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
                    data=json.dumps(body), max_redirects=0, timeout=25000,
                )

            allowed_a = post_edge(jwt_a, "get-wholesale-catalog",
                                  {"tenantSlug": "corsys-catalogo-demo"})
            assert allowed_a.status == 200, "Approved A has no authorized private catalog"
            items = allowed_a.json().get("items", [])
            assert len(items) == 1 and items[0].get("sku") == "QA-A"
            product_id = items[0].get("productId")
            assert isinstance(product_id, str), "QA product ID absent"

            rejected_b = post_edge(jwt_b, "get-wholesale-catalog",
                                   {"tenantSlug": "corsys-catalogo-demo"})
            assert rejected_b.status == 403, "Tenant B buyer could access tenant A pricing"

            # Negative replay: an idempotency key must never act as authority
            # to retrieve an order from a different buyer or tenant. It is
            # extracted only inside the disposable test DB and never logged.
            query = """SELECT idempotency_key::text FROM public.orders
                       WHERE shopping_mode='wholesale'
                         AND tenant_id=(SELECT id FROM public.tenants
                                        WHERE slug='corsys-catalogo-demo')
                       ORDER BY created_at LIMIT 1;"""
            prior_key = subprocess.run(
                ["docker", "exec", "-i", local_dbs[0], "psql", "-U", "postgres",
                 "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", query],
                capture_output=True, text=True, check=True,
            ).stdout.strip()
            assert re.fullmatch(r"[a-f0-9-]{36}", prior_key), "No synthetic replay key"
            cross_buyer_replay = post_edge(jwt_b, "submit-order-checkout", {
                "tenantSlug": "corsys-catalogo-demo",
                "idempotencyKey": prior_key,
                "shoppingMode": "wholesale",
                "items": [{"productId": product_id, "quantity": 5,
                           "selectedVariant": None}],
                "customer": {"email": "tenant-b@qa.invalid"},
                "shippingAddress": {"street": "Rua Fictícia QA",
                                    "city": "Curitiba"},
                "paymentMethod": "pix",
                "deliveryMethod": "retirada",
            })
            assert cross_buyer_replay.status == 403, (
                "Cross-tenant idempotency replay bypassed buyer authorization"
            )

            # Mutation is deliberately performed against ONLY the disposable
            # postgres container after A's legitimate orders have been audited.
            sql = """DO $qa$
DECLARE changed integer;
BEGIN
  UPDATE public.wholesale_customers SET status='suspended'
  WHERE tenant_id=(SELECT id FROM public.tenants WHERE slug='corsys-catalogo-demo')
    AND user_id=(SELECT id FROM auth.users WHERE email='qa-b2b-approved@qa.invalid')
    AND status='approved';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'Expected exactly one QA buyer suspended'; END IF;
END $qa$;"""
            subprocess.run(
                ["docker", "exec", "-i", local_dbs[0], "psql", "-U", "postgres",
                 "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
                input=sql, capture_output=True, text=True, check=True,
            )

            rejected_a = post_edge(jwt_a, "get-wholesale-catalog",
                                   {"tenantSlug": "corsys-catalogo-demo"})
            assert rejected_a.status == 403, "Revoked A still reads private wholesale prices"

            attempted = post_edge(jwt_a, "submit-order-checkout", {
                "tenantSlug": "corsys-catalogo-demo",
                "idempotencyKey": str(uuid4()),
                "shoppingMode": "wholesale",
                "items": [{"productId": product_id, "quantity": 5, "selectedVariant": None}],
                "customer": {"email": "revoked@qa.invalid"},
                "shippingAddress": {"street": "Rua Fictícia QA", "city": "Curitiba"},
                "paymentMethod": "pix",
                "deliveryMethod": "retirada",
            })
            assert attempted.status == 403, "Revoked A created an unauthorized B2B checkout"

            verify = """DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.orders) <> 3 THEN
    RAISE EXCEPTION 'Revoked buyer caused an unexpected order';
  END IF;
  IF (SELECT count(*) FROM public.orders o JOIN public.tenants t ON t.id=o.tenant_id
      WHERE t.slug='tenant-qa-b') <> 0 THEN
    RAISE EXCEPTION 'Tenant B isolation failed';
  END IF;
END $qa$;"""
            subprocess.run(
                ["docker", "exec", "-i", local_dbs[0], "psql", "-U", "postgres",
                 "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
                input=verify, capture_output=True, text=True, check=True,
            )
            print("LOCAL-B2B-12 PASS: A before revoke 200; tenant B 403; revoked A catalog and checkout 403; DB order count unchanged", flush=True)
        finally:
            api.dispose()


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print("LOCAL-B2B-12 FAIL/BLOCKED: " + type(err).__name__, file=sys.stderr)
        raise SystemExit(1)
