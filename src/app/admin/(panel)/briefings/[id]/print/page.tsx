import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { visibleQuestions, visibleSteps } from "@/lib/briefing/conditions";
import { formatAnswer, questionLabel } from "@/lib/briefing/format";
import type { Answers } from "@/lib/briefing/types";
import { PrintButton } from "@/components/admin/PrintButton";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

export default async function AdminPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const supabase = createAdminClient();
  const { data: briefing } = await supabase
    .from("briefings")
    .select("client_name, client_email, client_whatsapp, company, completeness, pending_fields, answers, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!briefing) notFound();

  const { data: transcripts } = await supabase
    .from("briefing_audios")
    .select("question_id, transcript")
    .eq("briefing_id", id)
    .not("transcript", "is", null)
    .order("created_at", { ascending: true });
  const transcriptByQuestion = new Map(
    (transcripts ?? []).map((t) => [t.question_id, t.transcript as string]),
  );

  const { data: fileRows } = await supabase
    .from("briefing_files")
    .select("file_name")
    .eq("briefing_id", id)
    .order("created_at", { ascending: true });

  const answers = (briefing.answers ?? {}) as Answers;
  const steps = visibleSteps(answers).filter((s) => visibleQuestions(s, answers).length > 0);

  return (
    <div className="bg-white text-black [color-scheme:light]">
      <style>{`@page { margin: 15mm; } @media print { body { background: #fff; } }`}</style>
      <div className="mx-auto max-w-3xl px-2 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <Link href={`/admin/briefings/${id}`} className="text-sm text-neutral-600 underline underline-offset-4">
            ← Voltar ao detalhe
          </Link>
          <PrintButton />
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-500">
          Briefing · {formatDate(briefing.created_at)} · {briefing.completeness}% completo
        </p>
        <h1 className="mt-2 text-4xl font-bold uppercase leading-none">
          {briefing.client_name || "Sem nome"}
        </h1>
        <p className="mt-2 text-neutral-600">
          {[briefing.company, briefing.client_email, briefing.client_whatsapp].filter(Boolean).join(" · ")}
        </p>

        {steps.map((step) => (
          <section key={step.id} className="mt-8 break-inside-avoid">
            <h2 className="border-b-2 border-black pb-1 text-xl font-bold uppercase">{step.title}</h2>
            <div className="mt-3 flex flex-col gap-3">
              {visibleQuestions(step, answers).map((q) => (
                <div key={q.id}>
                  <p className="text-sm font-semibold">{q.label}</p>
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                    {formatAnswer(q.id, answers[q.id])}
                  </p>
                  {transcriptByQuestion.get(q.id) ? (
                    <p className="mt-1 whitespace-pre-wrap border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-600">
                      Transcrição: {transcriptByQuestion.get(q.id)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}

        {(fileRows ?? []).length > 0 ? (
          <section className="mt-8">
            <h2 className="border-b-2 border-black pb-1 text-xl font-bold uppercase">
              Arquivos ({fileRows?.length})
            </h2>
            <ul className="mt-3 list-disc pl-5 text-[15px]">
              {(fileRows ?? []).map((f, i) => (
                <li key={i}>{f.file_name}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {briefing.pending_fields.length > 0 ? (
          <section className="mt-8">
            <h2 className="border-b-2 border-black pb-1 text-xl font-bold uppercase">Pendências</h2>
            <ul className="mt-3 list-disc pl-5 text-[15px]">
              {briefing.pending_fields.map((pid: string) => (
                <li key={pid}>{questionLabel(pid)}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
