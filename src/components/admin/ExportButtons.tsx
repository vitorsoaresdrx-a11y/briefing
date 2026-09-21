"use client";

import * as React from "react";
import { Check, Copy, Download } from "lucide-react";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export function CopySummaryButton({ markdown }: { markdown: string }) {
  const [state, setState] = React.useState<"idle" | "ok" | "fail">("idle");
  async function copy() {
    const ok = await copyText(markdown);
    setState(ok ? "ok" : "fail");
    setTimeout(() => setState("idle"), 2500);
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex min-h-[48px] items-center gap-2 rounded-ctl border border-line px-5 text-[15px] font-medium transition-colors hover:bg-white/10"
      >
        {state === "ok" ? <Check size={18} aria-hidden="true" className="text-burgundy-glow" /> : <Copy size={18} aria-hidden="true" />}
        {state === "ok" ? "Copiado!" : "Copiar resumo"}
      </button>
      {state === "fail" ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          Não foi possível copiar. Selecione o texto manualmente.
        </p>
      ) : null}
    </div>
  );
}

export function DownloadJsonButton({ filename, data }: { filename: string; data: unknown }) {
  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex min-h-[48px] items-center gap-2 rounded-ctl border border-line px-5 text-[15px] font-medium transition-colors hover:bg-white/10"
    >
      <Download size={18} aria-hidden="true" />
      Baixar JSON
    </button>
  );
}
