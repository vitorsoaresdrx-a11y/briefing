import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { findQuestion } from "@/lib/briefing/conditions";
import {
  AUDIO_BUCKET,
  AUDIO_MAX_BYTES,
  FILES_BUCKET,
  FILES_MAX_BYTES,
  baseMime,
  extForMime,
  isAudioMime,
  isFileMime,
} from "@/lib/briefing/media";
import { getBriefingByToken, notFound, serviceUnavailable } from "@/lib/briefing/server-helpers";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  bucket: z.enum([AUDIO_BUCKET, FILES_BUCKET]),
  question_id: z.string().min(1).max(80),
  file_name: z.string().min(1).max(200),
  mime_type: z.string().min(1).max(120),
  size: z.number().int().positive(),
});

/**
 * Emite signed upload URL para o navegador enviar direto ao Storage
 * (contorna o limite de ~4,5 MB da Vercel). Buckets seguem privados.
 * Caminho: <briefing_id>/<question_id>/<uuid>.<ext>
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const allowed = await checkRateLimit(`upload:${clientIp(req.headers)}`, 30, 60_000);
  if (!allowed) {
    return Response.json(
      { error: "Muitos envios. Aguarde um minuto e tente de novo." },
      { status: 429 },
    );
  }

  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    if (briefing.status === "concluido") {
      return Response.json({ error: "Este briefing já foi enviado." }, { status: 409 });
    }

    const { bucket, question_id, mime_type, size } = parsed.data;
    if (!findQuestion(question_id)) {
      return Response.json({ error: "Pergunta inválida." }, { status: 400 });
    }

    const isAudio = bucket === AUDIO_BUCKET;
    const limit = isAudio ? AUDIO_MAX_BYTES : FILES_MAX_BYTES;
    const mimeOk = isAudio ? isAudioMime(mime_type) : isFileMime(mime_type);
    if (!mimeOk) {
      return Response.json(
        { error: `Tipo de arquivo não aceito (${baseMime(mime_type)}).` },
        { status: 400 },
      );
    }
    if (size > limit) {
      const mb = Math.round(limit / (1024 * 1024));
      return Response.json({ error: `Arquivo passa de ${mb} MB.` }, { status: 400 });
    }

    const path = `${briefing.id}/${question_id}/${crypto.randomUUID()}.${extForMime(mime_type)}`;
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("signed upload falhou");

    return Response.json({ bucket, path: data.path, token: data.token });
  } catch (e) {
    return serviceUnavailable(e);
  }
}
