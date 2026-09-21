"use client";

import type { AudioInfo, FileInfo } from "@/lib/briefing/media";
import type { Answer, Answers, Question } from "@/lib/briefing/types";
import { Button } from "@/components/ui/Button";
import { Chips } from "@/components/ui/Chips";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Input } from "@/components/ui/Input";
import { LinkListInput } from "@/components/ui/LinkListInput";
import { OptionCard } from "@/components/ui/OptionCard";
import { Slider } from "@/components/ui/Slider";
import { Textarea } from "@/components/ui/Textarea";
import { AudioRecorder, type AudioSync } from "@/components/audio/AudioRecorder";
import { FileField, type FileSync } from "./FileField";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export function isValidUrl(v: string): boolean {
  const s = v.trim();
  if (s === "") return false;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return Boolean(u.hostname.includes("."));
  } catch {
    return false;
  }
}

export function isValid(q: Question, answers: Answers): boolean {
  if (q.type === "notice") return true;
  const ans = answers[q.id];
  if (!ans || ans.skipped || ans.unknown) return false;
  const v = ans.value;
  switch (q.type) {
    case "text":
    case "textarea":
    case "phone":
      return typeof v === "string" && v.trim() !== "";
    case "email":
      return typeof v === "string" && isValidEmail(v);
    case "url":
      return typeof v === "string" && isValidUrl(v);
    case "single":
    case "cards":
      return typeof v === "string" && v !== "";
    case "multi":
      return Array.isArray(v) && v.length > 0;
    case "slider":
      return typeof v === "number";
    case "links":
      return Array.isArray(v) && v.some((s) => String(s).trim() !== "");
    case "colors":
      return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());
    case "file":
      return Array.isArray(v) && v.length > 0;
    default:
      return false;
  }
}

function str(ans: Answer | undefined): string {
  return typeof ans?.value === "string" ? ans.value : "";
}

function strArray(ans: Answer | undefined): string[] {
  return Array.isArray(ans?.value) ? (ans.value as string[]) : [];
}

interface FieldProps {
  question: Question;
  answers: Answers;
  setAnswer: (id: string, answer: Answer) => void;
  token: string;
  audios: AudioInfo[];
  files: FileInfo[];
  onMediaSync: (result: { answers: Answers; audios?: AudioInfo[]; files?: FileInfo[] }) => void;
}

/**
 * Cabeçalho padrão da pergunta (ver 7.1): título, ajuda em muted 14px e
 * exemplo em itálico com prefixo "Ex.:".
 */
function FieldHeader({ question, htmlFor }: { question: Question; htmlFor?: string }) {
  const title =
    htmlFor != null ? (
      <label htmlFor={htmlFor} className="text-sm font-medium text-white">
        {question.label}
      </label>
    ) : (
      <p className="text-sm font-medium text-white">{question.label}</p>
    );
  return (
    <div className="flex flex-col gap-1.5">
      {title}
      <p className="text-sm leading-normal text-muted">{question.help}</p>
      {question.example ? (
        <p className="text-sm italic leading-normal text-muted">Ex.: {question.example}</p>
      ) : null}
    </div>
  );
}

const SKIP_HINT = "Você poderá responder depois pelo mesmo link.";
const UNKNOWN_HINT = "Sem problema, nós ajudamos com isso.";

