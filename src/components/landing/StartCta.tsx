"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

// TODO(Fase 2): a rota POST /api/briefing (criação de rascunho) ainda não
// existe; quando ela for criada, este botão passa a funcionar sem mudanças.
export function StartCta({ label = "Começar briefing" }: { label?: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "loading" | "error">("idle");

  async function start() {
    setState("loading");
    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { token?: string };
      if (!data.token) throw new Error("token ausente");
      router.push(`/b/${data.token}`);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="primary"
        onClick={start}
        disabled={state === "loading"}
        className="w-full sm:w-auto"
      >
        {state === "loading" ? "Preparando…" : label}
        {state !== "loading" ? <ArrowRight size={18} aria-hidden="true" /> : null}
      </Button>
      {state === "error" ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          Não foi possível iniciar agora. Tente de novo em instantes.
        </p>
      ) : null}
    </div>
  );
}
