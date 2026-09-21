import { createAdminClient } from "@/lib/supabase/admin";
import type { BriefingRow, BriefingStatus } from "@/lib/supabase/database";
import type { Answers } from "@/lib/briefing/types";
import { AUDIO_BUCKET, FILES_BUCKET, type AudioInfo, type FileInfo } from "./media";

export const TOKEN_RE = /^[0-9a-f]{48}$/i;

export type { BriefingRow, BriefingStatus };

export function notFound() {
  return Response.json({ error: "Não encontrado." }, { status: 404 });
}

export function serviceUnavailable(message?: unknown) {
  const detail = message instanceof Error ? message.message : null;
  return Response.json(
    { error: detail ?? "Serviço temporariamente indisponível. Tente de novo em instantes." },
    { status: 500 },
  );
}

export async function getBriefingByToken(token: string): Promise<BriefingRow | null> {
  if (!TOKEN_RE.test(token)) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("briefings")
    .select(
      "id, token, client_name, client_email, client_whatsapp, company, project_type, niche, status, current_step, answers, completeness, pending_fields, completed_at",
    )
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return data as BriefingRow;
}

function textValue(answers: Answers, id: string): string | null {
  const v = answers[id]?.value;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Colunas desnormalizadas (lista do admin, filtros) a partir das respostas. */
export function denormalizedColumns(answers: Answers) {
  return {
    client_name: textValue(answers, "name"),
    client_email: textValue(answers, "email"),
    client_whatsapp: textValue(answers, "whatsapp"),
    company: textValue(answers, "company"),
    project_type: textValue(answers, "project_type"),
    niche: textValue(answers, "niche"),
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** Pergunta derivada do path <briefing_id>/<question_id>/<arquivo>. */
export function questionIdFromPath(storagePath: string): string {
  const parts = storagePath.split("/");
  return parts.length >= 3 ? parts[1] : "";
}

async function signUrl(
  supabase: AdminClient,
  bucket: string,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Áudios e arquivos do briefing com URLs de leitura curtas (60 s). */
export async function listMedia(
  supabase: AdminClient,
  briefingId: string,
): Promise<{ audios: AudioInfo[]; files: FileInfo[] }> {
  const [{ data: audios }, { data: files }] = await Promise.all([
    supabase
      .from("briefing_audios")
      .select("id, question_id, mime_type, duration_seconds, transcript_status, storage_path")
      .eq("briefing_id", briefingId)
      .order("created_at", { ascending: true }),
    supabase
      .from("briefing_files")
      .select("id, file_name, mime_type, size_bytes, kind, storage_path")
      .eq("briefing_id", briefingId)
      .order("created_at", { ascending: true }),
  ]);

  const audiosOut: AudioInfo[] = await Promise.all(
    (audios ?? []).map(async (a) => ({
      id: a.id,
      question_id: a.question_id,
      mime_type: a.mime_type,
      duration_seconds: a.duration_seconds,
      transcript_status: a.transcript_status,
      url: await signUrl(supabase, AUDIO_BUCKET, a.storage_path),
    })),
  );
  const filesOut: FileInfo[] = await Promise.all(
    (files ?? []).map(async (f) => ({
      id: f.id,
      question_id: questionIdFromPath(f.storage_path),
      file_name: f.file_name,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      kind: f.kind,
      url: await signUrl(supabase, FILES_BUCKET, f.storage_path),
    })),
  );
  return { audios: audiosOut, files: filesOut };
}