export function QuestionField({ question: q, answers, setAnswer, token, audios, files, onMediaSync }: FieldProps) {
  const ans = answers[q.id];
  const set = (value: unknown) => setAnswer(q.id, { value });
  // Edição manual preserva o áudio vinculado (transcrição continua editável).
  const setText = (value: string) =>
    setAnswer(q.id, { value, ...(ans?.audioId ? { audioId: ans.audioId } : {}) });

  if (q.type === "notice") {
    return (
      <div role="note" className="rounded-card border border-line bg-ink p-5">
        <p className="text-[15px] leading-relaxed">{q.help}</p>
      </div>
    );
  }

  let control: React.ReactNode = null;
  // id real do campo (para o <label> do cabeçalho); controles de escolha usam grupo com aria-label.
  let fieldId: string | undefined;

  switch (q.type) {
    case "text":
      fieldId = q.id;
      control = (
        <Input label={q.label} hideLabel id={q.id} placeholder={q.placeholder} value={str(ans)} onChange={(e) => set(e.target.value)} />
      );
      break;
    case "phone":
      fieldId = q.id;
      control = (
        <Input label={q.label} hideLabel id={q.id} type="tel" inputMode="tel" autoComplete="tel" placeholder={q.placeholder} value={str(ans)} onChange={(e) => set(e.target.value)} />
      );
      break;
    case "email": {
      fieldId = q.id;
      const typed = str(ans);
      control = (
        <Input
          label={q.label}
          hideLabel
          id={q.id}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={q.placeholder}
          value={typed}
          onChange={(e) => set(e.target.value)}
          error={typed !== "" && !isValidEmail(typed) ? "Esse e-mail parece incompleto. Confira se tem o @." : undefined}
        />
      );
      break;
    }
    case "url": {
      fieldId = q.id;
      const typed = str(ans);
      control = (
        <Input
          label={q.label}
          hideLabel
          id={q.id}
          type="url"
          inputMode="url"
          placeholder={q.placeholder ?? "www.exemplo.com.br"}
          value={typed}
          onChange={(e) => set(e.target.value)}
          error={typed !== "" && !isValidUrl(typed) ? "Esse link não parece um endereço de site. Ex.: www.suaempresa.com.br" : undefined}
        />
      );
      break;
    }
    case "textarea":
      fieldId = q.id;
      control = (
        <div className="flex flex-col gap-3">
          <Textarea label={q.label} hideLabel id={q.id} placeholder={q.placeholder} value={str(ans)} onChange={(e) => setText(e.target.value)} />
          {q.allowAudio ? (
            <AudioRecorder
              token={token}
              questionId={q.id}
              existingAudioId={ans?.audioId ?? audios.filter((a) => a.question_id === q.id).at(-1)?.id}
              onSync={(r: AudioSync) => onMediaSync(r)}
            />
          ) : null}
        </div>
      );
      break;
    case "single": {
      const current = typeof ans?.value === "string" ? ans.value : "";
      control = (
        <div role="radiogroup" aria-label={q.label} className="flex flex-col gap-2">
          {q.options?.map((o) => {
            const selected = current === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set(o.value)}
                className={[
                  "flex min-h-[48px] items-center gap-3 rounded-ctl border px-4 text-left text-[15px] transition-colors",
                  selected ? "border-burgundy-glow bg-burgundy/20 text-white" : "border-line text-muted hover:border-white/25 hover:text-white",
                ].join(" ")}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-burgundy-glow" : "border-line"}`}
                >
                  {selected ? <span className="h-2 w-2 rounded-full bg-burgundy-glow" /> : null}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case "multi":
      control = (
        <Chips
          label={q.label}
          hideLabel
          options={q.options ?? []}
          selected={strArray(ans)}
          onToggle={(v) => {
            const cur = strArray(ans);
            set(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
          }}
        />
      );
      break;
    case "cards": {
      const current = typeof ans?.value === "string" ? ans.value : "";
      control = (
        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={q.label}>
          {q.options?.map((o) => (
            <OptionCard key={o.value} title={o.label} description={o.description} selected={current === o.value} onSelect={() => set(o.value)} />
          ))}
        </div>
      );
      break;
    }
    case "slider": {
      fieldId = q.id;
      const current = typeof ans?.value === "number" ? ans.value : 5;
      control = (
        <Slider label={q.label} hideLabel id={q.id} value={current} min={0} max={10} step={1} leftLabel={q.leftLabel} rightLabel={q.rightLabel} onChange={(v) => set(v)} />
      );
      break;
    }
    case "links":
      control = (
        <LinkListInput label={q.label} hideLabel values={strArray(ans)} maxItems={q.maxItems ?? 5} placeholder={q.placeholder ?? "www.exemplo.com.br"} onChange={set} />
      );
      break;
    case "colors":
      control = (
        <ColorPicker
          label={q.label}
          hideLabel
          value={str(ans)}
          unknown={ans?.unknown}
          unknownLabel={q.unknownLabel ?? "Não tenho, me sugira"}
          onChange={set}
          onUnknownChange={(u) => setAnswer(q.id, u ? { value: null, unknown: true } : { value: null })}
        />
      );
      break;
    case "file":
      control = (
        <FileField
          token={token}
          questionId={q.id}
          maxItems={q.maxItems ?? 5}
          files={files.filter((f) => f.question_id === q.id)}
          onSync={(r: FileSync) => onMediaSync(r)}
        />
      );
      break;
  }

  const skipped = ans?.skipped === true;
  const unknown = ans?.unknown === true && q.type !== "colors";
  const unknownButtonLabel = q.unknownLabel ?? "Não sei";

  return (
    <div className="flex flex-col gap-3">
      <FieldHeader question={q} htmlFor={fieldId} />
      {control}
      {!q.required && !skipped && !unknown ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            title={SKIP_HINT}
            aria-label={`Pular por enquanto. ${SKIP_HINT}`}
            onClick={() => setAnswer(q.id, { value: null, skipped: true })}
            className="min-h-[44px] px-4 text-sm"
          >
            Pular por enquanto
          </Button>
          {q.allowUnknown ? (
            <Button
              variant="ghost"
              title={UNKNOWN_HINT}
              aria-label={`${unknownButtonLabel}. ${UNKNOWN_HINT}`}
              onClick={() => setAnswer(q.id, { value: null, unknown: true })}
              className="min-h-[44px] px-4 text-sm"
            >
              {unknownButtonLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
      {(skipped || unknown) && (
        <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <span>{skipped ? "Pulado" : (q.unknownLabel ?? "Não sei")}</span>
          <button type="button" onClick={() => setAnswer(q.id, { value: null })} className="underline underline-offset-4 hover:text-white">
            Responder
          </button>
        </p>
      )}
    </div>
  );
}
