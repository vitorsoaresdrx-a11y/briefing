import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { visibleQuestions, visibleSteps } from "@/lib/briefing/conditions";
import { formatAnswer, questionLabel } from "@/lib/briefing/format";
import { buildSummary } from "@/lib/briefing/summary";
import { listMedia } from "@/lib/briefing/server-helpers";
import type { Answers } from "@/lib/briefing/types";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { CopySummaryButton, DownloadJsonButton } from "@/components/admin/ExportButtons";
import { Ornament } from "@/components/ui/Ornament";
import { RetryAudioButton } from "@/components/admin/RetryAudioButton";
import { StatusSelector } from "@/components/admin/StatusSelector";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const supabase = createAdminClient();
  const { data: briefing } = await supabase
    .from("briefings")
    .select(
      "id, token, client_name, client_email, client_whatsapp, company, project_type, niche, status, current_step, answers, completeness, pending_fields, created_at, updated_at, completed_at, viewed_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!briefing) notFound();

  // Abrir o detalhe marca como lido (selo "Novo" sai na Fase 5).
  if (briefing.status === "concluido" && !briefing.viewed_at) {
    await supabase.from("briefings").update({ viewed_at: new Date().toISOString() }).eq("id", id);
  }

  const { audios, files } = await listMedia(supabase, id);
  const answers = (briefing.answers ?? {}) as Answers;
  const steps = visibleSteps(answers).filter((s) => visibleQuestions(s, answers).length > 0);
  const summary = buildSummary(answers);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  const exportData = {
    exported_at: new Date().toISOString(),
    briefing: {
      id: briefing.id,
      token: briefing.token,
      client_name: briefing.client_name,
      client_email: briefing.client_email,
      client_whatsapp: briefing.client_whatsapp,
      company: briefing.company,
      project_type: briefing.project_type,
      niche: briefing.niche,
      status: briefing.status,
      answers: briefing.answers,
      completeness: briefing.completeness,
      pending_fields: briefing.pending_fields,
      created_at: briefing.created_at,
      completed_at: briefing.completed_at,
    },
    audios: audios.map((a) => ({
      id: a.id,
      question_id: a.question_id,
      mime_type: a.mime_type,
      duration_seconds: a.duration_seconds,
      transcript_status: a.transcript_status,
    })),
    transcripts: Object.fromEntries(
      (
        await supabase.from("briefing_audios").select("id, transcript").eq("briefing_id", id)
      ).data?.map((r) => [r.id, r.transcript]) ?? [],
    ),
    files: files.map((f) => ({
      id: f.id,
      question_id: f.question_id,
      file_name: f.file_name,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      kind: f.kind,
    })),
    summary_markdown: summary,
  };

  return (
    <div>
      <Link href="/admin" className="inline-flex min-h-[44px] items-center gap-2 text-sm text-muted hover:text-white">
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para briefings
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <Ornament className="mr-2" />
            {formatAnswer("project_type", { value: briefing.project_type ?? "" })}{" "}
            {briefing.viewed_at ? "" : "· não lido"}
          </p>
          <h1 className="mt-4 font-display text-5xl uppercase leading-[0.95] sm:text-6xl">
            {briefing.client_name || "Sem nome"}
          </h1>
          <p className="mt-3 leading-relaxed text-muted">
            {[briefing.company, briefing.client_email, briefing.client_whatsapp].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Criado em {formatDateTime(briefing.created_at)}
            {briefing.completed_at ? ` · Concluído em ${formatDateTime(briefing.completed_at)}` : ""}
          </p>
        </div>
        <div className="w-full max-w-[240px]">
          <StatusSelector briefingId={id} current={briefing.status} />
        </div>
      </div>

      <div className="mt-8 grid gap-6 rounded-card border border-line bg-ink p-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Completude</p>
          <p className="mt-2 font-display text-5xl text-burgundy-glow">{briefing.completeness}%</p>
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={briefing.completeness} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-burgundy" style={{ width: `${briefing.completeness}%` }} />
          </div>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Pendências ({briefing.pending_fields.length})
          </p>
          {briefing.pending_fields.length > 0 ? (
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto text-sm text-muted">
              {briefing.pending_fields.map((pid: string) => (
                <li key={pid}>· {questionLabel(pid)}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Nada pendente.</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <CopySummaryButton markdown={summary} />
        <DownloadJsonButton filename={`briefing-${briefing.client_name || id}.json`} data={exportData} />
        <Link
          href={`/admin/briefings/${id}/print`}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-ctl border border-line px-5 text-[15px] font-medium transition-colors hover:bg-white/10"
        >
          <Printer size={18} aria-hidden="true" />
          Imprimir / PDF
        </Link>
        {siteUrl ? <CopyLinkButton url={`${siteUrl}/b/${briefing.token}`} label="Link do cliente" /> : null}
      </div>

      <div className="mt-12 flex flex-col">
        {steps.map((step) => (
          <section key={step.id} className="border-t border-line py-8">
            <h2 className="font-display text-3xl uppercase tracking-[-0.01em]">{step.title}</h2>
            <div className="mt-6 flex flex-col gap-6">
              {visibleQuestions(step, answers).map((q) => {
                const ans = answers[q.id];
                const qAudios = audios.filter((a) => a.question_id === q.id);
                return (
                  <div key={q.id}>
                    <p className="text-sm text-muted">{q.label}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
                      {formatAnswer(q.id, ans)}
                    </p>
                    {qAudios.map((a) => (
                      <div key={a.id} className="mt-3 flex flex-col gap-2 rounded-ctl border border-line bg-ink p-4">
                        {a.url ? <audio controls src={a.url} preload="none" className="w-full" /> : null}
                        {a.transcript_status === "processando" || a.transcript_status === "pendente" ? (
                          <p className="text-sm text-muted">Transcrevendo…</p>
                        ) : null}
                        {a.transcript_status === "erro" ? (
                          <div className="flex flex-col gap-2">
                            <p className="text-sm text-burgundy-glow">
                              Falha na transcrição — o áudio foi preservado.
                            </p>
                            <RetryAudioButton briefingId={id} audioId={a.id} />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {files.length > 0 ? (
        <section className="border-t border-line py-8">
          <h2 className="font-display text-3xl uppercase tracking-[-0.01em]">
            Arquivos ({files.length})
          </h2>
          <ul className="mt-6 flex flex-col gap-2">
            {files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-ctl border border-line bg-ink px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white">{f.file_name}</span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                    {questionLabel(f.question_id) !== f.question_id ? questionLabel(f.question_id) : f.kind}
                  </span>
                </span>
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted underline underline-offset-4 hover:text-white">
                    Baixar
                  </a>
                ) : (
                  <span className="text-sm text-muted">Indisponível</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
