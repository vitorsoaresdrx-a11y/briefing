import type { Answers, Condition, Question, Step } from "./types";
import { STEPS } from "./steps";

function answerValue(answers: Answers, field: string): unknown {
  return answers[field]?.value;
}

export function evalCondition(cond: Condition | undefined, answers: Answers): boolean {
  if (!cond) return true;
  if ("all" in cond) return cond.all.every((c) => evalCondition(c, answers));
  if ("any" in cond) return cond.any.some((c) => evalCondition(c, answers));
  const value = answerValue(answers, cond.field);
  if ("equals" in cond) return value === cond.equals;
  if ("includes" in cond) return Array.isArray(value) && value.includes(cond.includes);
  if ("in" in cond) {
    if (Array.isArray(value)) return value.some((v) => cond.in.includes(v));
    return typeof value === "string" && cond.in.includes(value);
  }
  return false;
}

export function isQuestionVisible(q: Question, answers: Answers): boolean {
  return evalCondition(q.showIf, answers);
}

export function isStepVisible(step: Step, answers: Answers): boolean {
  return evalCondition(step.showIf, answers);
}

/** Etapas visíveis para as respostas atuais, na ordem do questionário. */
export function visibleSteps(answers: Answers): Step[] {
  return STEPS.filter((s) => isStepVisible(s, answers));
}

/** Perguntas visíveis de uma etapa para as respostas atuais. */
export function visibleQuestions(step: Step, answers: Answers): Question[] {
  return step.questions.filter((q) => isQuestionVisible(q, answers));
}

/** Todas as perguntas visíveis (etapa + pergunta), na ordem. */
export function visibleQuestionsAll(answers: Answers): { step: Step; question: Question }[] {
  const out: { step: Step; question: Question }[] = [];
  for (const step of visibleSteps(answers)) {
    for (const question of visibleQuestions(step, answers)) {
      out.push({ step, question });
    }
  }
  return out;
}

export function findQuestion(id: string): { step: Step; question: Question } | null {
  for (const step of STEPS) {
    const question = step.questions.find((q) => q.id === id);
    if (question) return { step, question };
  }
  return null;
}
