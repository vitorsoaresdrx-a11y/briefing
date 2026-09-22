import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBriefingByToken, notFound, serviceUnavailable } from "@/lib/briefing/server-helpers";
import { saveVoiceTranscript } from "@/lib/voice/voice-audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  /** Transcrição completa acumulada no navegador (a rota SUBSTITUI, nunca anexa). */
  transcript: z.string().max(200000),
  /** true no encerramento da sessão (preenche `ended_at`). */
  ended: z.boolean().optional(),
});

/**
 * Recebe snapshots da transcrição da sessão de voz (texto fornecido pela
 * própria Live API) e guarda na trilha de auditoria
 * (`briefing_voice_sessions`), vinculada ao mesmo briefing.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const allowed = await checkRateLimit(
    `voice-transcript:${clientIp(req.headers)}`,
    120,
    5 * 60_000,
  );
  if (!allowed) {
    return Response.json(
      { error: "Muitas tentativas. Aguarde um pouco e tente de novo." },
      { status: 429 },
    );
  }

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

  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();

    const supabase = createAdminClient();
    await saveVoiceTranscript(
      supabase,
      briefing.id,
      parsed.data.transcript,
      parsed.data.ended ?? false,
    );
    return Response.json({ ok: true });
  } catch (e) {
    return serviceUnavailable(e);
  }
}
