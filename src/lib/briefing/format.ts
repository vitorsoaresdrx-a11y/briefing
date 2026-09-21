import { findQuestion } from "./conditions";
import type { Answer, Question } from "./types";

export type StoredFile = { name: string; size: number };

function optionLabel(q: Question, value: string): string {
  return q.options?.find((o) => o.value === value)?.label ?? value;
}

function formatValue(q: Question, answer: Answer): string {
  const v = answer.value;
  switch (q.type) {
    case "single":
    case "cards":
      return typeof v === "string" ? optionLabel(q, v) : "—";
    case "multi":
      return Array.isArray(v) && v.length > 0
        ? v.map((s) => optionLabel(q, String(s))).join(", ")
        : "—";
    case "links":
      return Array.isArray(v) && v.length > 0 ? v.map(String).join(", ") : "—";
    case "colors":
      return typeof v === "string" && v.trim() !== "" ? v.trim().toUpperCase() : "—";
    case "slider": {
      if (typeof v !== "number") return "—";
      const left = q.leftLabel ?? "";
      const right = q.rightLabel ?? "";
      return `${left} ${v} ${right}`.trim();
    }
    case "file": {
      const files = (Array.isArray(v) ? v : []) as StoredFile[];
      return files.length > 0 ? files.map((f) => f.name).join(", ") : "—";
    }
    default:
      return typeof v === "string" && v.trim() !== "" ? v.trim() : "—";
  }
}

/** Texto legível de uma resposta para revisão, resumo e impressão. */
export function formatAnswer(questionId: string, answer: Answer | undefined): string {
  const found = findQuestion(questionId);
  if (!found) return "—";
  if (found.question.type === "notice") return found.question.help;
  if (!answer || answer.skipped) return "Não respondido";
  if (answer.unknown) return found.question.unknownLabel ?? "Não sabe";
  return formatValue(found.question, answer);
}

/** Rótulo legível de uma pergunta a partir do id. */
export function questionLabel(questionId: string): string {
  return findQuestion(questionId)?.question.label ?? questionId;
}
