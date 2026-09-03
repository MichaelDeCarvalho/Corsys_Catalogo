import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function initSupabaseClient(): SupabaseClient {
  const missing: string[] = [];

  if (!supabaseUrl || supabaseUrl.trim() === '' || supabaseUrl === 'YOUR_SUPABASE_URL') {
    missing.push('VITE_SUPABASE_URL');
  }

  if (
    !supabasePublishableKey ||
    supabasePublishableKey.trim() === '' ||
    supabasePublishableKey === 'YOUR_SUPABASE_PUBLISHABLE_KEY'
  ) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `[Supabase Client] Configuração ausente ou não inicializada: ${missing.join(', ')}. ` +
      'Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente para estabelecer a conexão.'
    );
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!clientInstance) {
    clientInstance = initSupabaseClient();
  }
  return clientInstance;
};

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
