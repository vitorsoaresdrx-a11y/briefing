"use client";

import * as React from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { FILES_BUCKET, FILES_MAX_BYTES, type FileInfo } from "@/lib/briefing/media";
import type { Answers } from "@/lib/briefing/types";

export type FileSync = {
  answers: Answers;
  files: FileInfo[];
};

const MAX_MB = Math.round(FILES_MAX_BYTES / (1024 * 1024));

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileField({
  token,
  questionId,
  maxItems = 5,
  files,
  onSync,
  disabled = false,
}: {
  token: string;
  questionId: string;
  maxItems?: number;
  files: FileInfo[];
  onSync: (result: FileSync) => void;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const busy = uploading.length > 0;

  async function uploadOne(file: File) {
    const upRes = await fetch(`/api/briefing/${token}/upload-url`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bucket: FILES_BUCKET,
        question_id: questionId,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size: file.size,
      }),
    });
    if (!upRes.ok) {
      const data = (await upRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Falha ao preparar envio.");
    }
    const { path, token: upToken } = (await upRes.json()) as { path: string; token: string };

    const supabase = createClient();
    const { error: upError } = await supabase.storage
      .from(FILES_BUCKET)
      .uploadToSignedUrl(path, upToken, file);
    if (upError) throw upError;

    const regRes = await fetch(`/api/briefing/${token}/file`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      }),
    });
    if (!regRes.ok) {
      const data = (await regRes.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Falha ao registrar arquivo.");
    }
    return (await regRes.json()) as FileSync;
  }

  async function pickFiles(list: FileList | null) {
    setError(null);
    if (!list || disabled) return;
    const selected = Array.from(list);
    if (files.length + selected.length > maxItems) {
      setError(`Limite de ${maxItems} arquivos nesta pergunta.`);
      return;
    }
    for (const file of selected) {
      if (file.size > FILES_MAX_BYTES) {
        setError(`"${file.name}" passa de ${MAX_MB} MB e foi ignorado.`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const result = await uploadOne(file);
        onSync(result);
      } catch (e) {
        setError(e instanceof Error ? `"${file.name}": ${e.message}` : `Falha ao enviar "${file.name}".`);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
  }

  async function removeFile(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/briefing/${token}/file`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ file_id: id }),
      });
      if (!res.ok) throw new Error("Falha ao remover.");
      onSync((await res.json()) as FileSync);
    } catch {
      setError("Não foi possível remover. Tente de novo.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={questionId}
        type="file"
        multiple={maxItems > 1}
        disabled={disabled || busy}
        className="sr-only"
        aria-label="Escolher arquivos"
        onChange={(e) => {
          void pickFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-ctl border border-line bg-ink-2 px-4 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white">{file.file_name}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                  {formatSize(file.size_bytes ?? 0)} · Enviado ✓
                </span>
              </span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => void removeFile(file.id)}
                  aria-label={`Remover ${file.file_name}`}
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-ctl text-muted hover:bg-white/5 hover:text-white"
                >
                  <X size={18} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {uploading.map((name) => (
        <p key={name} role="status" className="flex items-center gap-3 text-sm text-muted">
          <Loader2 size={16} aria-hidden="true" className="animate-spin text-burgundy-glow" />
          Enviando {name}…
        </p>
      ))}
      {!disabled && files.length < maxItems ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-ctl border border-dashed border-line px-6 text-[15px] text-muted transition-colors hover:border-white/25 hover:text-white disabled:opacity-50"
        >
          <FileUp size={18} aria-hidden="true" />
          {files.length === 0 ? "Escolher arquivos" : `Adicionar (${files.length}/${maxItems})`}
        </button>
      ) : null}
      <p className="text-sm text-muted">
        Imagens, PDF e documentos (até {MAX_MB} MB cada). O envio é imediato.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          {error}
        </p>
      ) : null}
    </div>
  );
}
