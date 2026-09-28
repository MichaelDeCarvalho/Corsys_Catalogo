import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Validação de UUID v4 simples para chaves de idempotência e identificadores
 */
function isValidUuid(uuid: string): boolean {
  if (typeof uuid !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid.trim());
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return new Response(
      JSON.stringify({ error: "Content-Type deve ser application/json." }),
      { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const rawBody = await req.text();
    // Proteção de tamanho de payload (máximo 64 KB para acomodar até 200 itens)
    if (rawBody.length > 65536) {
      return new Response(
        JSON.stringify({ error: "Tamanho de requisição excede o limite permitido (64 KB)." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "JSON malformado no corpo da requisição." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Defesa Anti-Abuso: Honeypot check
    if (payload.website || payload._honeypot || payload.fax) {
      // Simula sucesso imediato para bots automatizados sem disparar escrita
      return new Response(
        JSON.stringify({ success: true, message: "Pedido processado com sucesso." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Extração e validação do tenantSlug
    const tenantSlug = typeof payload.tenantSlug === "string" ? payload.tenantSlug.trim() : "";
    if (!tenantSlug) {
      return new Response(
        JSON.stringify({ error: "Identificador da loja (tenantSlug) é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validação da Chave de Idempotência
    const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey.trim() : "";
    if (!idempotencyKey || !isValidUuid(idempotencyKey)) {
      return new Response(
        JSON.stringify({ error: "Chave de idempotência (idempotencyKey UUID) é obrigatória." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Modalidade de Compra
    const shoppingMode = typeof payload.shoppingMode === "string" ? payload.shoppingMode.trim() : "retail";
    if (shoppingMode !== "retail" && shoppingMode !== "wholesale") {
      return new Response(
        JSON.stringify({ error: "Modalidade de compra inválida (deve ser 'retail' ou 'wholesale')." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Validação de Itens
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return new Response(
        JSON.stringify({ error: "O pedido deve conter pelo menos um item." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.items.length > 200) {
      return new Response(
        JSON.stringify({ error: "O pedido excede o limite máximo permitido de 200 itens." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Dados de Cliente e Entrega
    const customer = (payload.customer && typeof payload.customer === "object") ? payload.customer : null;
    if (!customer) {
      return new Response(
        JSON.stringify({ error: "Dados do cliente são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shippingAddress = (payload.shippingAddress && typeof payload.shippingAddress === "object") ? payload.shippingAddress : null;
    if (!shippingAddress) {
      return new Response(
        JSON.stringify({ error: "Endereço de entrega é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Método de Pagamento e Entrega
    const paymentMethod = typeof payload.paymentMethod === "string" ? payload.paymentMethod.trim() : "";
    if (!paymentMethod) {
      return new Response(
        JSON.stringify({ error: "Forma de pagamento é obrigatória." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deliveryMethod = typeof payload.deliveryMethod === "string" ? payload.deliveryMethod.trim() : "";
    if (!deliveryMethod) {
      return new Response(
        JSON.stringify({ error: "Método de entrega é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notes = typeof payload.notes === "string" ? payload.notes.trim() : null;
    const sellerCode = typeof payload.sellerCode === "string" ? payload.sellerCode.trim() : null;

    // 8. Resolução de Autenticação para Atacado B2B vs Varejo
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[submit-order-checkout] Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.");
      return new Response(
        JSON.stringify({ error: "Serviço de checkout indisponível no momento." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    let buyerUserId: string | null = null;

    if (shoppingMode === "wholesale") {
      const authHeader = req.headers.get("authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Pedidos na modalidade Atacado exigem autenticação do comprador (Bearer token obrigatório)." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "").trim();
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

      if (userError || !userData?.user?.id) {
        return new Response(
          JSON.stringify({ error: "Sessão de autenticação inválida ou expirada para pedido de atacado." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // O buyerUserId vem exclusivamente da sessão comprovada no Supabase Auth (nunca do body)
      buyerUserId = userData.user.id;
    }

    // 9. Chamada à RPC Transacional com service_role
    const { data: orderResult, error: rpcError } = await supabaseAdmin.rpc(
      "create_order_checkout_internal",
      {
        p_tenant_slug: tenantSlug,
        p_idempotency_key: idempotencyKey,
        p_shopping_mode: shoppingMode,
        p_items: payload.items,
        p_customer: customer,
        p_shipping_address: shippingAddress,
        p_payment_method: paymentMethod,
        p_delivery_method: deliveryMethod,
        p_notes: notes,
        p_seller_code: sellerCode,
        p_buyer_user_id: buyerUserId,
      }
    );

    if (rpcError) {
      console.warn(`[submit-order-checkout] Erro de negócio ou validação na RPC: ${rpcError.message} (${rpcError.code || 'ERR'})`);
      return new Response(
        JSON.stringify({ error: rpcError.message || "Falha ao processar pedido de compra." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: orderResult,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno no processamento do pedido.";
    console.error(`[submit-order-checkout] Exceção não tratada: ${errorMsg}`);
    return new Response(
      JSON.stringify({ error: "Erro interno no servidor ao processar o pedido." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
