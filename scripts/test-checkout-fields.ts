import assert from 'node:assert/strict';
import { DEFAULT_CHECKOUT_FIELDS, parseCheckoutFields, checkoutRequiredErrors, projectCheckoutValues } from '../src/config/checkoutFields';

const defaults = () => structuredClone(DEFAULT_CHECKOUT_FIELDS);
assert.deepEqual(parseCheckoutFields(defaults()), defaults());
for (const bad of [null, [], {}, { ...defaults(), total: { visible: true, required: true } },
  { ...defaults(), email: { visible: false, required: true } },
  { ...defaults(), email: { visible: 'false', required: false } },
  { ...defaults(), name: { visible: false, required: false } },
  { ...defaults(), email: { visible: true, required: false, label: 'Injected' } }]) {
  assert.throws(() => parseCheckoutFields(bad));
}
const config = defaults();
config.email = { visible: true, required: true };
config.city = { visible: true, required: true };
config.companyName = { visible: true, required: true };
config.notes = { visible: false, required: false };
const values = { type: 'PF', name: 'Teste', document: '52998224725', phone: '41999999999', street: 'Rua teste', email: ' ', city: '', companyName: 'valor antigo', notes: 'valor oculto', paymentMethod: 'pix' };
assert.deepEqual(Object.keys(checkoutRequiredErrors(config, values, false)), ['email', 'city']);
assert.deepEqual(Object.keys(checkoutRequiredErrors(config, { ...values, type: 'PJ', companyName: '' }, false)), ['companyName', 'email', 'city']);
assert.deepEqual(Object.keys(checkoutRequiredErrors(config, { ...values, type: 'PJ', companyName: '' }, true)), ['email', 'city']);
const projected = projectCheckoutValues(config, values, false);
assert.equal(projected.notes, ''); assert.equal(projected.companyName, '');
assert.equal(projected.paymentMethod, 'pix'); assert.equal(values.notes, 'valor oculto');
assert.equal(checkoutRequiredErrors(config, { ...values, email: 'a@b.invalid', city: 'Curitiba' }, false).email, undefined);
// Fixed core remains mandatory only when buyer enters it; wholesale uses approved identity.
assert.deepEqual(Object.keys(checkoutRequiredErrors(defaults(), { type: 'PF' }, false)), ['name', 'phone', 'document', 'street']);
assert.deepEqual(Object.keys(checkoutRequiredErrors(defaults(), { type: 'PJ' }, true)), ['street']);
console.log('Checkout fields: parser, required rules, PF/PJ/B2B and hidden-value projection PASS');

// B2B integration-contract tests (pure functions only; no browser, network or order creation).
// Commercial identity is always derived server-side; browser may send operational contact only.
import { buildCheckoutRequestBody, computeOrderFingerprint, type SubmitOrderCheckoutDraft } from '../src/services/orderService';

const wholesalePolicy = defaults();
wholesalePolicy.email = { visible: false, required: false };
wholesalePolicy.notes = { visible: false, required: false };
wholesalePolicy.city = { visible: true, required: true };
const rawWholesaleForm = {
  type: 'PJ', name: 'Dados forjados', document: '12345678000195',
  companyName: 'Razão social forjada', phone: '41999999999',
  street: 'Rua de teste', city: '', email: 'oculto@example.invalid',
  notes: 'observações ocultas', sellerCode: 'VEN-01', paymentMethod: 'pix'
};
const wholesaleRequired = checkoutRequiredErrors(wholesalePolicy, rawWholesaleForm, true);
assert.deepEqual(Object.keys(wholesaleRequired), ['city'],
  'B2B exige somente campos aplicáveis e configurados, sem exigir identidade comercial no browser');

const safeWholesaleForm = projectCheckoutValues(wholesalePolicy, rawWholesaleForm, true);
assert.equal(safeWholesaleForm.companyName, '');
assert.equal(safeWholesaleForm.email, '');
assert.equal(safeWholesaleForm.notes, '');
assert.equal(rawWholesaleForm.companyName, 'Razão social forjada', 'Projeção não altera entrada original');

