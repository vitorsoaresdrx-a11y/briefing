import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";

/**
 * Contador de briefings concluídos ainda não lidos pelo admin.
 * Polling a cada 30 s pelo painel (sem Realtime, sem abrir policies).
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("briefings")
      .select("id", { count: "exact", head: true })
      .eq("status", "concluido")
      .is("viewed_at", null);

    const { data: latest } = await supabase
      .from("briefings")
      .select("id, client_name, company")
      .eq("status", "concluido")
      .is("viewed_at", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return Response.json({
      count: count ?? 0,
      latest: latest
        ? {
            id: latest.id as string,
            client_name: latest.client_name as string | null,
            company: latest.company as string | null,
          }
        : null,
    });
  } catch {
    return Response.json({ error: "Falha ao contar." }, { status: 500 });
  }
}
