"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { visibleQuestions, visibleSteps } from "@/lib/briefing/conditions";
import { formatAnswer } from "@/lib/briefing/format";
import type { Answer, Answers, Question, Step } from "@/lib/briefing/types";
import { Button } from "@/components/ui/Button";
import { Ornament } from "@/components/ui/Ornament";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { QuestionField, isValid } from "./fields";

const TOKEN_RE = /^[0-9a-f]{48}$/i;
const AUTOSAVE_MS = 800;
const RETRY_MS = 5000;

type Screen = { step: Step; questions: Question[] };
type Status = "loading" | "ready" | "notfound" | "error";
type SaveState = "saved" | "saving" | "offline";

type LoadData = {
  status: "rascunho" | "em_andamento" | "concluido";
  current_step: string | null;
  answers: Answers;
};

function buildScreens(answers: Answers): Screen[] {
  const screens: Screen[] = [];
  for (const step of visibleSteps(answers)) {
    const qs = visibleQuestions(step, answers);
    if (qs.length === 0) continue;
    for (let i = 0; i < qs.length; i += 3) {
      screens.push({ step, questions: qs.slice(i, i + 3) });
    }
  }
  return screens;
}

function isSettled(answers: Answers, q: Question): boolean {
  const a = answers[q.id];
  return Boolean(a && (a.skipped || a.unknown)) || isValid(q, answers);
}

function firstScreenOfStep(screens: Screen[], stepId: string): number {
  const i = screens.findIndex((s) => s.step.id === stepId);
  return i === -1 ? 0 : i;
}

