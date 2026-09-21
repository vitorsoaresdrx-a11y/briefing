import { visibleQuestionsAll } from "./conditions";
import type { Answer, Answers, Question } from "./types";

export function questionWeight(q: Question): number {
  if (q.weight) return q.weight;
  return q.required ? 3 : 1;
}

function hasValue(answer: Answer | undefined): boolean {
  if (!answer || answer.skipped || answer.unknown) return false;
  const v = answer.value;
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0 && v.some((i) => String(i ?? "").trim() !== "");
  if (typeof v === "number") return true;
  if (typeof v === "boolean") return true;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return false;
}

export function isAnswered(q: Question, answers: Answers): boolean {
  return hasValue(answers[q.id]);
}

export type Completeness = {
  percent: number;
  answeredWeight: number;
  totalWeight: number;
  /** Ids das perguntas visíveis não respondidas. */
  pending: string[];
};

/** Completude sobre perguntas visíveis (após lógica condicional). */
export function calcCompleteness(answers: Answers): Completeness {
  const visible = visibleQuestionsAll(answers);
  let totalWeight = 0;
  let answeredWeight = 0;
  const pending: string[] = [];
  for (const { question } of visible) {
    const w = questionWeight(question);
    totalWeight += w;
    if (isAnswered(question, answers)) {
      answeredWeight += w;
    } else {
      pending.push(question.id);
    }
  }
  const percent = totalWeight === 0 ? 0 : Math.round((answeredWeight / totalWeight) * 100);
  return { percent, answeredWeight, totalWeight, pending };
}

/** Ids das obrigatórias visíveis ainda sem resposta (bloqueiam o envio). */
export function missingRequired(answers: Answers): string[] {
  return visibleQuestionsAll(answers)
    .filter(({ question }) => question.required)
    .filter(({ question }) => !isAnswered(question, answers))
    .map(({ question }) => question.id);
}
