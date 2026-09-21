import { createAdminClient } from "@/lib/supabase/admin";
import type { BriefingRow, BriefingStatus } from "@/lib/supabase/database";
import type { Answers } from "@/lib/briefing/types";

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
