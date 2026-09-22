"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Mic, MicOff, PhoneOff, RotateCcw, Loader2, Check, Send, ImagePlus } from "lucide-react";
import type { LiveServerMessage } from "@google/genai";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { AudioOutPlayer, MicStreamer } from "@/lib/voice/browser-audio";
import { findQuestion } from "@/lib/briefing/conditions";
import { STEPS } from "@/lib/briefing/steps";
import { VOICE_SAY } from "@/lib/briefing/voice-say";
import { voiceWidgetFor, type VoiceWidget } from "@/lib/voice/widgets";
import { createClient } from "@/lib/supabase/browser";
import { FILES_BUCKET, type FileInfo } from "@/lib/briefing/media";

type Phase = "intro" | "starting" | "live" | "ended";
type EndReason = "finished" | "manual";
type TranscriptEntry = { id: number; role: "voce" | "ia"; text: string };
type SavedField = { id: string; label: string };
/** Formatos de `valor` aceitos pela rota `voice-answer` (iguais aos do texto). */
type FieldValue = string | string[] | number | { name: string; size: number }[];

/** Subconjunto estrutural da sessão Live do SDK — evita `any` sem amarrar à classe concreta. */
type VoiceSession = {
  sendRealtimeInput: (params: {
    audio?: { data?: string; mimeType?: string };
    audioStreamEnd?: boolean;
  }) => void;
  sendToolResponse: (params: {
    functionResponses:
      | { id?: string; name?: string; response?: Record<string, unknown> }
      | { id?: string; name?: string; response?: Record<string, unknown> }[];
  }) => void;
  sendClientContent: (params: unknown) => void;
  close: () => void;
};

type WakeLockSentinelLike = { release: () => Promise<void> };

/** Ordem das perguntas no questionário (para ordenar o checklist). */
const QUESTION_ORDER = (() => {
  const order = new Map<string, number>();
  for (const step of STEPS) {
    for (const q of step.questions) {
      if (!order.has(q.id)) order.set(q.id, order.size);
    }
  }
  return order;
})();

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function micErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "denied";
    if (err.name === "NotFoundError") return "Sem microfone: nenhum dispositivo de entrada foi encontrado neste aparelho.";
    if (err.name === "NotReadableError")
      return "O microfone parece estar em uso por outro app. Feche o outro app e tente de novo.";
  }
  return "Não foi possível acessar o microfone neste navegador. Tente outro navegador ou responda por texto.";
}

const DETECT_STOPWORDS = new Set([
  "para", "com", "uma", "uns", "umas", "seu", "sua", "seus", "suas", "voce", "que",
  "qual", "quais", "como", "onde", "quando", "isso", "esta", "este", "essa", "esse",
  "muito", "mais", "nas", "nos", "das", "dos", "ele", "ela", "eles", "foi", "ser",
  "tem", "meu", "minha", "meus", "diga", "fala", "fale", "conta", "pra", "mim",
  "aqui", "tela", "pode", "sem", "sobre", "entre", "ate", "aos", "nao", "sim",
  "bem", "toda", "todo", "tudo", "cada", "qualquer", "coisa", "hoje", "ainda",
  "entao", "dentro", "dois", "duas", "tres", "pode", "ditar", "digitar", "digita",
  "dita", "responda", "pergunta", "assistente",
]);

function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !DETECT_STOPWORDS.has(w));
}

/**
 * Descobre qual pergunta a IA está fazendo agora, cruzando as últimas falas
 * dela com o texto de cada pergunta pendente. Evita que o painel da tela
 * fique preso numa pergunta antiga quando a conversa já avançou.
 */
