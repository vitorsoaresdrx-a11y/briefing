import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { getBriefingByToken, notFound, serviceUnavailable } from "@/lib/briefing/server-helpers";
import { createLiveEphemeralToken } from "@/lib/voice/live-token";

/**
 * Emite um token efêmero do Gemini Live API para o cliente abrir, direto do
 * navegador, uma conexão WebSocket com o Google — sem passar a GEMINI_API_KEY
 * pelo frontend e sem manter nenhum proxy/servidor persistente no nosso lado.
 *
 * O prompt de sistema, as ferramentas e o modelo já vêm travados dentro do
 * token (veja src/lib/voice/live-token.ts), então o navegador não tem como
 * alterar o roteiro nem as regras de conversa, mesmo tendo o token em mãos.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const allowed = await checkRateLimit(`voice-token:create:${clientIp(req.headers)}`, 20, 60_000);
  if (!allowed) {
    return Response.json(
      { error: "Muitas tentativas. Aguarde um minuto e tente de novo." },
      { status: 429 },
    );
  }

  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    if (briefing.status === "concluido") {
      return Response.json({ error: "Este briefing já foi enviado." }, { status: 409 });
    }

    const result = await createLiveEphemeralToken(briefing.answers);
    return Response.json(result);
  } catch (e) {
    return serviceUnavailable(e);
  }
}
