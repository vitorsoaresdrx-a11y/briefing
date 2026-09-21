import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findQuestion } from "@/lib/briefing/conditions";
import { calcCompleteness } from "@/lib/briefing/completeness";
import { FILES_BUCKET, FILES_MAX_BYTES, baseMime, isFileMime } from "@/lib/briefing/media";
import type { Answers } from "@/lib/briefing/types";
import {
  getBriefingByToken,
  listMedia,
  notFound,
  questionIdFromPath,
  serviceUnavailable,
} from "@/lib/briefing/server-helpers";

const fileSchema = z.object({
  question_id: z.string().min(1).max(80),
  storage_path: z.string().min(1).max(300),
  file_name: z.string().min(1).max(200),
  mime_type: z.string().min(1).max(120),
  size_bytes: z.number().int().positive(),
});

const deleteSchema = z.object({
  file_id: z.string().uuid(),
});

/** Registra um arquivo já enviado ao Storage em briefing_files. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const parsed = fileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    if (briefing.status === "concluido") {
      return Response.json({ error: "Este briefing já foi enviado." }, { status: 409 });
    }

    const { question_id, storage_path, file_name, mime_type, size_bytes } = parsed.data;
    const found = findQuestion(question_id);
    if (!found || found.question.type !== "file") {
      return Response.json({ error: "Pergunta inválida." }, { status: 400 });
    }
    if (!storage_path.startsWith(`${briefing.id}/`)) {
      return Response.json({ error: "Requisição inválida." }, { status: 400 });
    }
    if (!isFileMime(mime_type)) {
      return Response.json(
        { error: `Tipo de arquivo não aceito (${baseMime(mime_type)}).` },
        { status: 400 },
      );
    }
    if (size_bytes > FILES_MAX_BYTES) {
      return Response.json({ error: "Arquivo passa de 20 MB." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Confirma que o objeto existe no bucket.
    const dir = storage_path.split("/").slice(0, -1).join("/");
    const base = storage_path.split("/").pop() ?? "";
    const { data: listed, error: listError } = await supabase.storage
      .from(FILES_BUCKET)
      .list(dir, { search: base });
    if (listError || !listed?.some((o) => o.name === base)) {
      return Response.json(
        { error: "Arquivo não encontrado no storage. Envie de novo." },
        { status: 422 },
      );
    }

    const maxItems = found.question.maxItems ?? 5;
    const { data: existing } = await supabase
      .from("briefing_files")
      .select("storage_path")
      .eq("briefing_id", briefing.id);
    const sameQuestion = (existing ?? []).filter((o) =>
      o.storage_path.startsWith(`${briefing.id}/${question_id}/`),
    ).length;
    if (sameQuestion >= maxItems) {
      return Response.json({ error: `Limite de ${maxItems} arquivos.` }, { status: 422 });
    }

    const { data: row, error: insError } = await supabase
      .from("briefing_files")
      .insert({
        briefing_id: briefing.id,
        kind: found.question.fileKind ?? "outro",
        storage_path,
        file_name,
        mime_type,
        size_bytes,
      })
      .select("id")
      .single();
    if (insError || !row) throw insError ?? new Error("insert de arquivo falhou");

    const { files } = await listMedia(supabase, briefing.id);
    const mine = files.filter((f) => f.question_id === question_id);
    const merged: Answers = {
      ...briefing.answers,
      [question_id]: { value: mine.map((f) => ({ name: f.file_name, size: f.size_bytes ?? 0 })) },
    };
    const { percent, pending } = calcCompleteness(merged);
    await supabase
      .from("briefings")
      .update({ answers: merged, completeness: percent, pending_fields: pending })
      .eq("id", briefing.id);

    return Response.json(
      { file_id: (row as { id: string }).id, answers: merged, files },
      { status: 201 },
    );
  } catch (e) {
    return serviceUnavailable(e);
  }
}

/** Remove um arquivo do briefing (storage + registro). */
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
      .from("briefing_files")
      .select("id, storage_path")
      .eq("id", parsed.data.file_id)
      .eq("briefing_id", briefing.id)
      .maybeSingle();
    if (!row) return notFound();

    await supabase.storage.from(FILES_BUCKET).remove([row.storage_path]);
    await supabase.from("briefing_files").delete().eq("id", row.id);

    const { files } = await listMedia(supabase, briefing.id);
    const rowQuestion = questionIdFromPath(row.storage_path);
    const mine = files.filter((f) => f.question_id === rowQuestion);
    const merged: Answers = {
      ...briefing.answers,
      [rowQuestion]: { value: mine.map((f) => ({ name: f.file_name, size: f.size_bytes ?? 0 })) },
    };
    const { percent, pending } = calcCompleteness(merged);
    await supabase
      .from("briefings")
      .update({ answers: merged, completeness: percent, pending_fields: pending })
      .eq("id", briefing.id);

    return Response.json({ answers: merged, files });
  } catch (e) {
    return serviceUnavailable(e);
  }
}
