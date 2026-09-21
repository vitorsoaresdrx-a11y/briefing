import { createAdminClient } from "@/lib/supabase/admin";
import { missingRequired } from "@/lib/briefing/completeness";
import { questionLabel } from "@/lib/briefing/format";
import { onBriefingCompleted } from "@/lib/briefing/completed";
import {
  getBriefingByToken,
  notFound,
  serviceUnavailable,
} from "@/lib/briefing/server-helpers";

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    if (briefing.status === "concluido") {
      return Response.json({ error: "Este briefing já foi enviado." }, { status: 409 });
    }

    const missing = missingRequired(briefing.answers);
    if (missing.length > 0) {
      return Response.json(
        {
          error: "Faltam respostas obrigatórias.",
          missing: missing.map((id) => ({ id, label: questionLabel(id) })),
        },
        { status: 422 },
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("briefings")
      .update({
        status: "concluido",
        completed_at: new Date().toISOString(),
        viewed_at: null,
      })
      .eq("id", briefing.id);
    if (error) throw error;

    await onBriefingCompleted({
      id: briefing.id,
      token: briefing.token,
      clientName: briefing.client_name,
      company: briefing.company,
    });

    return Response.json({ ok: true });
  } catch (e) {
    return serviceUnavailable(e);
  }
}
