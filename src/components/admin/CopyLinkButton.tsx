"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";

export function CopyLinkButton({ url, label = "Copiar link" }: { url: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex min-h-[44px] items-center gap-2 text-sm text-muted hover:text-white"
    >
      {copied ? <Check size={16} aria-hidden="true" className="text-burgundy-glow" /> : <Link2 size={16} aria-hidden="true" />}
      {copied ? "Copiado!" : label}
    </button>
  );
}
