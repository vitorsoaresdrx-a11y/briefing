import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseAdminEmails } from "./admin-emails";

/**
 * Sessão admin (Supabase Auth + allowlist ADMIN_EMAILS).
 * Retorna o e-mail ou null. Nunca lança (páginas decidem redirect).
 */
export async function getAdminSession(): Promise<{ email: string } | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email?.trim().toLowerCase();
    if (!email) return null;
    if (!parseAdminEmails(process.env.ADMIN_EMAILS).includes(email)) return null;
    return { email };
  } catch {
    return null;
  }
}
