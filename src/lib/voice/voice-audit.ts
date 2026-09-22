import "server-only";
import type { AdminClient } from "@/lib/briefing/server-helpers";

export type VoiceSessionRow = {
  id: string;
  transcript: string;
  fields_saved: string[];
  created_at: string;
  ended_at: string | null;
};

/** Sessão de voz aberta mais recente do briefing (ainda sem `ended_at`). */
async function findOpenVoiceSession(
  supabase: AdminClient,
  briefingId: string,
): Promise<VoiceSessionRow | null> {
  const { data, error } = await supabase
    .from("briefing_voice_sessions")
    .select("id, transcript, fields_saved, created_at, ended_at")
    .eq("briefing_id", briefingId)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Garante uma linha de sessão aberta (cria se não houver) e devolve o id. */
async function ensureOpenVoiceSession(
  supabase: AdminClient,
  briefingId: string,
): Promise<string> {
  const open = await findOpenVoiceSession(supabase, briefingId);
  if (open) return open.id;
  const { data, error } = await supabase
    .from("briefing_voice_sessions")
    .insert({ briefing_id: briefingId })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert falhou");
  return data.id;
}

/**
 * Registra um campo gravado via function call na sessão de voz aberta.
 * Best-effort para auditoria: nunca deve quebrar o salvamento da resposta.
 */
export async function recordVoiceField(
  supabase: AdminClient,
  briefingId: string,
  campo: string,
): Promise<void> {
  const id = await ensureOpenVoiceSession(supabase, briefingId);
  const { data } = await supabase
    .from("briefing_voice_sessions")
    .select("fields_saved")
    .eq("id", id)
    .single();
  const current: string[] = Array.isArray(data?.fields_saved) ? data.fields_saved : [];
  if (current.includes(campo)) return;
  const { error } = await supabase
    .from("briefing_voice_sessions")
    .update({ fields_saved: [...current, campo] })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Substitui a transcrição da sessão aberta pela versão completa enviada
 * pelo navegador. Substituição (não append) de propósito: é idempotente,
 * então snapshots repetidos ou reenviados nunca duplicam o texto.
 */
export async function saveVoiceTranscript(
  supabase: AdminClient,
  briefingId: string,
  transcript: string,
  ended: boolean,
): Promise<void> {
  const id = await ensureOpenVoiceSession(supabase, briefingId);
  const { error } = await supabase
    .from("briefing_voice_sessions")
    .update({
      transcript,
      ...(ended ? { ended_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Sessões de voz de um briefing, da mais recente para a mais antiga. */
export async function listVoiceSessions(
  supabase: AdminClient,
  briefingId: string,
): Promise<VoiceSessionRow[]> {
  const { data, error } = await supabase
    .from("briefing_voice_sessions")
    .select("id, transcript, fields_saved, created_at, ended_at")
    .eq("briefing_id", briefingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
