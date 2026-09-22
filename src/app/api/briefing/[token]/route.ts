import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Answers } from "@/lib/briefing/types";
import {
  getBriefingByToken,
  listMedia,
  mergeAnswers,
  notFound,
  persistAnswers,
  serviceUnavailable,
} from "@/lib/briefing/server-helpers";

const answerSchema = z.object({
  value: z.unknown(),
  skipped: z.boolean().optional(),
  unknown: z.boolean().optional(),
  audioId: z.string().max(100).optional(),
});

const patchSchema = z.object({
  answers: z.record(z.string().max(80), answerSchema).refine(
    (a) => Object.keys(a).length <= 200,
    "Respostas demais.",
  ),
  current_step: z.string().max(64).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    const supabase = createAdminClient();
    const { audios, files } = await listMedia(supabase, briefing.id);
    return Response.json({
      token: briefing.token,
      status: briefing.status,
      current_step: briefing.current_step,
      answers: briefing.answers,
      completeness: briefing.completeness,
      pending_fields: briefing.pending_fields,
      audios,
      files,
    });
  } catch (e) {
    return serviceUnavailable(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    if (briefing.status === "concluido") {
      return Response.json({ error: "Este briefing já foi enviado." }, { status: 409 });
    }

    const incoming = parsed.data.answers as Answers;
    const merged = mergeAnswers(briefing.answers, incoming);
    const supabase = createAdminClient();
    const { percent, pending } = await persistAnswers(
      supabase,
      briefing,
      merged,
      parsed.data.current_step,
    );

    return Response.json({ completeness: percent, pending_fields: pending });
  } catch (e) {
    return serviceUnavailable(e);
  }
}
