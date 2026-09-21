import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcCompleteness } from "./completeness";
import { AUDIO_BUCKET, baseMime } from "./media";
import { denormalizedColumns, type AdminClient, type BriefingRow } from "./server-helpers";
import { transcribe } from "@/lib/transcribe";
import type { Answers } from "./types";

/**
 * Baixa o áudio do Storage, transcreve e anexa o texto às respostas.
 * Usado pelo registro do cliente e pelo "reenviar transcrição" do admin.
 */
export async function runTranscription(
  supabase: AdminClient,
  briefing: BriefingRow,
  audioId: string,
): Promise<{ transcript: string | null; transcribed: boolean; answers: Answers }> {
  const { data: audio } = await supabase
    .from("briefing_audios")
    .select("id, question_id, storage_path, mime_type")
    .eq("id", audioId)
    .eq("briefing_id", briefing.id)
    .maybeSingle();
  if (!audio) throw new Error("Áudio não encontrado.");

  await supabase
    .from("briefing_audios")
    .update({ transcript_status: "processando", transcript_error: null })
    .eq("id", audioId);

  const fail = async (message: string) => {
    await supabase
      .from("briefing_audios")
      .update({ transcript_status: "erro", transcript_error: message.slice(0, 500) })
      .eq("id", audioId);
    const merged: Answers = { ...briefing.answers };
    const prev = merged[audio.question_id];
    merged[audio.question_id] = {
      value: prev && !prev.skipped && !prev.unknown ? prev.value : null,
      audioId,
    };
    await persistAnswers(supabase, briefing.id, merged);
    return { transcript: null as string | null, transcribed: false, answers: merged };
  };

  const { data: blob, error: dlError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .download(audio.storage_path);
  if (dlError || !blob) return fail("Áudio não encontrado no storage.");

  let transcript: string;
  try {
    const ext = (baseMime(audio.mime_type ?? "audio/webm").split("/")[1] ?? "webm").toLowerCase();
    transcript = await transcribe(blob, `audio.${ext}`);
    if (transcript === "") throw new Error("não detectei fala nesse áudio");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "falha na transcrição");
  }

  await supabase
    .from("briefing_audios")
    .update({ transcript, transcript_status: "concluido", transcript_error: null })
    .eq("id", audioId);

  const merged: Answers = { ...briefing.answers, [audio.question_id]: { value: transcript, audioId } };
  await persistAnswers(supabase, briefing.id, merged);
  return { transcript, transcribed: true, answers: merged };
}

export async function persistAnswers(
  supabase: AdminClient,
  briefingId: string,
  answers: Answers,
): Promise<{ percent: number; pending: string[] }> {
  const { percent, pending } = calcCompleteness(answers);
  const { error } = await supabase
    .from("briefings")
    .update({
      answers,
      completeness: percent,
      pending_fields: pending,
      ...denormalizedColumns(answers),
    })
    .eq("id", briefingId);
  if (error) throw error;
  return { percent, pending };
}

export function adminClient() {
  return createAdminClient();
}
