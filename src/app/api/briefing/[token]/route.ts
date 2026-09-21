import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcCompleteness } from "@/lib/briefing/completeness";
import type { Answers } from "@/lib/briefing/types";
import {
  denormalizedColumns,
  getBriefingByToken,
  notFound,
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

function clampString(v: unknown): unknown {
  if (typeof v === "string") return v.slice(0, 15000);
  if (Array.isArray(v))
    return v.slice(0, 20).map((i) => (typeof i === "string" ? i.slice(0, 2000) : i));
  return v;
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    const briefing = await getBriefingByToken(token);
    if (!briefing) return notFound();
    return Response.json({
      token: briefing.token,
      status: briefing.status,
      current_step: briefing.current_step,
      answers: briefing.answers,
      completeness: briefing.completeness,
      pending_fields: briefing.pending_fields,
      audios: [],
      files: [],
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
    const merged: Answers = { ...briefing.answers };
    for (const [qid, ans] of Object.entries(incoming)) {
      merged[qid] = {
        ...(ans.skipped !== undefined ? { skipped: ans.skipped } : {}),
        ...(ans.unknown !== undefined ? { unknown: ans.unknown } : {}),
        ...(ans.audioId !== undefined ? { audioId: ans.audioId } : {}),
        value: clampString(ans.value),
      };
    }

    const { percent, pending } = calcCompleteness(merged);
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("briefings")
      .update({
        answers: merged,
        current_step: parsed.data.current_step ?? briefing.current_step,
        completeness: percent,
        pending_fields: pending,
        status: "em_andamento",
        ...denormalizedColumns(merged),
      })
      .eq("id", briefing.id);
    if (error) throw error;

    return Response.json({ completeness: percent, pending_fields: pending });
  } catch (e) {
    return serviceUnavailable(e);
  }
}
