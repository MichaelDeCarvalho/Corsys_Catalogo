// Verify both synthetic orders using a privileged client ONLY in disposable local CI.
import { createClient } from '@supabase/supabase-js';

if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.QA_CONFIRM_DISPOSABLE_STACK !== 'yes' ||
    process.env.QA_ALLOW_SYNTHETIC_LOCAL_ORDER !== 'yes' ||
    process.env.QA_SUPABASE_URL !== 'http://127.0.0.1:54321' ||
    !process.env.QA_LOCAL_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ACCESS_TOKEN ||
    process.env.SUPABASE_PROJECT_ID ||
    process.env.SUPABASE_DB_PASSWORD) {
  throw new Error('BLOCKED: local-only database verification cannot run against Hosted');
}
const client = createClient(process.env.QA_SUPABASE_URL, process.env.QA_LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: tenants, error: tenantsErr } = await client.from('tenants')
  .select('id,slug').in('slug', ['corsys-catalogo-demo', 'tenant-qa-b']);
if (tenantsErr || tenants?.length !== 2) throw new Error('Synthetic tenant verification failed');
const tenantA = tenants.find(t => t.slug === 'corsys-catalogo-demo')?.id;
const tenantB = tenants.find(t => t.slug === 'tenant-qa-b')?.id;
if (!tenantA || !tenantB || tenantA === tenantB) throw new Error('Invalid synthetic tenant isolation');

const { data: orders, error: ordersErr } = await client.from('orders')
  .select('id,tenant_id,order_number,shopping_mode,status,total,buyer_user_id');
if (ordersErr || orders?.length !== 2) {
  console.log('LOCAL-B2B DB diagnostic', {
    db_error_code: ordersErr?.code || null,
    result_count: orders?.length ?? null,
  });
  throw new Error('Expected exactly two local orders');
}
const retail = orders.find(o => o.shopping_mode === 'retail');
const wholesale = orders.find(o => o.shopping_mode === 'wholesale');
if (!retail || !wholesale || retail.id === wholesale.id ||
    orders.some(o => o.tenant_id !== tenantA || o.status !== 'pending' || !o.order_number) ||
    retail.buyer_user_id ||
    !wholesale.buyer_user_id || Number(wholesale.total) !== 100 ||
    !(Number(retail.total) > 0)) {
  throw new Error('Local order mode, buyer, tenant or server total invariant failed');
}
const { data: buyer, error: buyerErr } = await client.from('wholesale_customers')
  .select('user_id,tenant_id,status').eq('user_id', wholesale.buyer_user_id).single();
if (buyerErr || !buyer || buyer.tenant_id !== tenantA || buyer.status !== 'approved') {
  throw new Error('Wholesale order has no approved matching local buyer');
}
const { data: cross, error: crossErr } = await client.from('orders')
  .select('id').eq('tenant_id', tenantB);
if (crossErr || cross?.length !== 0) throw new Error('Synthetic tenant B has unexpected orders');
console.log('LOCAL-B2B DB PASS: one retail and one wholesale order in tenant A; approved buyer, pending status, canonical total and zero orders in tenant B');
