import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database";

/**
 * Cliente Supabase com a service role (ignora RLS).
 * SOMENTE servidor — nunca importar em código client.
 * Todo acesso do cliente (via token) e do admin passa pelas rotas de API.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase não configurado: preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.",
    );
  }
  cached = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
