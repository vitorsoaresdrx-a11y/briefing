"use client";

import * as React from "react";
import { setBriefingStatus } from "@/app/admin/actions";

const OPTIONS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
] as const;

export function StatusSelector({
  briefingId,
  current,
}: {
  briefingId: string;
  current: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function change(status: string) {
    if (status === current || pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await setBriefingStatus(
        briefingId,
        status as "rascunho" | "em_andamento" | "concluido",
      );
      if (!res.ok) setError(res.error ?? "Falha ao atualizar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="status-select" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        Status
      </label>
      <select
        id="status-select"
        defaultValue={current}
        disabled={pending}
        onChange={(e) => void change(e.target.value)}
        className="min-h-[48px] rounded-ctl border border-line bg-ink-2 px-4 text-[15px] text-white focus:border-burgundy-glow focus:outline-none disabled:opacity-50"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          {error}
        </p>
      ) : null}
    </div>
  );
}
