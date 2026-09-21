import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { serviceUnavailable } from "@/lib/briefing/server-helpers";

const createSchema = z.object({
  // Honeypot: formulário real deixa vazio; bot preenche e é barrado.
  website: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (parsed.data.website && parsed.data.website.trim() !== "") {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const allowed = await checkRateLimit(`briefing:create:${clientIp(req.headers)}`, 10, 60_000);
  if (!allowed) {
    return Response.json(
      { error: "Muitas tentativas. Aguarde um minuto e tente de novo." },
      { status: 429 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("briefings")
      .insert({})
      .select("token")
      .single();
    if (error || !data) throw error ?? new Error("insert falhou");
    return Response.json({ token: (data as { token: string }).token }, { status: 201 });
  } catch (e) {
    return serviceUnavailable(e);
  }
}
