import { findQuestion } from "@/lib/briefing/conditions";
import type { Question } from "@/lib/briefing/types";

/**
 * Widgets de apoio na tela de voz — SOMENTE leitura do questionário.
 * Este módulo é client-safe (sem "server-only"): importa só `steps.ts`
 * via `conditions.ts`, igual ao wizard em texto.
 */

export type VoiceWidget =
  | {
      kind: "text";
      multiline: boolean;
      inputMode: "text" | "email" | "tel" | "url";
      hint: string;
    }
  | { kind: "choice"; multiple: boolean; options: { value: string; label: string }[] }
  | { kind: "scale"; left: string; right: string }
  | { kind: "files"; maxItems: number; imagesOnly: boolean }
  | { kind: "none" };

/** Widget adequado para responder a pergunta também pela tela (não só por voz). */
export function voiceWidgetFor(questionId: string): { question: Question; widget: VoiceWidget } | null {
  const found = findQuestion(questionId);
  if (!found) return null;
  const { question } = found;

  switch (question.type) {
    case "text":
      return {
        question,
        widget: { kind: "text", multiline: false, inputMode: "text", hint: "Digite aqui ou responda falando" },
      };
    case "textarea":
      return {
        question,
        widget: { kind: "text", multiline: true, inputMode: "text", hint: "Digite aqui ou responda falando" },
      };
    case "email":
      return {
        question,
        widget: { kind: "text", multiline: false, inputMode: "email", hint: "Digite o e-mail ou dite para a assistente" },
      };
    case "phone":
      return {
        question,
        widget: { kind: "text", multiline: false, inputMode: "tel", hint: "Digite com DDD ou dite para a assistente" },
      };
    case "url":
      return {
        question,
        widget: { kind: "text", multiline: false, inputMode: "url", hint: "Digite o endereço ou dite para a assistente" },
      };
    case "links":
      return {
        question,
        widget: {
          kind: "text",
          multiline: true,
          inputMode: "url",
          hint: "Um endereço por linha, ou dite para a assistente",
        },
      };
    case "colors":
      return {
        question,
        widget: {
          kind: "text",
          multiline: false,
          inputMode: "text",
          hint: "Ex.: #6D001A, ou diga que prefere sugestão",
        },
      };
    case "single":
    case "cards":
      if (!question.options?.length) return { question, widget: { kind: "none" } };
      return {
        question,
        widget: {
          kind: "choice",
          multiple: false,
          options: question.options.map((o) => ({ value: o.value, label: o.label })),
        },
      };
    case "multi":
      if (!question.options?.length) return { question, widget: { kind: "none" } };
      return {
        question,
        widget: {
          kind: "choice",
          multiple: true,
          options: question.options.map((o) => ({ value: o.value, label: o.label })),
        },
      };
    case "slider":
      return {
        question,
        widget: {
          kind: "scale",
          left: question.leftLabel ?? "0",
          right: question.rightLabel ?? "100",
        },
      };
    case "file":
      return {
        question,
        widget: {
          kind: "files",
          maxItems: question.maxItems ?? 5,
          imagesOnly: question.id !== "files_docs",
        },
      };
    default:
      return { question, widget: { kind: "none" } };
  }
}