const idempotencyKey = '11111111-1111-4111-8111-111111111111';
const wholesaleDraft: SubmitOrderCheckoutDraft = {
  tenantSlug: 'tenant-qa-a',
  shoppingMode: 'wholesale',
  items: [{ productId: '11111111-1111-4111-8111-111111111112', quantity: 3 }],
  customer: {
    name: 'Cliente comercial falso', document: '12345678000195',
    companyName: 'Razão social falsa', type: 'PJ',
    email: '  operacional@example.invalid  ', phone: ' 41988889999 '
  },
  shippingAddress: { street: ' Rua de teste ', city: 'Curitiba', number: ' 100 ' },
  paymentMethod: 'pix',
  deliveryMethod: 'retirada'
};
const canonicalB2bBody = buildCheckoutRequestBody(wholesaleDraft, idempotencyKey);
assert.deepEqual(canonicalB2bBody.customer, {
  email: 'operacional@example.invalid', phone: '41988889999'
}, 'B2B não encaminha name, document, companyName nem type fornecidos pelo navegador');
assert.deepEqual(canonicalB2bBody.items, [{
  productId: '11111111-1111-4111-8111-111111111112',
  quantity: 3, selectedVariant: null
}], 'B2B envia apenas identidade do produto, quantidade e variante, sem valores financeiros');
assert.equal(canonicalB2bBody.shoppingMode, 'wholesale');
assert.equal(canonicalB2bBody.tenantSlug, 'tenant-qa-a');
assert.equal((canonicalB2bBody.shippingAddress as Record<string, unknown>).street, 'Rua de teste');

const tamperedDraft = {
  ...wholesaleDraft,
  userId: 'another-user',
  tenantId: 'another-tenant',
  total: 0.01,
  wholesalePrice: 0.01,
  items: [{ ...wholesaleDraft.items[0], price: 0.01, costPrice: 0 }]
} as SubmitOrderCheckoutDraft;
assert.deepEqual(buildCheckoutRequestBody(tamperedDraft, idempotencyKey), canonicalB2bBody,
  'Allowlist descarta chaves extras de autoridade financeira, tenant e usuário');
assert.deepEqual(
  buildCheckoutRequestBody({ ...wholesaleDraft, customer: undefined }, idempotencyKey).customer,
  {},
  'Contato operacional não informado gera customer: {} no atacado'
);
assert.throws(() => buildCheckoutRequestBody({
  ...wholesaleDraft, items: [{ ...wholesaleDraft.items[0], quantity: 0 }]
}, idempotencyKey), 'Quantidade nula não entra no payload');
assert.throws(() => buildCheckoutRequestBody({
  ...wholesaleDraft, customer: { email: 123 }
} as unknown as SubmitOrderCheckoutDraft, idempotencyKey), 'Tipo incorreto de e-mail operacional falha fechado');
assert.throws(() => buildCheckoutRequestBody({
  ...wholesaleDraft, shippingAddress: { street: '  ' }
}, idempotencyKey), 'Endereço obrigatório em branco falha fechado');

wholesalePolicy.email = { visible: true, required: true };
assert.equal(
  checkoutRequiredErrors(wholesalePolicy, { ...rawWholesaleForm, email: ' ', city: 'Curitiba' }, true).email,
  'E-mail é obrigatório.',
  'Regra required configurável também se aplica ao contato operacional no B2B'
);
assert.deepEqual(
  checkoutRequiredErrors(wholesalePolicy, { ...rawWholesaleForm, email: 'contato@example.invalid', city: 'Curitiba' }, true),
  {},
  'Regra required aceita os campos B2B aplicáveis preenchidos'
);

const actorA = '41840000-0000-4000-8000-000000000005';
const actorB = '41840000-0000-4000-8000-000000000006';
const fingerprintA = await computeOrderFingerprint(wholesaleDraft, actorA);
assert.equal(fingerprintA, await computeOrderFingerprint(wholesaleDraft, actorA),
  'Mesma intenção e mesmo comprador produzem fingerprint determinístico para retry');
assert.notEqual(fingerprintA, await computeOrderFingerprint(wholesaleDraft, actorB),
  'Compradores diferentes não compartilham fingerprint');
assert.notEqual(fingerprintA, await computeOrderFingerprint({ ...wholesaleDraft, tenantSlug: 'tenant-qa-b' }, actorA),
  'Tenants diferentes não compartilham fingerprint');
assert.notEqual(fingerprintA, await computeOrderFingerprint({
  ...wholesaleDraft, items: [{ ...wholesaleDraft.items[0], quantity: 4 }]
}, actorA), 'Mudança de quantidade invalida o fingerprint anterior');
console.log('B2B checkout contract: allowlist, optional/required, operational contact, tampering and actor/tenant fingerprint PASS');

