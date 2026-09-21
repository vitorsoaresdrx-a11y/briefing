import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findQuestion } from "@/lib/briefing/conditions";
import { calcCompleteness } from "@/lib/briefing/completeness";
import { AUDIO_BUCKET, type AudioInfo } from "@/lib/briefing/media";
import type { Answers } from "@/lib/briefing/types";
import { runTranscription } from "@/lib/briefing/retranscribe";
import {
  getBriefingByToken,
  listMedia,
  notFound,
  serviceUnavailable,
} from "@/lib/briefing/server-helpers";

export const maxDuration = 60;

const audioSchema = z.object({
  question_id: z.string().min(1).max(80),
  storage_path: z.string().min(1).max(300),
  mime_type: z.string().min(1).max(120),
  duration_seconds: z.number().int().min(1).max(600).optional(),
});

const deleteSchema = z.object({
  audio_id: z.string().uuid(),
});

/**
 * Registra o áudio já enviado ao Storage e dispara a transcrição.
 * Em sucesso, preenche answers[question_id] com o texto (editável).
 * Em erro, mantém o áudio salvo e devolve transcribed: false.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const parsed = audioSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    if (briefing.status === "concluido") {
      return Response.json({ error: "Este briefing já foi enviado." }, { status: 409 });
    }

    const { question_id, storage_path, mime_type, duration_seconds } = parsed.data;
    if (!findQuestion(question_id)) {
      return Response.json({ error: "Pergunta inválida." }, { status: 400 });
    }
    if (!storage_path.startsWith(`${briefing.id}/`)) {
      return Response.json({ error: "Requisição inválida." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const dir = storage_path.split("/").slice(0, -1).join("/");
    const base = storage_path.split("/").pop() ?? "";
    const { data: listed, error: listError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .list(dir, { search: base });
    if (listError || !listed?.some((o) => o.name === base)) {
      return Response.json(
        { error: "Áudio não encontrado no storage. Grave de novo." },
        { status: 422 },
      );
    }

    const { data: row, error: insError } = await supabase
      .from("briefing_audios")
      .insert({
        briefing_id: briefing.id,
        question_id,
        storage_path,
        mime_type,
        duration_seconds: duration_seconds ?? null,
        transcript_status: "processando",
      })
      .select("id")
      .single();
    if (insError || !row) throw insError ?? new Error("insert de áudio falhou");
    const audioId = (row as { id: string }).id;

    const { transcript, transcribed, answers } = await runTranscription(supabase, briefing, audioId);
    const { audios } = await listMedia(supabase, briefing.id);
    return Response.json({ audioId, transcript, transcribed, answers, audios });
  } catch (e) {
    return serviceUnavailable(e);
  }
}

/** Remove um áudio do briefing (storage + registro). */
export async function DELETE(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    if (briefing.status === "concluido") {
      return Response.json({ error: "Este briefing já foi enviado." }, { status: 409 });
    }

    const supabase = createAdminClient();
    const { data: row } = await supabase
      .from("briefing_audios")
      .select("id, question_id, storage_path")
      .eq("id", parsed.data.audio_id)
      .eq("briefing_id", briefing.id)
      .maybeSingle();
    if (!row) return notFound();

    await supabase.storage.from(AUDIO_BUCKET).remove([row.storage_path]);
    await supabase.from("briefing_audios").delete().eq("id", row.id);

    const merged: Answers = { ...briefing.answers };
    const current = merged[row.question_id];
    if (current?.audioId === row.id) {
      merged[row.question_id] = {
        value: current.value,
        ...(current.skipped ? { skipped: true } : {}),
        ...(current.unknown ? { unknown: true } : {}),
      };
    }

    const { percent, pending } = calcCompleteness(merged);
    await supabase
      .from("briefings")
      .update({ answers: merged, completeness: percent, pending_fields: pending })
      .eq("id", briefing.id);

    const { audios } = await listMedia(supabase, briefing.id);
    return Response.json({ answers: merged, audios: audios as AudioInfo[] });
  } catch (e) {
    return serviceUnavailable(e);
  }
}