export function Wizard({ token }: { token: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = React.useState<Status>(() =>
    TOKEN_RE.test(token) ? "loading" : "notfound",
  );
  const [answers, setAnswers] = React.useState<Answers>({});
  const [pos, setPos] = React.useState(0);
  const [view, setView] = React.useState<"step" | "review">("step");
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [readOnly, setReadOnly] = React.useState(false);
  const [submitState, setSubmitState] = React.useState<"idle" | "sending" | "error">("idle");
  const [missing, setMissing] = React.useState<{ id: string; label: string }[]>([]);

  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const answersRef = React.useRef(answers);
  const stepIdRef = React.useRef<string | null>(null);
  const readOnlyRef = React.useRef(readOnly);
  const skipSaveRef = React.useRef(true);
  const saveNowRef = React.useRef<(keepalive?: boolean) => Promise<void>>(async () => {});
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const screens = React.useMemo(() => buildScreens(answers), [answers]);
  const safePos = Math.min(pos, Math.max(0, screens.length - 1));
  const screen = screens[safePos];
  const stepId = screen?.step.id ?? null;

  async function saveNow(keepalive = false) {
    if (readOnlyRef.current) return;
    try {
      const res = await fetch(`/api/briefing/${token}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        keepalive,
        body: JSON.stringify({ answers: answersRef.current, current_step: stepIdRef.current }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          setReadOnly(true);
          setSaveState("saved");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      setSaveState("saved");
    } catch {
      setSaveState("offline");
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(() => void saveNowRef.current(), RETRY_MS);
    }
  }

  // Espelhos mutáveis para save/flush fora do render (padrão "latest ref":
  // roda a cada render de propósito para nunca usar valores obsoletos).
  React.useEffect(() => {
    answersRef.current = answers;
    stepIdRef.current = stepId;
    readOnlyRef.current = readOnly;
    saveNowRef.current = saveNow;
  });

  // Carrega estado salvo (retomada).
  React.useEffect(() => {
    if (status === "notfound") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/briefing/${token}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setStatus("notfound");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as LoadData;
        if (cancelled) return;
        const loaded: Answers = data.answers ?? {};
        const initial = buildScreens(loaded);
        let start = 0;
        if (data.current_step) {
          const atStep = initial.findIndex((s) => s.step.id === data.current_step);
          if (atStep !== -1) start = atStep;
        } else {
          const firstOpen = initial.findIndex((s) => s.questions.some((q) => !isSettled(loaded, q)));
          if (firstOpen !== -1) start = firstOpen;
        }
        skipSaveRef.current = true;
        setAnswers(loaded);
        setPos(start);
        setReadOnly(data.status === "concluido");
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Autosave com debounce.
  React.useEffect(() => {
    if (status !== "ready" || readOnly) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void saveNowRef.current(), AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [answers, stepId, status, readOnly]);

  // Salva ao trocar de etapa, esconder a aba ou fechar.
  // (usa só refs estáveis + latest-ref, por isso sem dependências.)
  React.useEffect(() => {
    const flush = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void saveNowRef.current(true);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  // Foco no título a cada tela + volta ao topo.
  React.useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [safePos, view, status]);

  function setAnswer(id: string, answer: Answer) {
    setMissing((m) => m.filter((x) => x.id !== id));
    setAnswers((prev) => ({ ...prev, [id]: answer }));
  }

  function go(positive: 1 | -1) {
    setPos((p) => Math.min(Math.max(0, p + positive), Math.max(0, screens.length - 1)));
  }

  function jumpToQuestion(qid: string) {
    const i = screens.findIndex((s) => s.questions.some((q) => q.id === qid));
    if (i !== -1) {
      setPos(i);
      setView("step");
    }
  }

  async function submit() {
    setSubmitState("sending");
    setMissing([]);
    try {
      if (timerRef.current) clearTimeout(timerRef.current);
      await saveNow();
      const res = await fetch(`/api/briefing/${token}/submit`, { method: "POST" });
      if (res.status === 409) {
        setReadOnly(true);
        setView("step");
        return;
      }
      if (res.status === 422) {
        const data = (await res.json()) as { missing?: { id: string; label: string }[] };
        setMissing(data.missing ?? []);
        setSubmitState("error");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push(`/b/${token}/obrigado`);
    } catch {
      setSubmitState("error");
    }
  }

  if (status === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Carregando…</p>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
        <h1 className="font-display text-5xl uppercase leading-[0.9]">Link inválido</h1>
        <p className="leading-relaxed text-muted">
          Este link de briefing não existe ou expirou. Confira o endereço ou peça um novo link a quem te enviou.
        </p>
      </div>
    );
  }

  if (status === "error" || !screen) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
        <h1 className="font-display text-5xl uppercase leading-[0.9]">Sem conexão</h1>
        <p className="leading-relaxed text-muted">Não foi possível carregar o briefing. Verifique sua internet e tente de novo.</p>
        <Button variant="secondary" onClick={() => window.location.reload()} className="self-start">
          Tentar de novo
        </Button>
      </div>
    );
  }

  const total = screens.length;
  const current = view === "review" ? total : safePos + 1;
  const stepOrder = visibleSteps(answers);
  const currentStepIdx = Math.max(
    0,
    stepOrder.findIndex((s) => s.id === screen.step.id),
  );
  const minutesLeft =
    view === "review"
      ? undefined
      : stepOrder
          .slice(currentStepIdx)
          .reduce((n, s) => n + s.estimatedMinutes, 0);

  return (
    <div className="flex min-h-full flex-col bg-black text-white">
      <div className="mx-auto w-full max-w-3xl px-6 pt-6 sm:px-10">
        <ProgressBar current={current} total={total} minutesLeft={minutesLeft} />
        <header className="flex items-center justify-between py-5">
          <Image src="/logoladoalado.png" alt="Logo" width={150} height={28} className="h-7 w-auto" />
          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted" aria-live="polite">
              {saveState === "saving" ? "Salvando…" : saveState === "offline" ? "Sem conexão, tentando de novo" : "Salvo ✓"}
            </p>
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 sm:px-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view === "review" ? "review" : `${screen.step.id}-${safePos}`}
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {view === "review" ? (
              <ReviewView
                answers={answers}
                titleRef={titleRef}
                readOnly={readOnly}
                submitState={submitState}
                missing={missing}
                onEdit={(stepIdToEdit) => {
                  setPos(firstScreenOfStep(screens, stepIdToEdit));
                  setView("step");
                }}
                onBack={() => setView("step")}
                onSubmit={submit}
                onJump={jumpToQuestion}
              />
            ) : readOnly ? (
              <ReadOnlyView answers={answers} titleRef={titleRef} token={token} />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canContinue(screen.questions, answers)) {
                    if (safePos >= total - 1) {
                      if (timerRef.current) clearTimeout(timerRef.current);
                      void saveNow();
                      setView("review");
                    } else {
                      go(1);
                    }
                  }
                }}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:text-xs">
                  <Ornament className="mr-2" />
                  Etapa {screen.step.id}
                </p>
                <h1 ref={titleRef} tabIndex={-1} className="mt-4 font-display text-5xl uppercase leading-[0.9] tracking-[-0.01em] focus:outline-none sm:text-6xl">
                  {screen.step.title}
                </h1>
                {screen.step.subtitle ? <p className="mt-4 leading-relaxed text-muted">{screen.step.subtitle}</p> : null}
                {safePos === 0 ? (
                  <p className="mt-4 border-l-2 border-burgundy-glow pl-4 text-sm leading-relaxed text-muted">
                    Você pode sair e voltar quando quiser — este link guarda tudo.
                  </p>
                ) : null}

                <div className="mt-10 flex flex-col gap-10">
                  {screen.questions.map((q) => (
                    <QuestionField key={q.id} question={q} answers={answers} setAnswer={setAnswer} />
                  ))}
                </div>

                <div className="mt-12 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button variant="secondary" type="button" onClick={() => go(-1)} disabled={safePos === 0} className="sm:w-auto">
                    <ArrowLeft size={18} aria-hidden="true" /> Voltar
                  </Button>
                  <Button variant="primary" type="submit" disabled={!canContinue(screen.questions, answers)} className="sm:w-auto">
                    {safePos >= total - 1 ? "Revisar respostas" : "Continuar"} <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function canContinue(questions: Question[], answers: Answers): boolean {
  return questions.filter((q) => q.required).every((q) => isValid(q, answers));
}

function ReviewView({
  answers,
  titleRef,
  readOnly,
  submitState,
  missing,
  onEdit,
  onBack,
  onSubmit,
  onJump,
}: {
  answers: Answers;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  readOnly: boolean;
  submitState: "idle" | "sending" | "error";
  missing: { id: string; label: string }[];
  onEdit: (stepId: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  onJump: (qid: string) => void;
}) {
  const steps = visibleSteps(answers).filter((s) => visibleQuestions(s, answers).length > 0);
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:text-xs">
        <Ornament className="mr-2" />
        Revisão
      </p>
      <h1 ref={titleRef} tabIndex={-1} className="mt-4 font-display text-5xl uppercase leading-[0.9] tracking-[-0.01em] focus:outline-none sm:text-6xl">
        Confira antes de enviar
      </h1>
      <p className="mt-4 leading-relaxed text-muted">Toque em editar para ajustar qualquer resposta.</p>

      {missing.length > 0 ? (
        <div role="alert" className="mt-8 rounded-card border border-burgundy-glow bg-burgundy/20 p-5">
          <p className="font-medium">Faltam respostas obrigatórias:</p>
          <ul className="mt-3 flex flex-col gap-2">
            {missing.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onJump(m.id)} className="underline underline-offset-4 hover:text-white">
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-10 flex flex-col">
        {steps.map((step) => (
          <section key={step.id} className="border-t border-line py-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl uppercase tracking-[-0.01em]">{step.title}</h2>
              {!readOnly ? (
                <button type="button" onClick={() => onEdit(step.id)} className="shrink-0 text-sm text-muted underline underline-offset-4 hover:text-white">
                  Editar
                </button>
              ) : null}
            </div>
            <dl className="mt-4 flex flex-col gap-3">
              {visibleQuestions(step, answers).map((q) => (
                <div key={q.id} className="grid gap-1 sm:grid-cols-[200px_1fr] sm:gap-4">
                  <dt className="text-sm text-muted">{q.label}</dt>
                  <dd className="text-[15px] leading-relaxed">{formatAnswer(q.id, answers[q.id])}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      {!readOnly ? (
        <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="secondary" type="button" onClick={onBack} className="sm:w-auto">
            <ArrowLeft size={18} aria-hidden="true" /> Voltar
          </Button>
          <Button variant="primary" type="button" onClick={onSubmit} disabled={submitState === "sending"} className="sm:w-auto">
            {submitState === "sending" ? "Enviando…" : "Enviar briefing"} <Check size={18} aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {submitState === "error" && missing.length === 0 ? (
        <p role="alert" className="mt-4 text-sm text-burgundy-glow">
          Não foi possível enviar. Confira sua conexão e tente de novo.
        </p>
      ) : null}
    </div>
  );
}

function ReadOnlyView({
  answers,
  titleRef,
  token,
}: {
  answers: Answers;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  token: string;
}) {
  const steps = visibleSteps(answers).filter((s) => visibleQuestions(s, answers).length > 0);
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-burgundy-glow sm:text-xs">
        <Ornament className="mr-2" />
        Briefing enviado ✓
      </p>
      <h1 ref={titleRef} tabIndex={-1} className="mt-4 font-display text-5xl uppercase leading-[0.9] tracking-[-0.01em] focus:outline-none sm:text-6xl">
        Recebido. Obrigado!
      </h1>
      <p className="mt-4 leading-relaxed text-muted">
        Este link agora está em modo leitura. Abaixo, suas respostas registradas — e os <a href={`/b/${token}/obrigado`} className="underline underline-offset-4 hover:text-white">próximos passos</a>.
      </p>
      <div className="mt-10 flex flex-col">
        {steps.map((step) => (
          <section key={step.id} className="border-t border-line py-6">
            <h2 className="font-display text-2xl uppercase tracking-[-0.01em]">{step.title}</h2>
            <dl className="mt-4 flex flex-col gap-3">
              {visibleQuestions(step, answers).map((q) => (
                <div key={q.id} className="grid gap-1 sm:grid-cols-[200px_1fr] sm:gap-4">
                  <dt className="text-sm text-muted">{q.label}</dt>
                  <dd className="text-[15px] leading-relaxed">{formatAnswer(q.id, answers[q.id])}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
