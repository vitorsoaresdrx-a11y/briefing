"use server";

import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BriefingStatus } from "@/lib/supabase/database";
import { getAdminSession } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { runTranscription } from "@/lib/briefing/retranscribe";

async function guard() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
}

/** Gera um link de briefing, opcionalmente pré-preenchendo nome/empresa. */
export async function createBriefingLink(input: { clientName?: string; company?: string }): Promise<{
  ok: boolean;
  token?: string;
  error?: string;
}> {
  await guard();
  const name = (input.clientName ?? "").trim().slice(0, 200);
  const company = (input.company ?? "").trim().slice(0, 200);
  try {
    const supabase = createAdminClient();
    const answers: Record<string, { value: string }> = {};
    if (name) answers["name"] = { value: name };
    if (company) answers["company"] = { value: company };
    const { data, error } = await supabase
      .from("briefings")
      .insert({
        client_name: name || null,
        company: company || null,
        answers,
      })
      .select("token")
      .single();
    if (error || !data) throw error ?? new Error("insert falhou");
    revalidatePath("/admin");
    return { ok: true, token: (data as { token: string }).token };
  } catch {
    return { ok: false, error: "Não foi possível criar o link. Tente de novo." };
  }
}

/** Troca o status de um briefing. */
export async function setBriefingStatus(
  id: string,
  status: "rascunho" | "em_andamento" | "concluido",
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  try {
    const supabase = createAdminClient();
    const patch: { status: BriefingStatus; completed_at?: string | null; viewed_at?: string | null } = {
      status,
    };
    if (status === "concluido") {
      patch.completed_at = new Date().toISOString();
      patch.viewed_at = null;
    }
    const { error } = await supabase.from("briefings").update(patch).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin");
    revalidatePath(`/admin/briefings/${id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível atualizar o status." };
  }
}

/** Reprocessa a transcrição de um áudio (usa a chave do servidor). */
export async function retryAudioTranscription(
  briefingId: string,
  audioId: string,
): Promise<{ ok: boolean; error?: string }> {
  await guard();
  try {
    const supabase = createAdminClient();
    const { data: briefing } = await supabase
      .from("briefings")
      .select(
        "id, token, client_name, client_email, client_whatsapp, company, project_type, niche, status, current_step, answers, completeness, pending_fields, created_at, updated_at, completed_at, viewed_at",
      )
      .eq("id", briefingId)
      .maybeSingle();
    if (!briefing) return { ok: false, error: "Briefing não encontrado." };
    await runTranscription(supabase, briefing, audioId);
    revalidatePath(`/admin/briefings/${briefingId}`);
    revalidatePath(`/admin/briefings/${briefingId}/print`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Falha ao transcrever. Confira a chave do provedor e tente de novo." };
  }
}
