import { visibleSteps, visibleQuestions } from "./conditions";
import { calcCompleteness } from "./completeness";
import { formatAnswer } from "./format";
import type { Answers } from "./types";

/**
 * Markdown organizado por etapa com todas as respostas legíveis.
 * Alimenta o "Copiar resumo" do painel e a versão de impressão.
 */
export function buildSummary(answers: Answers): string {
  const { percent, pending } = calcCompleteness(answers);
  const lines: string[] = ["# Resumo do briefing", ""];
  const name = answers["name"]?.value;
  const company = answers["company"]?.value;
  if (typeof name === "string" && name.trim() !== "") lines.push(`Cliente: ${name.trim()}`);
  if (typeof company === "string" && company.trim() !== "") lines.push(`Empresa: ${company.trim()}`);
  lines.push(`Completude: ${percent}%`, "");

  for (const step of visibleSteps(answers)) {
    const questions = visibleQuestions(step, answers);
    if (questions.length === 0) continue;
    lines.push(`## ${step.title}`, "");
    for (const q of questions) {
      const text = formatAnswer(q.id, answers[q.id]);
      lines.push(`- **${q.label}:** ${text}`);
    }
    lines.push("");
  }

  if (pending.length > 0) {
    lines.push("## Pendências", "");
    for (const id of pending) {
      const found = visibleSteps(answers)
        .flatMap((s) => visibleQuestions(s, answers))
        .find((q) => q.id === id);
      lines.push(`- ${found ? `${found.label}` : id} (\`${id}\`)`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
