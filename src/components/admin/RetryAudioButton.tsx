"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { retryAudioTranscription } from "@/app/admin/actions";

export function RetryAudioButton({
  briefingId,
  audioId,
}: {
  briefingId: string;
  audioId: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  async function retry() {
    setMessage(null);
    setFailed(false);
    setPending(true);
    try {
      const res = await retryAudioTranscription(briefingId, audioId);
      setFailed(!res.ok);
      setMessage(res.ok ? "Transcrição refeita." : (res.error ?? "Falha ao transcrever."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void retry()}
        disabled={pending}
        className="inline-flex min-h-[44px] items-center gap-2 self-start text-sm text-muted hover:text-white disabled:opacity-50"
      >
        <RefreshCw size={16} aria-hidden="true" className={pending ? "animate-spin" : ""} />
        {pending ? "Transcrevendo…" : "Reenviar transcrição"}
      </button>
      {message ? (
        <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-burgundy-glow" : "text-muted"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
