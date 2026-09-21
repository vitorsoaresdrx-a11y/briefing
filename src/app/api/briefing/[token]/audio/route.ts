import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findQuestion } from "@/lib/briefing/conditions";
import { calcCompleteness } from "@/lib/briefing/completeness";
import {
  AUDIO_BUCKET,
  type AudioInfo,
} from "@/lib/briefing/media";
import type { Answers } from "@/lib/briefing/types";
import { transcribe } from "@/lib/transcribe";
import {
  denormalizedColumns,
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

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "erro desconhecido";
}

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
    const { data: blob, error: dlError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .download(storage_path);
    if (dlError || !blob) {
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

    let transcript: string | null = null;
    let transcribed = false;
    try {
      const ext = (mime_type.split(";")[0].trim().split("/")[1] ?? "webm").toLowerCase();
      transcript = await transcribe(blob, `audio.${ext}`);
      if (transcript === "") throw new Error("não detectei fala nesse áudio");
      transcribed = true;
    } catch (e) {
      await supabase
        .from("briefing_audios")
        .update({ transcript_status: "erro", transcript_error: errMsg(e).slice(0, 500) })
        .eq("id", audioId);
    }

    const merged: Answers = { ...briefing.answers };
    if (transcribed && transcript) {
      await supabase
        .from("briefing_audios")
        .update({ transcript, transcript_status: "concluido" })
        .eq("id", audioId);
      merged[question_id] = { value: transcript, audioId };
    } else {
      const prev = merged[question_id];
      merged[question_id] = { value: prev && !prev.skipped && !prev.unknown ? prev.value : null, audioId };
    }

    const { percent, pending } = calcCompleteness(merged);
    await supabase
      .from("briefings")
      .update({
        answers: merged,
        completeness: percent,
        pending_fields: pending,
        ...denormalizedColumns(merged),
      })
      .eq("id", briefing.id);

    const { audios } = await listMedia(supabase, briefing.id);
    return Response.json({ audioId, transcript, transcribed, answers: merged, audios });
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
