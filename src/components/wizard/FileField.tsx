"use client";

import * as React from "react";
import { FileUp, X } from "lucide-react";
import type { StoredFile } from "@/lib/briefing/format";

const ACCEPT_BY_KIND: Record<string, string> = {
  logo: "image/*",
  foto: "image/*",
  documento: ".pdf,.doc,.docx,.txt,image/*",
  outro: "*/*",
};

const MAX_BYTES = 20 * 1024 * 1024;

interface FileFieldProps {
  questionId: string;
  label: string;
  kind?: "logo" | "foto" | "documento" | "outro";
  maxItems?: number;
  value: StoredFile[];
  onChange: (files: StoredFile[]) => void;
}

/**
 * Fase 2: seleção local com metadados persistidos nas respostas.
 * TODO(Fase 3): trocar por upload real via signed URL (Storage).
 */
export function FileField({ questionId, label, kind = "outro", maxItems = 5, value, onChange }: FileFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const canAdd = value.length < maxItems;

  function pickFiles(list: FileList | null) {
    setError(null);
    if (!list) return;
    const next = [...value];
    for (const file of Array.from(list)) {
      if (next.length >= maxItems) {
        setError(`Limite de ${maxItems} arquivos.`);
        break;
      }
      if (file.size > MAX_BYTES) {
        setError(`"${file.name}" passa de 20 MB e foi ignorado.`);
        continue;
      }
      if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push({ name: file.name, size: file.size });
      }
    }
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={questionId}
        type="file"
        accept={ACCEPT_BY_KIND[kind]}
        multiple={maxItems > 1}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          pickFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {value.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {value.map((file, i) => (
            <li
              key={`${file.name}-${file.size}`}
              className="flex items-center gap-3 rounded-ctl border border-line bg-ink-2 px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white">{file.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                  {formatSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remover ${file.name}`}
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-ctl text-muted hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {canAdd ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-ctl border border-dashed border-line px-6 text-[15px] text-muted transition-colors hover:border-white/25 hover:text-white"
        >
          <FileUp size={18} aria-hidden="true" />
          {value.length === 0 ? "Escolher arquivos" : `Adicionar (${value.length}/${maxItems})`}
        </button>
      ) : null}
      <p className="text-sm text-muted">Formatos: imagens, PDF e documentos (até 20 MB cada).</p>
      {error ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          {error}
        </p>
      ) : null}
    </div>
  );
}