function detectCurrentQuestion(pending: string[], recentIa: string[]): string | null {
  const recent = recentIa.join(" ");
  const words = new Set(normalizeWords(recent));
  if (words.size === 0) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const id of pending) {
    const text = VOICE_SAY[id] ?? findQuestion(id)?.question.label ?? "";
    const keys = new Set(normalizeWords(text));
    let score = 0;
    for (const k of keys) {
      if (words.has(k)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return bestScore >= 2 ? best : null;
}

export function VoiceBriefing({ token }: { token: string }) {
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [error, setError] = React.useState<string | null>(null);
  const [micDenied, setMicDenied] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [savedFields, setSavedFields] = React.useState<SavedField[]>([]);
  const [pendingFields, setPendingFields] = React.useState<string[]>([]);
  /** Últimas falas da IA (para detectar a pergunta atual — só estado, sem ref). */
  const [assistantSnippets, setAssistantSnippets] = React.useState<string[]>([]);
  const [voiceFiles, setVoiceFiles] = React.useState<FileInfo[]>([]);
  const [endReason, setEndReason] = React.useState<EndReason>("manual");
  const [elapsed, setElapsed] = React.useState(0);

  const sessionRef = React.useRef<VoiceSession | null>(null);
  const micRef = React.useRef<MicStreamer | null>(null);
  const playerRef = React.useRef<AudioOutPlayer | null>(null);
  const wakeLockRef = React.useRef<WakeLockSentinelLike | null>(null);
  const intentionalCloseRef = React.useRef(false);
  const liveRef = React.useRef(false);
  const connectedRef = React.useRef(false);
  const heardModelRef = React.useRef(false);
  const heardUserRef = React.useRef(false);
  const setupTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openAtRef = React.useRef(0);
  const autoRetriedRef = React.useRef(false);
  const idRef = React.useRef(0);
  const transcriptRef = React.useRef<TranscriptEntry[]>([]);

  const textUrl = `/b/${token}`;

  /**
   * Pergunta atual no ar: primeiro tenta detectar pela fala da IA (cobre
   * conversa fora de ordem ou avanço sem salvar); senão, a primeira
   * pendente com widget.
   */
  const current = React.useMemo(() => {
    const detected = detectCurrentQuestion(pendingFields, assistantSnippets);
    if (detected) {
      const w = voiceWidgetFor(detected);
      if (w && w.widget.kind !== "none") return w;
    }
    for (const id of pendingFields) {
      const w = voiceWidgetFor(id);
      if (w && w.widget.kind !== "none") return w;
    }
    return null;
  }, [pendingFields, assistantSnippets]);

  const getMicLevel = React.useCallback(() => micRef.current?.getLevel() ?? 0, []);

  /** Transcrição só para auditoria + detecção da pergunta atual (não é exibida). */
  function pushTranscript(role: "voce" | "ia", text: string) {
    const clean = text.trim();
    if (!clean) return;
    idRef.current += 1;
    transcriptRef.current = [
      ...transcriptRef.current.slice(-99),
      { id: idRef.current, role, text: clean },
    ];
    if (role === "ia") {
      setAssistantSnippets((prev) => [...prev.slice(-1), clean]);
    }
  }

  /** Envia a transcrição acumulada para a auditoria (best-effort). */
  const postTranscript = React.useCallback(
    async (ended: boolean) => {
      if (transcriptRef.current.length === 0) return;
      const full = transcriptRef.current
        .map((t) => `${t.role === "voce" ? "Você" : "Assistente"}: ${t.text}`)
        .join("\n")
        .slice(-200000);
      try {
        await fetch(`/api/briefing/${token}/voice-transcript`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transcript: full, ended }),
        });
      } catch {
        // Auditoria é best-effort: as respostas já estão salvas campo a campo.
      }
    },
    [token],
  );

  const clearSessionTimers = React.useCallback(() => {
    if (setupTimerRef.current) {
      clearTimeout(setupTimerRef.current);
      setupTimerRef.current = null;
    }
    if (nudgeTimerRef.current) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }, []);

  const cleanupAudio = React.useCallback(() => {
    clearSessionTimers();
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => undefined);
      wakeLockRef.current = null;
    }
  }, [clearSessionTimers]);

  /** Fecha qualquer sessão anterior (cliques repetidos em iniciar). */
  function abandonPreviousSession() {
    intentionalCloseRef.current = true;
    liveRef.current = false;
    clearSessionTimers();
    try {
      sessionRef.current?.close();
    } catch {
      // noop
    }
    sessionRef.current = null;
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    intentionalCloseRef.current = false;
  }

  async function finishSession(reason: EndReason) {
    intentionalCloseRef.current = true;
    liveRef.current = false;
    try {
      sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
    } catch {
      // Sessão já fechada — segue para o encerramento local.
    }
    try {
      sessionRef.current?.close();
    } catch {
      // noop
    }
    sessionRef.current = null;
    cleanupAudio();
    setSpeaking(false);
    setConnected(false);
    connectedRef.current = false;
    // Snapshot final da transcrição para a auditoria (best-effort).
    await postTranscript(true);
    setEndReason(reason);
    setPhase("ended");
  }

  /**
   * Avisa a IA de algo que o cliente fez NA TELA (digitou, tocou, enviou).
   * A resposta já foi salva pelo `saveField` — a IA só confirma e segue.
   */
  function notifyModel(note: string) {
    try {
      sessionRef.current?.sendClientContent({
        turns: [{ role: "user", parts: [{ text: note }] }],
        turnComplete: true,
      });
    } catch {
      // Sessão fechando — nada a fazer.
    }
  }

  /**
   * Salva um campo (fala via tool call ou widget da tela) no mesmo banco do
   * texto. Atualiza checklist + pergunta atual; opcionalmente avisa a IA.
   */
  async function saveField(
    campo: string,
    valor: FieldValue,
    note: string | null,
    opts?: { skipped?: boolean },
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/briefing/${token}/voice-answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campo, valor, ...(opts?.skipped ? { skipped: true } : {}) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { pending_fields?: string[] };
      const label = findQuestion(campo)?.question.label ?? campo;
      setSavedFields((prev) =>
        prev.some((f) => f.id === campo) ? prev : [...prev, { id: campo, label }],
      );
      if (Array.isArray(data.pending_fields)) setPendingFields(data.pending_fields);
      if (note) notifyModel(note);
      return true;
    } catch {
      return false;
    }
  }

  /** Function call `salvar_resposta_briefing`: persiste no mesmo banco do texto. */
  async function handleSalvarResposta(id: string | undefined, args: Record<string, unknown>) {
    const session = sessionRef.current;
    if (!session) return;
    const campo = typeof args.campo === "string" ? args.campo : "";
    const raw = args.valor;
    const valor =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map(String).join(", ") : "";
    const respond = (output: string) => {
      try {
        session.sendToolResponse({
          functionResponses: { id, name: "salvar_resposta_briefing", response: { output } },
        });
      } catch {
        // Sessão fechando — nada a fazer.
      }
    };
    if (!campo) {
      respond("Campo inválido. Pergunte de novo e chame com o id exato do campo.");
      return;
    }
    const ok = await saveField(campo, valor, null);
    respond(
      ok
        ? "Resposta registrada com sucesso."
        : "Falha temporária ao registrar. Confirme a resposta com o cliente e chame a ferramenta de novo.",
    );
  }

  /** Function call `finalizar_briefing`: usa o mesmo submit do formulário. */
  async function handleFinalizar(id: string | undefined) {
    const session = sessionRef.current;
    if (!session) return;
    const respond = (output: string) => {
      try {
        session.sendToolResponse({
          functionResponses: { id, name: "finalizar_briefing", response: { output } },
        });
      } catch {
        // Sessão fechando — nada a fazer.
      }
    };
    try {
      const res = await fetch(`/api/briefing/${token}/submit`, { method: "POST" });
      if (res.ok) {
        respond("Briefing concluído e salvo com sucesso.");
        await finishSession("finished");
        return;
      }
      if (res.status === 422) {
        const data = (await res.json().catch(() => null)) as {
          missing?: { id: string; label: string }[];
        } | null;
        const labels = (data?.missing ?? []).map((m) => m.label).join("; ");
        respond(
          `Ainda faltam respostas obrigatórias (${labels}). Continue perguntando antes de encerrar.`,
        );
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      respond("Não consegui salvar agora. Continue a conversa e tente encerrar de novo em instantes.");
    }
  }

  function handleServerMessage(message: LiveServerMessage) {
    const session = sessionRef.current;
    if (!session) return;

    if (message.setupComplete) {
      setConnected(true);
      connectedRef.current = true;
      console.info(`[voice] setup concluído em ${Date.now() - openAtRef.current} ms`);
      if (setupTimerRef.current) {
        clearTimeout(setupTimerRef.current);
        setupTimerRef.current = null;
      }
      // Se ninguém falou nada em alguns segundos, cutuca a IA para
      // cumprimentar e fazer a primeira pergunta (ela às vezes espera
      // o cliente começar).
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = setTimeout(() => {
        nudgeTimerRef.current = null;
        if (!liveRef.current || intentionalCloseRef.current) return;
        if (heardModelRef.current || heardUserRef.current) return;
        try {
          sessionRef.current?.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: "[sistema: o cliente entrou na chamada e está ouvindo em silêncio. Cumprimente e faça a primeira pergunta do roteiro agora.]",
                  },
                ],
              },
            ],
            turnComplete: true,
          });
        } catch {
          // Sessão fechando — nada a fazer.
        }
      }, 8000);
      return;
    }
    if (message.sessionResumptionUpdate) return;
    if (message.goAway) return;

    const toolCall = message.toolCall;
    if (toolCall?.functionCalls && toolCall.functionCalls.length > 0) {
      for (const fc of toolCall.functionCalls) {
        if (fc.name === "salvar_resposta_briefing") {
          void handleSalvarResposta(fc.id, (fc.args ?? {}) as Record<string, unknown>);
        } else if (fc.name === "finalizar_briefing") {
          void handleFinalizar(fc.id);
          return;
        }
      }
      return;
    }

    // Cancelamentos de tool call não exigem ação: cada salvamento é
    // independente e idempotente — a IA chama de novo se precisar.
    void message.toolCallCancellation;

    const content = message.serverContent;
    if (!content) return;

    if (content.inputTranscription?.text) {
      heardUserRef.current = true;
      pushTranscript("voce", content.inputTranscription.text);
    }
    if (content.outputTranscription?.text) {
      heardModelRef.current = true;
      pushTranscript("ia", content.outputTranscription.text);
    }

    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) {
        heardModelRef.current = true;
        try {
          if (!playerRef.current) playerRef.current = new AudioOutPlayer();
          playerRef.current.enqueue(data);
          setSpeaking(true);
        } catch {
          // Falha isolada de áudio não derruba a sessão.
        }
      }
    }

    if (content.interrupted) {
      playerRef.current?.stop();
      setSpeaking(false);
    }
    if (content.turnComplete) {
      setSpeaking(false);
    }
  }

  /** Recarrega pendentes, checklist e arquivos do servidor (fonte da verdade). */
  const refreshState = React.useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/briefing/${token}`, { cache: "no-store" });
      if (res.status === 404) return false;
      if (!res.ok) return true;
      const data = (await res.json()) as {
        answers?: Record<string, { value?: unknown }>;
        pending_fields?: string[];
        files?: FileInfo[];
      };
      if (Array.isArray(data.pending_fields)) setPendingFields(data.pending_fields);
      const ids = Object.keys(data.answers ?? {}).filter((id) => {
        const v = data.answers?.[id]?.value;
        return (
          v !== undefined &&
          v !== null &&
          (typeof v === "string" ? v.trim() !== "" : Array.isArray(v) ? v.length > 0 : true)
        );
      });
      ids.sort((a, b) => (QUESTION_ORDER.get(a) ?? 999) - (QUESTION_ORDER.get(b) ?? 999));
      setSavedFields((prev) => {
        const known = new Set(prev.map((f) => f.id));
        const extra = ids
          .filter((id) => !known.has(id))
          .map((id) => ({ id, label: findQuestion(id)?.question.label ?? id }));
        if (extra.length === 0) return prev;
        const merged = [...prev, ...extra];
        merged.sort((a, b) => (QUESTION_ORDER.get(a.id) ?? 999) - (QUESTION_ORDER.get(b.id) ?? 999));
        return merged;
      });
      if (Array.isArray(data.files)) setVoiceFiles(data.files);
      return true;
    } catch {
      // Painel da tela aparece conforme as respostas chegam.
      return true;
    }
  }, [token]);

  async function start(opts?: { auto?: boolean }) {
    abandonPreviousSession();
    // Toque manual zera a auto-tentativa; a vigia usa uma vez (auto: true).
    if (!opts?.auto) autoRetriedRef.current = false;
    setError(null);
    setMicDenied(false);
    transcriptRef.current = [];
    setAssistantSnippets([]);
    setSavedFields([]);
    setPendingFields([]);
    setVoiceFiles([]);
    setConnected(false);
    connectedRef.current = false;
    heardModelRef.current = false;
    heardUserRef.current = false;
    setSpeaking(false);
    setElapsed(0);
    intentionalCloseRef.current = false;
    setPhase("starting");

    // 0. Estado atual (checklist + pergunta atual da tela).
    const found = await refreshState();
    if (!found) {
      setError("Este link de briefing não existe. Confira o endereço.");
      setPhase("intro");
      return;
    }

    // 1. Token efêmero (função Vercel curta; a GEMINI_API_KEY fica no servidor).
    let ephemeralToken = "";
    let model = "";
    try {
      const res = await fetch(`/api/briefing/${token}/voice-token`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        ephemeralToken?: string;
        model?: string;
        error?: string;
      } | null;
      if (res.status === 409) {
        setError("Este briefing já foi enviado. Para alterá-lo, fale com o responsável pelo projeto.");
        setPhase("intro");
        return;
      }
      if (!res.ok || !data?.ephemeralToken || !data?.model) {
        throw new Error(data?.error ?? `Serviço de voz indisponível (HTTP ${res.status}).`);
      }
      ephemeralToken = data.ephemeralToken;
      model = data.model;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível iniciar a sessão de voz. Tente de novo.",
      );
      setPhase("intro");
      return;
    }

    // 2. Microfone — precisa acontecer dentro do gesto do clique (regra do navegador).
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não permite acesso ao microfone aqui. Abra em HTTPS ou responda por texto.");
      setPhase("intro");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setMicDenied(true);
      } else {
        setError(micErrorMessage(e));
      }
      setPhase("intro");
      return;
    }

    // 3. Conexão direta do navegador com o Google (sem proxy no nosso servidor).
    try {
      const { GoogleGenAI, Modality } = await import("@google/genai");
      // Tokens efêmeros da Live API só funcionam na v1alpha (exigência do SDK).
      const ai = new GoogleGenAI({
        apiKey: ephemeralToken,
        httpOptions: { apiVersion: "v1alpha" },
      });
      const mic = new MicStreamer();
      micRef.current = mic;
      playerRef.current = new AudioOutPlayer();

      const session = (await ai.live.connect({
        model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onopen: () => {
            setPhase("live");
            liveRef.current = true;
            openAtRef.current = Date.now();
            mic.start(stream, (b64) => {
              try {
                sessionRef.current?.sendRealtimeInput({
                  audio: { data: b64, mimeType: "audio/pcm;rate=16000" },
                });
              } catch {
                // Sessão fechando — ignora pedaços restantes.
              }
            });
            // Vigia do setup: se o Google não concluir em 20 s, desiste
            // com mensagem clara em vez de travar no "Conectando…".
            if (setupTimerRef.current) clearTimeout(setupTimerRef.current);
            setupTimerRef.current = setTimeout(() => {
              setupTimerRef.current = null;
              if (intentionalCloseRef.current || !liveRef.current) return;
              if (connectedRef.current) return;
              console.error("[voice] setup da sessão Live não concluiu em 20 s");
              // Redes móveis às vezes passam na segunda tentativa: tenta uma
              // vez sozinho com token novo antes de pedir para o usuário.
              if (!autoRetriedRef.current) {
                autoRetriedRef.current = true;
                console.info("[voice] tentando de novo automaticamente…");
                void start({ auto: true });
                return;
              }
              intentionalCloseRef.current = true;
              liveRef.current = false;
              try {
                sessionRef.current?.close();
              } catch {
                // noop
              }
              sessionRef.current = null;
              cleanupAudio();
              setError(
                "O serviço de voz demorou a responder e a tentativa foi cancelada. Tente de novo em instantes.",
              );
              setPhase("intro");
            }, 20000);
          },
          onmessage: handleServerMessage,
          onerror: (e) => {
            console.error("[voice] erro na sessão Live:", e);
            if (!liveRef.current || intentionalCloseRef.current) return;
            liveRef.current = false;
            cleanupAudio();
            try {
              sessionRef.current?.close();
            } catch {
              // noop
            }
            sessionRef.current = null;
            setError("A conexão com o serviço de voz falhou. Verifique sua internet e tente de novo.");
            setPhase("intro");
          },
          onclose: (e) => {
            // Código/reason ajudam a distinguir: 1006 = rede cortou, 1011 =
            // erro no servidor, 4xxx = setup rejeitado (ex.: voz inválida).
            console.error("[voice] WebSocket Live fechado:", {
              code: e.code,
              reason: e.reason,
              wasClean: e.wasClean,
            });
            if (intentionalCloseRef.current || !liveRef.current) return;
            liveRef.current = false;
            cleanupAudio();
            sessionRef.current = null;
            setError(
              `A conexão caiu no meio da conversa (comum em redes móveis). O que você já respondeu está salvo — comece de novo que a assistente continua de onde parou. (código ${e.code})`,
            );
            setPhase("intro");
          },
        },
      })) as unknown as VoiceSession;
      sessionRef.current = session;

      // Mantém a tela ligada durante a conversa (quando o navegador permite).
      try {
        const withLock = navigator as Navigator & {
          wakeLock?: { request: (t: string) => Promise<WakeLockSentinelLike> };
        };
        if (withLock.wakeLock) {
          wakeLockRef.current = await withLock.wakeLock.request("screen");
        }
      } catch {
        // Recurso opcional — segue sem ele.
      }
    } catch (e) {
      micRef.current?.stop();
      micRef.current = null;
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // noop
        }
      }
      setError(
        e instanceof Error
          ? `Não foi possível conectar ao serviço de voz: ${e.message}`
          : "Não foi possível conectar ao serviço de voz.",
      );
      setPhase("intro");
    }
  }

  // Cronômetro + snapshots de auditoria + refresh do painel + aviso ao fechar a aba.
  React.useEffect(() => {
    if (phase !== "live") return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    const sync = setInterval(() => {
      void postTranscript(false);
      // Mantém pergunta atual e checklist sincronizados com o servidor
      // (cobre saves que chegaram por outro caminho).
      void refreshState();
    }, 10000);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearInterval(timer);
      clearInterval(sync);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [phase, postTranscript, refreshState]);

  // Desmontou com sessão aberta: fecha tudo.
  React.useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      liveRef.current = false;
      try {
        sessionRef.current?.close();
      } catch {
        // noop
      }
      sessionRef.current = null;
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return (
    <div className="flex min-h-full flex-col bg-black text-white">
      <div className="mx-auto w-full max-w-3xl px-6 pt-6 sm:px-10">
        <header className="flex items-center justify-between py-5">
          <Image
            src="/logoladoalado_fullscreen.png"
            alt="Logo"
            width={360}
            height={61}
            className="h-auto w-44 sm:w-60"
          />
          {phase === "live" ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted" aria-live="polite">
              {formatElapsed(elapsed)}
            </p>
          ) : null}
        </header>
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 sm:px-10">
        {phase === "intro" ? (
          <IntroView
            error={error}
            micDenied={micDenied}
            textUrl={textUrl}
            onStart={() => void start()}
          />
        ) : null}

        {phase === "starting" ? (
          <div className="flex flex-col items-start gap-4 py-16" role="status" aria-live="polite">
            <Loader2 size={28} aria-hidden="true" className="animate-spin text-burgundy-glow" />
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Preparando sua sessão de voz…
            </p>
            <p className="max-w-md leading-relaxed text-muted">
              Gerando a conexão segura e ligando o microfone. Leva só alguns segundos.
            </p>
          </div>
        ) : null}

        {phase === "live" ? (
          <LiveView
            connected={connected}
            speaking={speaking}
            getMicLevel={getMicLevel}
            current={current}
            savedFields={savedFields}
            token={token}
            voiceFiles={voiceFiles}
            onFilesSync={setVoiceFiles}
            onSaveField={saveField}
            onHangUp={() => void finishSession("manual")}
          />
        ) : null}

        {phase === "ended" ? (
          <EndedView reason={endReason} savedFields={savedFields} textUrl={textUrl} onRestart={() => void start()} />
        ) : null}
      </main>
    </div>
  );
}

function IntroView({
  error,
  micDenied,
  textUrl,
  onStart,
}: {
  error: string | null;
  micDenied: boolean;
  textUrl: string;
  onStart: () => void;
}) {
  return (
    <div>
      <Eyebrow lines={["Briefing por voz", "≈ 10 min · por áudio"]} />
      <h1 className="mt-6 font-display text-5xl uppercase leading-[1.05] tracking-[-0.01em] sm:text-7xl">
        Diga em voz alta
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
        Uma conversa por áudio de uns 10 minutos: você fala, a assistente pergunta e anota
        as mesmas perguntas do formulário em texto.
      </p>

      <div className="mt-8 border-l-2 border-burgundy-glow pl-4 text-[15px] leading-relaxed">
        <p className="font-medium text-white">Este briefing é feito por voz.</p>
        <p className="mt-1 text-muted">
          Ao continuar, vamos pedir acesso ao seu microfone. Se possível, use fone de ouvido
          e fique num lugar sem muito barulho.
        </p>
      </div>

      <ol className="mt-10 flex flex-col border-t border-line">
        {[
          ["01", "Toque em iniciar e libere o microfone quando o navegador pedir."],
          ["02", "Converse com calma — pode falar, digitar ou tocar nas opções que aparecem na tela."],
          ["03", "Ao final, suas respostas ficam registradas no seu briefing."],
        ].map(([n, text]) => (
          <li key={n} className="flex items-baseline gap-4 border-b border-line py-4 text-[15px]">
            <span aria-hidden="true" className="font-mono text-[11px] tracking-[0.14em] text-burgundy-glow">
              {n}
            </span>
            {text}
          </li>
        ))}
      </ol>

      {micDenied ? (
        <div role="alert" className="mt-8 rounded-card border border-burgundy-glow bg-burgundy/20 p-5">
          <p className="flex items-center gap-2 font-medium">
            <MicOff size={18} aria-hidden="true" /> Microfone bloqueado
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Você negou o acesso ao microfone, então a conversa por voz não consegue começar.
            Libere a permissão no cadeado da barra de endereço e tente de novo — ou responda
            pelo formulário em texto, que vale do mesmo jeito.
          </p>
          <Link
            href={textUrl}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-ctl border border-line px-6 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-white/10"
          >
            Responder por texto
          </Link>
        </div>
      ) : null}

      {error && !micDenied ? (
        <p role="alert" className="mt-8 rounded-card border border-line bg-ink-2 p-5 text-[15px] leading-relaxed">
          {error}
        </p>
      ) : null}

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button variant="primary" onClick={onStart}>
          <Mic size={18} aria-hidden="true" /> Iniciar briefing por voz
        </Button>
        <Link
          href={textUrl}
          className="inline-flex min-h-[48px] items-center justify-center rounded-ctl border border-line px-6 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-white/10"
        >
          Prefiro responder por texto
        </Link>
      </div>
      <p className="mt-8 text-sm leading-relaxed text-muted">
        O áudio vai direto do seu navegador para o serviço de voz do Google por uma conexão
        segura e temporária — nada passa pelo microfone sem a sua permissão.
      </p>
    </div>
  );
}

/** Barras animadas pelo volume real do microfone (ouvindo) ou pela fala da IA. */
function Spectrum({ speaking, getLevel }: { speaking: boolean; getLevel: () => number }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Aliases com tipo não-nulo: o narrowing não atravessa corpos de
    // `function` aninhadas, então ancoramos aqui no nível do efeito.
    const cv: HTMLCanvasElement = canvas;
    const c2d: CanvasRenderingContext2D = ctx;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const BARS = 28;
    const smooth: number[] = new Array(BARS).fill(0.06);
    let raf = 0;

    function roundBar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
      const r = Math.min(w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
      c.fill();
    }

    function render(c: CanvasRenderingContext2D, w: number, h: number, t: number) {
      c.clearRect(0, 0, w, h);
      const base = speaking
        ? 0.5 + 0.22 * Math.sin(t / 170) + Math.random() * 0.12
        : getLevel();
      const bw = w / BARS;
      for (let i = 0; i < BARS; i++) {
        const wave = 0.55 + 0.45 * Math.abs(Math.sin(t / 320 + i * 0.65));
        const target = Math.max(0.05, Math.min(1, base * wave + 0.03));
        const prev = smooth[i] ?? 0.06;
        smooth[i] = prev + (target - prev) * (reduced ? 1 : 0.35);
        const bh = Math.max(3, (smooth[i] ?? 0.06) * h);
        c.fillStyle = speaking ? "rgba(226, 58, 91, 0.9)" : "rgba(255, 255, 255, 0.7)";
        roundBar(c, i * bw + bw * 0.22, (h - bh) / 2, bw * 0.56, bh);
      }
    }

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.floor(rect.width * dpr));
      cv.height = Math.max(1, Math.floor(rect.height * dpr));
      render(c2d, cv.width, cv.height, performance.now());
    }
    resize();
    if (reduced) return;
    const loop = (t: number) => {
      render(c2d, cv.width, cv.height, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [speaking, getLevel]);

  return <canvas ref={canvasRef} aria-hidden="true" className="h-24 w-full" />;
}

function LiveView({
  connected,
  speaking,
  getMicLevel,
  current,
  savedFields,
  token,
  voiceFiles,
  onFilesSync,
  onSaveField,
  onHangUp,
}: {
  connected: boolean;
  speaking: boolean;
  getMicLevel: () => number;
  current: { question: { id: string; label: string }; widget: VoiceWidget } | null;
  savedFields: SavedField[];
  token: string;
  voiceFiles: FileInfo[];
  onFilesSync: (files: FileInfo[]) => void;
  onSaveField: (
    campo: string,
    valor: FieldValue,
    note: string | null,
    opts?: { skipped?: boolean },
  ) => Promise<boolean>;
  onHangUp: () => void;
}) {
  return (
    <div>
      <Eyebrow lines={["Sessão de voz ativa"]} />
      <h1 className="mt-6 font-display text-5xl uppercase leading-[1.05] tracking-[-0.01em] sm:text-6xl">
        Conversando
      </h1>

      <div
        className="mt-6 flex items-center gap-3 rounded-card border border-line bg-ink px-5 py-4"
        role="status"
        aria-live="polite"
      >
        <span
          aria-hidden="true"
          className={`inline-block size-3 shrink-0 rounded-full ${
            !connected ? "bg-muted" : speaking ? "animate-pulse bg-burgundy-glow" : "bg-white"
          }`}
        />
        <p className="text-[15px]">
          {!connected ? "Conectando…" : speaking ? "A assistente está falando…" : "Ouvindo você… pode falar."}
        </p>
      </div>

      <div className="mt-4 rounded-card border border-line bg-ink px-4 py-2">
        <Spectrum speaking={speaking} getLevel={getMicLevel} />
      </div>

      <p className="mt-4 border-l-2 border-burgundy-glow pl-4 text-sm leading-relaxed text-muted">
        Mantenha esta aba aberta até o fim do briefing — sair do navegador ou bloquear a tela
        corta a sessão.
      </p>

      {current ? (
        <section aria-label="Responder por aqui" className="mt-8 rounded-card border border-line bg-ink p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Se preferir, responda aqui
          </h2>
          <p className="mt-2 text-[15px] font-medium leading-relaxed">{current.question.label}</p>
          <div className="mt-4" key={current.question.id}>
            <AnswerWidget
              questionId={current.question.id}
              widget={current.widget}
              token={token}
              voiceFiles={voiceFiles}
              onFilesSync={onFilesSync}
              onSaveField={onSaveField}
            />
          </div>
        </section>
      ) : null}

      {savedFields.length > 0 ? (
        <section aria-label="Registrado" className="mt-6">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            Registrado
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {savedFields.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-ctl border border-line bg-ink px-4 py-3 text-[15px]"
              >
                <Check size={18} aria-hidden="true" className="shrink-0 text-burgundy-glow" />
                {f.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10">
        <Button variant="secondary" onClick={onHangUp}>
          <PhoneOff size={18} aria-hidden="true" /> Encerrar conversa
        </Button>
      </div>
    </div>
  );
}

function AnswerWidget({
  questionId,
  widget,
  token,
  voiceFiles,
  onFilesSync,
  onSaveField,
}: {
  questionId: string;
  widget: VoiceWidget;
  token: string;
  voiceFiles: FileInfo[];
  onFilesSync: (files: FileInfo[]) => void;
  onSaveField: (
    campo: string,
    valor: FieldValue,
    note: string | null,
    opts?: { skipped?: boolean },
  ) => Promise<boolean>;
}) {
  const found = findQuestion(questionId);
  const label = found?.question.label ?? questionId;
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(valor: FieldValue, note: string, opts?: { skipped?: boolean }) {
    setError(null);
    setBusy(true);
    try {
      const ok = await onSaveField(questionId, valor, note, opts);
      if (!ok) setError("Não foi possível registrar agora. Tente de novo.");
      return ok;
    } finally {
      setBusy(false);
    }
  }

  if (widget.kind === "text") {
    return (
      <TextWidget
        widget={widget}
        busy={busy}
        error={error}
        onSubmit={(text) => {
          const clean = text.trim();
          if (!clean) {
            setError("Digite algo ou responda falando.");
            return Promise.resolve(false);
          }
          // Links aceitam vários endereços separados por vírgula ou linha.
          const isLinks = found?.question.type === "links";
          const finalValor: FieldValue = isLinks
            ? clean
                .split(/[\n,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
            : clean;
          return submit(
            finalValor,
            `[sistema: o cliente digitou no campo "${label}": ${clean.slice(0, 200)}. Já salvo — confirme em uma frase e siga.]`,
          );
        }}
      />
    );
  }

  if (widget.kind === "choice") {
    return (
      <ChoiceWidget
        widget={widget}
        busy={busy}
        error={error}
        onPick={(values) => {
          const labels = values
            .map((v) => widget.options.find((o) => o.value === v)?.label ?? v)
            .join(", ");
          return submit(
            widget.multiple ? values : (values[0] ?? ""),
            `[sistema: o cliente escolheu na tela para "${label}": ${labels}. Já salvo — confirme em uma frase e siga.]`,
          );
        }}
      />
    );
  }

  if (widget.kind === "scale") {
    return (
      <ScaleWidget
        widget={widget}
        busy={busy}
        error={error}
        onConfirm={(value) =>
          submit(
            value,
            `[sistema: o cliente marcou na tela para "${label}": ${value} (0 = ${widget.left}; 100 = ${widget.right}). Já salvo — confirme em uma frase e siga.]`,
          )
        }
      />
    );
  }

  if (widget.kind === "files") {
    return (
      <FilesWidget
        questionId={questionId}
        label={label}
        widget={widget}
        token={token}
        voiceFiles={voiceFiles}
        onFilesSync={onFilesSync}
        busy={busy}
        setBusy={setBusy}
        error={error}
        setError={setError}
        onDone={(valor, count) =>
          submit(
            valor,
            `[sistema: o cliente enviou ${count} arquivo(s) pelo botão da tela para "${label}". Já registrados — confirme o recebimento em uma frase e siga.]`,
          )
        }
        onLater={() =>
          submit(
            "",
            `[sistema: o cliente disse que vai enviar "${label}" depois. Não insista — siga para a próxima pergunta.]`,
            { skipped: true },
          )
        }
      />
    );
  }

  return null;
}

function TextWidget({
  widget,
  busy,
  error,
  onSubmit,
}: {
  widget: Extract<VoiceWidget, { kind: "text" }>;
  busy: boolean;
  error: string | null;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void onSubmit(text).then((ok) => ok && setText(""));
      }}
      className="flex flex-col gap-3"
    >
      {widget.multiline ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={widget.hint}
          aria-label="Sua resposta"
          className="min-h-[96px] w-full rounded-ctl border border-line bg-ink-2 px-4 py-3 text-[15px] text-white placeholder:text-muted/70 focus:border-burgundy-glow focus:outline-none"
        />
      ) : (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          type={widget.inputMode === "text" ? "text" : widget.inputMode}
          inputMode={widget.inputMode}
          placeholder={widget.hint}
          aria-label="Sua resposta"
          autoComplete="off"
          className="min-h-[48px] w-full rounded-ctl border border-line bg-ink-2 px-4 text-[15px] text-white placeholder:text-muted/70 focus:border-burgundy-glow focus:outline-none"
        />
      )}
      {error ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          {error}
        </p>
      ) : null}
      <Button variant="primary" type="submit" disabled={busy} className="self-start">
        {busy ? <Loader2 size={18} aria-hidden="true" className="animate-spin" /> : <Send size={18} aria-hidden="true" />}
        Salvar resposta
      </Button>
    </form>
  );
}

function ChoiceWidget({
  widget,
  busy,
  error,
  onPick,
}: {
  widget: Extract<VoiceWidget, { kind: "choice" }>;
  busy: boolean;
  error: string | null;
  onPick: (values: string[]) => Promise<boolean>;
}) {
  const [selected, setSelected] = React.useState<string[]>([]);

  function toggle(value: string) {
    if (widget.multiple) {
      setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    } else {
      setSelected([value]);
      void onPick([value]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role={widget.multiple ? "group" : "radiogroup"} aria-label="Opções">
        {widget.options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={widget.multiple ? "checkbox" : "radio"}
              aria-checked={active}
              disabled={busy}
              onClick={() => toggle(o.value)}
              className={`inline-flex min-h-[44px] items-center rounded-ctl border px-4 text-[15px] transition-colors disabled:opacity-50 ${
                active
                  ? "border-burgundy-glow bg-burgundy/20 text-white"
                  : "border-line text-muted hover:border-white/25 hover:text-white"
              }`}
            >
              {active ? <Check size={16} aria-hidden="true" className="mr-2 text-burgundy-glow" /> : null}
              {o.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          {error}
        </p>
      ) : null}
      {widget.multiple ? (
        <Button
          variant="primary"
          disabled={busy || selected.length === 0}
          onClick={() => void onPick(selected)}
          className="self-start"
        >
          {busy ? <Loader2 size={18} aria-hidden="true" className="animate-spin" /> : null}
          Confirmar{selected.length > 1 ? ` (${selected.length})` : ""}
        </Button>
      ) : null}
    </div>
  );
}

function ScaleWidget({
  widget,
  busy,
  error,
  onConfirm,
}: {
  widget: Extract<VoiceWidget, { kind: "scale" }>;
  busy: boolean;
  error: string | null;
  onConfirm: (value: number) => Promise<boolean>;
}) {
  const [value, setValue] = React.useState(50);
  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className="font-display text-4xl text-burgundy-glow">
        {value}
      </p>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-label={`Escala de ${widget.left} a ${widget.right}`}
        className="w-full accent-burgundy-glow"
      />
      <div className="flex justify-between text-sm text-muted">
        <span>0 · {widget.left}</span>
        <span>{widget.right} · 100</span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          {error}
        </p>
      ) : null}
      <Button variant="primary" disabled={busy} onClick={() => void onConfirm(value)} className="self-start">
        {busy ? <Loader2 size={18} aria-hidden="true" className="animate-spin" /> : null}
        Confirmar valor
      </Button>
    </div>
  );
}

function FilesWidget({
  questionId,
  label,
  widget,
  token,
  voiceFiles,
  onFilesSync,
  busy,
  setBusy,
  error,
  setError,
  onDone,
  onLater,
}: {
  questionId: string;
  label: string;
  widget: Extract<VoiceWidget, { kind: "files" }>;
  token: string;
  voiceFiles: FileInfo[];
  onFilesSync: (files: FileInfo[]) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;
  onDone: (valor: { name: string; size: number }[], count: number) => Promise<boolean>;
  onLater: () => Promise<boolean>;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState<string[]>([]);
  const mine = voiceFiles.filter((f) => f.question_id === questionId);

  async function uploadOne(file: File): Promise<FileInfo[] | null> {
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
    const result = (await regRes.json()) as { files?: FileInfo[] };
    return result.files ?? null;
  }

  async function pickFiles(list: FileList | null) {
    setError(null);
    if (!list || busy) return;
    const selected = Array.from(list).slice(0, Math.max(0, widget.maxItems - mine.length));
    if (selected.length === 0) {
      setError(`Limite de ${widget.maxItems} arquivos nesta pergunta.`);
      return;
    }
    setBusy(true);
    let lastFiles: FileInfo[] | null = null;
    for (const file of selected) {
      setUploading((u) => [...u, file.name]);
      try {
        const files = await uploadOne(file);
        if (files) {
          lastFiles = files;
          onFilesSync(files);
        }
      } catch (e) {
        setError(e instanceof Error ? `"${file.name}": ${e.message}` : `Falha ao enviar "${file.name}".`);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    // Registra a resposta (lista de arquivos) e avisa a IA de uma vez.
    const current = (lastFiles ?? voiceFiles).filter((f) => f.question_id === questionId);
    if (current.length > 0) {
      await onDone(
        current.map((f) => ({ name: f.file_name, size: f.size_bytes ?? 0 })),
        current.length,
      );
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={widget.imagesOnly ? "image/*" : undefined}
        multiple={widget.maxItems > 1}
        disabled={busy}
        className="sr-only"
        aria-label={`Escolher arquivos para ${label}`}
        onChange={(e) => {
          void pickFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {mine.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {mine.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-ctl border border-line bg-ink-2 px-4 py-3"
            >
              <Check size={16} aria-hidden="true" className="shrink-0 text-burgundy-glow" />
              <span className="block truncate text-sm text-white">{file.file_name}</span>
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
      {error ? (
        <p role="alert" className="text-sm text-burgundy-glow">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        {mine.length < widget.maxItems ? (
          <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus size={18} aria-hidden="true" />
            {mine.length === 0 ? "Escolher arquivos" : `Adicionar (${mine.length}/${widget.maxItems})`}
          </Button>
        ) : null}
        <Button variant="ghost" disabled={busy} onClick={() => void onLater()}>
          Vou enviar depois
        </Button>
      </div>
    </div>
  );
}

function EndedView({
  reason,
  savedFields,
  textUrl,
  onRestart,
}: {
  reason: EndReason;
  savedFields: SavedField[];
  textUrl: string;
  onRestart: () => void;
}) {
  return (
    <div>
      <Eyebrow lines={[reason === "finished" ? "Briefing salvo" : "Sessão encerrada"]} />
      <h1 className="mt-6 font-display text-5xl uppercase leading-[1.05] tracking-[-0.01em] sm:text-6xl">
        {reason === "finished" ? "Briefing salvo!" : "Conversa encerrada"}
      </h1>
      <p className="mt-6 max-w-xl leading-relaxed text-muted">
        {reason === "finished"
          ? "Suas respostas por voz foram registradas e o briefing foi marcado como concluído. Abaixo, o que foi registrado."
          : "Você encerrou antes do fim do roteiro — mas o que respondeu até aqui já está registrado no seu briefing e nada se perdeu. Abaixo, o que foi registrado."}
      </p>

      {savedFields.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-2">
          {savedFields.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-ctl border border-line bg-ink px-4 py-3 text-[15px]"
            >
              <Check size={18} aria-hidden="true" className="shrink-0 text-burgundy-glow" />
              {f.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
        {reason === "finished" ? (
          <Link
            href={`${textUrl}/obrigado`}
            className="inline-flex min-h-[48px] items-center justify-center rounded-ctl bg-burgundy px-6 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-burgundy-hover"
          >
            Ver próximos passos
          </Link>
        ) : (
          <Button variant="primary" onClick={onRestart}>
            <RotateCcw size={18} aria-hidden="true" /> Começar de novo
          </Button>
        )}
        <Link
          href={textUrl}
          className="inline-flex min-h-[48px] items-center justify-center rounded-ctl border border-line px-6 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-white/10"
        >
          {reason === "finished" ? "Rever minhas respostas" : "Continuar por texto"}
        </Link>
      </div>
    </div>
  );
}
