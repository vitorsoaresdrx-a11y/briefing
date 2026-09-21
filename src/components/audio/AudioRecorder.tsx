"use client";

import * as React from "react";
import { Check, Loader2, Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { AUDIO_BUCKET, type AudioInfo } from "@/lib/briefing/media";
import type { Answers } from "@/lib/briefing/types";
import { Button } from "@/components/ui/Button";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

const MAX_SECONDS = 180; // 3 minutos

type Phase = "idle" | "recording" | "paused" | "preview" | "sending" | "error";

export type AudioSync = {
  answers: Answers;
  audios: AudioInfo[];
  transcript: string | null;
  transcribed: boolean;
};

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function extFor(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "audio/webm") return "webm";
  if (base === "audio/mp4") return "mp4";
  if (base === "audio/ogg") return "ogg";
  return "webm";
}

export function AudioRecorder({
  token,
  questionId,
  existingAudioId,
  onSync,
}: {
  token: string;
  questionId: string;
  existingAudioId?: string;
  onSync: (result: AudioSync) => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isError, setIsError] = React.useState(false);
  const [blob, setBlob] = React.useState<Blob | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const mimeRef = React.useRef<string>("");
  const startedAtRef = React.useRef(0);
  const pausedTotalRef = React.useRef(0);
  const pauseStartRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const previewUrl = React.useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function releaseMic() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  React.useEffect(
    () => () => {
      stopTimer();
      releaseMic();
    },
    [],
  );

  function tick() {
    const spent = Math.floor((Date.now() - startedAtRef.current - pausedTotalRef.current) / 1000);
    if (spent >= MAX_SECONDS) {
      stopRecording();
      return;
    }
    setElapsed(spent);
  }

  async function startRecording() {
    setMessage(null);
    setIsError(false);
    setBlob(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPhase("error");
      setIsError(true);
      setMessage("Este navegador não suporta gravação de áudio. Escreva sua resposta no campo.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      mimeRef.current = mimeType;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTimer();
        releaseMic();
        const type = mimeRef.current.split(";")[0] || "audio/webm";
        setBlob(new Blob(chunksRef.current, { type }));
        setPhase("preview");
      };
      recorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      pausedTotalRef.current = 0;
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(tick, 500);
    } catch (e) {
      releaseMic();
      setPhase("error");
      setIsError(true);
      setMessage(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Permissão do microfone negada. Libere o acesso nas configurações do navegador ou escreva no campo."
          : "Não foi possível acessar o microfone. Escreva sua resposta no campo.",
      );
    }
  }

  function stopRecording() {
    const r = recorderRef.current;
    if (r && (r.state === "recording" || r.state === "paused")) r.stop();
  }

  function pauseRecording() {
    const r = recorderRef.current;
    if (r?.state === "recording") {
      pauseStartRef.current = Date.now();
      r.pause();
      setPhase("paused");
    }
  }

  function resumeRecording() {
    const r = recorderRef.current;
    if (r?.state === "paused") {
      pausedTotalRef.current += Date.now() - pauseStartRef.current;
      r.resume();
      setPhase("recording");
    }
  }

  function discard() {
    setBlob(null);
    setPhase("idle");
    setMessage(null);
  }

  async function useRecording() {
    const data = blob;
    if (!data) return;
    const mimeType = mimeRef.current.split(";")[0] || data.type || "audio/webm";
    if (data.size > 25 * 1024 * 1024) {
      setIsError(true);
      setMessage("Áudio muito grande. Tente uma gravação mais curta.");
      return;
    }
    setPhase("sending");
    setIsError(false);
    setMessage("Enviando áudio…");
    try {
      const ext = extFor(mimeType);
      const upRes = await fetch(`/api/briefing/${token}/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bucket: AUDIO_BUCKET,
          question_id: questionId,
          file_name: `audio.${ext}`,
          mime_type: mimeType,
          size: data.size,
        }),
      });
      if (!upRes.ok) throw new Error("upload-url");
      const { path, token: upToken } = (await upRes.json()) as { path: string; token: string };

      const supabase = createClient();
      const { error: upError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .uploadToSignedUrl(path, upToken, data);
      if (upError) throw upError;

      setMessage("Transcrevendo…");
      const regRes = await fetch(`/api/briefing/${token}/audio`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question_id: questionId,
          storage_path: path,
          mime_type: mimeType,
          duration_seconds: Math.max(1, elapsed),
        }),
      });
      if (!regRes.ok) throw new Error("register");
      const result = (await regRes.json()) as AudioSync;
      onSync(result);
      setBlob(null);
      setPhase("idle");
      setIsError(!result.transcribed);
      setMessage(
        result.transcribed
          ? "Transcrição pronta — confira o texto no campo."
          : "Não consegui transcrever, mas seu áudio foi salvo.",
      );
    } catch {
      setPhase("preview");
      setIsError(true);
      setMessage("Falha no envio. Confira sua conexão e tente de novo.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-ctl border border-line bg-ink p-4">
      {phase === "idle" || phase === "error" ? (
        <div className="flex flex-col gap-3">
          {existingAudioId ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Áudio anexado — a transcrição está no campo acima
            </p>
          ) : null}
          <Button variant="ghost" onClick={startRecording} className="min-h-[44px] self-start px-4 text-sm">
            <Mic size={18} aria-hidden="true" />
            {existingAudioId ? "Gravar de novo" : "Prefiro falar"}
          </Button>
        </div>
      ) : null}

      {phase === "recording" || phase === "paused" ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-3" role="status">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-burgundy-glow animate-pulse" />
            <span className="font-mono text-sm tabular-nums">
              {phase === "paused" ? "Pausado" : "Gravando"} · {formatTime(elapsed)} / {formatTime(MAX_SECONDS)}
            </span>
          </p>
          <div className="flex gap-2">
            {phase === "recording" ? (
              <Button variant="secondary" onClick={pauseRecording} className="min-h-[44px] px-4 text-sm">
                <Pause size={16} aria-hidden="true" /> Pausar
              </Button>
            ) : (
              <Button variant="secondary" onClick={resumeRecording} className="min-h-[44px] px-4 text-sm">
                <Play size={16} aria-hidden="true" /> Continuar
              </Button>
            )}
            <Button variant="primary" onClick={stopRecording} className="min-h-[44px] px-4 text-sm">
              <Square size={16} aria-hidden="true" /> Parar
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "preview" && previewUrl ? (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Ouça antes de enviar · {formatTime(elapsed)}
          </p>
          <audio controls src={previewUrl} className="w-full" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={discard} className="min-h-[44px] px-4 text-sm">
              <RotateCcw size={16} aria-hidden="true" /> Regravar
            </Button>
            <Button variant="primary" onClick={useRecording} className="min-h-[44px] px-4 text-sm">
              <Check size={16} aria-hidden="true" /> Usar este áudio
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "sending" ? (
        <p role="status" className="flex items-center gap-3 text-sm text-muted">
          <Loader2 size={18} aria-hidden="true" className="animate-spin text-burgundy-glow" />
          {message ?? "Enviando…"}
        </p>
      ) : null}

      {message && phase !== "sending" ? (
        <p role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-burgundy-glow" : "text-muted"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
