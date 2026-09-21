"use client";

import * as React from "react";
import { createBriefingLink } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CopyLinkButton } from "@/components/admin/CopyLinkButton";

export function NewLinkForm({ siteUrl }: { siteUrl: string }) {
  const [name, setName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [link, setLink] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLink(null);
    setLoading(true);
    try {
      const res = await createBriefingLink({ clientName: name, company });
      if (!res.ok || !res.token) {
        setError(res.error ?? "Não foi possível criar o link.");
        return;
      }
      setLink(`${siteUrl}/b/${res.token}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex max-w-md flex-col gap-5">
        <Input label="Nome do cliente (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Empresa (opcional)" value={company} onChange={(e) => setCompany(e.target.value)} />
        {error ? (
          <p role="alert" className="text-sm text-burgundy-glow">
            {error}
          </p>
        ) : null}
        <Button variant="primary" type="submit" disabled={loading} className="self-start">
          {loading ? "Gerando…" : "Gerar link"}
        </Button>
      </form>
      {link ? (
        <div className="rounded-card border border-burgundy-glow bg-burgundy/20 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Link pronto</p>
          <p className="mt-2 break-all text-[15px]">{link}</p>
          <div className="mt-3">
            <CopyLinkButton url={link} label="Copiar link" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
