import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getBriefingByToken,
  mergeAnswers,
  notFound,
  persistAnswers,
  serviceUnavailable,
} from "@/lib/briefing/server-helpers";
import { voiceAnswerFieldIds } from "@/lib/briefing/voice-script";
import { recordVoiceField } from "@/lib/voice/voice-audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Ids válidos para o parâmetro `campo` — os mesmos do wizard em texto,
 * incluindo uploads (que chegam pelo botão de envio da tela de voz).
 */
const FIELD_IDS = new Set(voiceAnswerFieldIds());

const storedFileSchema = z.object({
  name: z.string().min(1).max(200),
  size: z.number().int().nonnegative().max(50 * 1024 * 1024),
});

const bodySchema = z.object({
  campo: z.string().min(1).max(80),
  // texto | múltipla escolha e links | slider | arquivos enviados
  valor: z.union([
    z.string().max(15000),
    z.array(z.string().max(2000)).max(20),
    z.number().min(0).max(100),
    z.array(storedFileSchema).max(10),
  ]),
  // "Enviar depois" / pular um campo opcional pelo widget da tela.
  skipped: z.boolean().optional(),
});

/**
 * Persiste UMA resposta captada pela function call `salvar_resposta_briefing`
 * do briefing por voz. Usa exatamente o mesmo merge + recálculo de
 * completude + colunas desnormalizadas da rota PATCH do formulário em texto
 * (`mergeAnswers`/`persistAnswers`) — os dois canais gravam de forma idêntica
 * no mesmo `briefings.answers`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const allowed = await checkRateLimit(
    `voice-answer:${clientIp(req.headers)}`,
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
  if (!FIELD_IDS.has(parsed.data.campo)) {
    return Response.json({ error: "Campo desconhecido." }, { status: 400 });
  }

  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    if (briefing.status === "concluido") {
      return Response.json({ error: "Este briefing já foi enviado." }, { status: 409 });
    }

    const merged = mergeAnswers(briefing.answers, {
      [parsed.data.campo]: {
        value: parsed.data.valor,
        ...(parsed.data.skipped ? { skipped: true } : {}),
      },
    });
    const supabase = createAdminClient();
    const { percent, pending } = await persistAnswers(supabase, briefing, merged);

    // Auditoria (best-effort): não pode quebrar o salvamento da resposta.
    try {
      await recordVoiceField(supabase, briefing.id, parsed.data.campo);
    } catch {
      // noop
    }

    return Response.json({ ok: true, completeness: percent, pending_fields: pending });
  } catch (e) {
    return serviceUnavailable(e);
  }
}
