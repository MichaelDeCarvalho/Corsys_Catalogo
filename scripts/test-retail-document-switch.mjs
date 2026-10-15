// Real CartDrawer rendered by React DOM; Auth/App/network are synthetic.
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
    productId: 'synthetic-product', quantity: 2, unitPrice: 50,
    product: {
      id: 'synthetic-product', name: 'Produto Fictício', sku: 'QA01',
      unit: 'UN', stock: 99, price: 50, wholesalePrice: null,
    },
  }],
  isCartOpen: true,
};
globalThis.__retailQa = fixture;
const compiled = await build({
  entryPoints: ['src/components/storefront/CartDrawer.tsx'],
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{
    name: 'fake-boundaries',
    setup(b) {
      b.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({
        path: pathToFileURL(require.resolve(args.path)).href, external: true,
      }));
      b.onResolve({
        filter: /AppContext|WholesaleAccessContext|AutomaticDeliveryEstimate|productImages|services\/orderService|customerTrackingService|orderWhatsAppMessage/,
      }, args => ({ path: args.path, namespace: 'qa' }));
      b.onLoad({ filter: /.*/, namespace: 'qa' }, args => {
        if (args.path.includes('AppContext')) return {
          contents: "const f=globalThis.__retailQa; export const useApp=()=>({cart:f.cart,isCartOpen:f.isCartOpen,cartSubtotal:100,updateCartQuantity:()=>{},removeFromCart:()=>{},clearCart:()=>{},setIsCartOpen:v=>{f.isCartOpen=v},showToast:()=>{}});"
        };
        if (args.path.includes('WholesaleAccessContext')) return {
          contents: "export const useWholesaleAccess=()=>({purchaseMode:'retail',isApproved:false,wholesaleCompany:null});"
        };
        if (args.path.includes('AutomaticDeliveryEstimate')) return {
          contents: "export const AutomaticDeliveryEstimate=()=>null;"
        };
        if (args.path.includes('productImages')) return {
          contents: "export const getSafeProductImage=()=>'';export const handleProductImageError=()=>{};"
        };
        if (args.path.includes('orderService')) return {
          contents: "export class OrderCheckoutError extends Error {};export const submitOrderCheckout=()=>{globalThis.__retailQa.checkoutCalls++;throw Error('unexpected order submission')};"
        };
        if (args.path.includes('customerTrackingService')) return {
          contents: "export const storeRetailOrderTracking=()=>{throw Error('unexpected tracking')};"
        };
        return { contents: "export const buildOrderWhatsAppMessage=()=>{throw Error('unexpected WhatsApp')};" };
      });
    },
  }],
});
const { CartDrawer } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64')
);
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://qa.invalid' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const root = createRoot(document.getElementById('root'));
const settings = {
  slug: 'qa-synthetic', publicName: 'Loja Fictícia QA',
  deliveryMethods: ['retirada'], whatsappNumber: '',
  minOrderValue: 0, wholesaleMinOrderValue: 100, allowB2bMode: false,
};
const render = () => act(async () => root.render(React.createElement(CartDrawer, { settings })));
async function click(selector) {
  const button = document.querySelector(selector);
  assert.ok(button, 'Missing UI action: ' + selector);
  await act(async () => button.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
}
const docInput = () => document.querySelector(
  'input[placeholder="000.000.000-00"], input[placeholder="00.000.000/0001-00"]'
);
async function typeDocument(value) {
  const input = docInput();
  assert.ok(input);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
}
async function chooseBuyerType(label) {
  const target = [...document.querySelectorAll('button')].find(
    node => node.textContent.trim() === label
  );
  assert.ok(target, 'Missing buyer type button: ' + label);
  await act(async () => target.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
}
try {
  await render();
  await click('#btn-cart-proceed');
  assert.equal(docInput()?.getAttribute('placeholder'), '00.000.000/0001-00');
  await typeDocument('12.345.678/0001-99');
  assert.equal(docInput().value, '12.345.678/0001-99');
  await chooseBuyerType('Pessoa Física (CPF)');
  assert.equal(docInput()?.getAttribute('placeholder'), '000.000.000-00');
  assert.equal(docInput().value, '', 'Switch PJ to PF must clear old CNPJ');
  assert.equal(document.querySelector('input[placeholder="Supermercado Silva Ltda"]'), null);
  await typeDocument('529.982.247-25');
  assert.equal(docInput().value, '529.982.247-25');
  await chooseBuyerType('Pessoa Jurídica (CNPJ)');
  assert.equal(docInput()?.getAttribute('placeholder'), '00.000.000/0001-00');
  assert.equal(docInput().value, '', 'Switch PF to PJ must clear old CPF');
  assert.ok(document.querySelector('input[placeholder="Supermercado Silva Ltda"]'));
  assert.equal(fixture.checkoutCalls, 0);
  console.log('Retail PF/PJ DOM PASS: incompatible document cleared, visibility correct, no order; synthetic boundaries.');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
  delete globalThis.__retailQa;
}
