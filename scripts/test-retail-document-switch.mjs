// Render the production CartDrawer in React DOM; network/App/Wholesale are synthetic.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const require = createRequire(import.meta.url);
const fixture = {
  checkoutCalls: 0,
  cart: [{
    productId: 'synthetic-product',
    quantity: 2,
    unitPrice: 50,
    product: { id: 'synthetic-product', name: 'Produto Fictício', sku: 'QA01',
      unit: 'UN', stock: 99, price: 50, wholesalePrice: null },
  }],
  isCartOpen: true,
};
globalThis.__retailQa = fixture;
const compiled = await build({
  entryPoints: ['src/components/storefront/CartDrawer.tsx'],
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{
    name: 'fake-external-boundaries',
    setup(b) {
      b.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({
        path: pathToFileURL(require.resolve(args.path)).href, external: true,
      }));
      b.onResolve({ filter: /AppContext|WholesaleAccessContext|AutomaticDeliveryEstimate|productImages|services\/orderService|customerTrackingService|orderWhatsAppMessage/ },
        args => ({ path: args.path, namespace: 'qa' }));
      b.onLoad({ filter: /.*/, namespace: 'qa' }, args => {
        if (args.path.includes('AppContext')) return { contents: 