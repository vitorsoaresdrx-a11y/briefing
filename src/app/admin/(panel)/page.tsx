import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { formatAnswer } from "@/lib/briefing/format";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";
import { Ornament } from "@/components/ui/Ornament";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const PROJECT_TYPES = ["landing", "institucional", "saas", "ecommerce", "redesign", "outro"] as const;

function typeLabel(value: string | null): string {
  if (!value) return "—";
  const label = formatAnswer("project_type", { value });
  return label === "—" ? value : label;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

export default async function AdminListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = sp.status ?? "";
  const type = sp.type ?? "";

  const supabase = createAdminClient();
  let query = supabase
    .from("briefings")
    .select("id, token, client_name, company, project_type, status, completeness, created_at, viewed_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status === "rascunho" || status === "em_andamento" || status === "concluido") {
    query = query.eq("status", status);
  }
  if (type && (PROJECT_TYPES as readonly string[]).includes(type)) {
    query = query.eq("project_type", type);
  }
  if (q) {
    const safe = q.replace(/[%_,]/g, " ").trim();
    if (safe) query = query.or(`client_name.ilike.%${safe}%,company.ilike.%${safe}%`);
  }

  const [{ data: rows }, { data: all }] = await Promise.all([
    query,
    supabase.from("briefings").select("status"),
  ]);

  const counts = { rascunho: 0, em_andamento: 0, concluido: 0 };
  for (const r of all ?? []) {
    if (r.status === "rascunho" || r.status === "em_andamento" || r.status === "concluido") {
      counts[r.status] += 1;
    }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <Ornament className="mr-2" />
            {(rows ?? []).length} briefing{(rows ?? []).length === 1 ? "" : "s"}
          </p>
          <h1 className="mt-4 font-display text-5xl uppercase leading-[0.9] sm:text-6xl">Briefings</h1>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {counts.concluido} concluídos · {counts.em_andamento} em andamento · {counts.rascunho} rascunhos
          </p>
        </div>
        <Link
          href="/admin/novo"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-ctl bg-burgundy px-6 text-[15px] font-medium text-white transition-colors hover:bg-burgundy-hover"
        >
          <Plus size={18} aria-hidden="true" />
          Novo link
        </Link>
      </div>

      <form method="get" className="mt-10 grid gap-3 sm:grid-cols-[1fr_200px_220px_auto]">
        <label className="sr-only" htmlFor="q">
          Buscar por nome ou empresa
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou empresa…"
          className="min-h-[48px] rounded-ctl border border-line bg-ink-2 px-4 text-[16px] text-white placeholder:text-muted/70 focus:border-burgundy-glow focus:outline-none"
        />
        <label className="sr-only" htmlFor="status">
          Filtrar por status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="min-h-[48px] rounded-ctl border border-line bg-ink-2 px-4 text-[15px] text-white focus:border-burgundy-glow focus:outline-none"
        >
          <option value="">Todos os status</option>
          <option value="concluido">Concluídos</option>
          <option value="em_andamento">Em andamento</option>
          <option value="rascunho">Rascunhos</option>
        </select>
        <label className="sr-only" htmlFor="type">
          Filtrar por tipo
        </label>
        <select
          id="type"
          name="type"
          defaultValue={type}
          className="min-h-[48px] rounded-ctl border border-line bg-ink-2 px-4 text-[15px] text-white focus:border-burgundy-glow focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex min-h-[48px] items-center justify-center rounded-ctl border border-line px-6 text-[15px] font-medium transition-colors hover:bg-white/10"
        >
          Filtrar
        </button>
      </form>

      <ul className="mt-8 flex flex-col border-t border-line">
        {(rows ?? []).map((b) => (
          <li key={b.id} className="border-b border-line py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <Link href={`/admin/briefings/${b.id}`} className="group min-w-0">
                <p className="truncate text-lg font-semibold group-hover:underline group-hover:underline-offset-4">
                  {b.client_name || "Sem nome"}
                  {b.company ? <span className="font-normal text-muted"> · {b.company}</span> : null}
                </p>
              </Link>
              <StatusBadge status={b.status} fresh={b.status === "concluido" && !b.viewed_at} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              <span>{typeLabel(b.project_type)}</span>
              <span>{b.completeness}% completo</span>
              <span>{formatDate(b.created_at)}</span>
              {siteUrl ? <CopyLinkButton url={`${siteUrl}/b/${b.token}`} label="Link do cliente" /> : null}
            </div>
          </li>
        ))}
      </ul>
      {(rows ?? []).length === 0 ? (
        <p className="mt-8 leading-relaxed text-muted">
          Nenhum briefing encontrado. Ajuste os filtros ou crie um novo link.
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status, fresh }: { status: string; fresh: boolean }) {
  const label = STATUS_LABEL[status] ?? status;
  return (
    <span
      className={[
        "inline-flex min-h-[32px] items-center gap-2 rounded-full border px-3 font-mono text-[11px] uppercase tracking-[0.14em]",
        status === "concluido" ? "border-burgundy-glow text-burgundy-glow" : "border-line text-muted",
      ].join(" ")}
    >
      {fresh ? <span aria-hidden="true" className="h-2 w-2 rounded-full bg-burgundy-glow animate-pulse" /> : null}
      {label}
    </span>
  );
}
