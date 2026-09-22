import "server-only";
import { STEPS } from "./steps";
import { VOICE_SAY } from "./voice-say";
import type { Answers, Condition, Question, Step } from "./types";

/**
 * Roteiro do briefing por voz — gerado a partir de `steps.ts`, a mesma fonte
 * da verdade usada pelo wizard em texto. Só avisos (`notice`) ficam de fora;
 * perguntas de upload (`file`) participam pelo botão de envio na tela.
 */
const VOICE_EXCLUDED_TYPES = new Set(["notice"]);

export function voiceQuestions(): { step: Step; question: Question }[] {
  const out: { step: Step; question: Question }[] = [];
  for (const step of STEPS) {
    for (const question of step.questions) {
      if (VOICE_EXCLUDED_TYPES.has(question.type)) continue;
      out.push({ step, question });
    }
  }
  return out;
}

/** Ids válidos para a function call `salvar_resposta_briefing` (fala). */
export function voiceFieldIds(): string[] {
  return voiceQuestions()
    .filter(({ question }) => question.type !== "file")
    .map(({ question }) => question.id);
}

/**
 * Ids aceitos pela rota `voice-answer` (fala + widgets da tela).
 * Inclui os uploads, que chegam pelo botão de envio — nunca ditados.
 */
export function voiceAnswerFieldIds(): string[] {
  return voiceQuestions().map(({ question }) => question.id);
}

function describeCondition(cond: Condition | undefined): string | null {
  if (!cond) return null;
  if ("all" in cond) {
    const parts = cond.all.map(describeCondition).filter(Boolean);
    return parts.length ? parts.join(" E ") : null;
  }
  if ("any" in cond) {
    const parts = cond.any.map(describeCondition).filter(Boolean);
    return parts.length ? parts.join(" OU ") : null;
  }
  if ("equals" in cond) return `o campo "${cond.field}" foi respondido como "${cond.equals}"`;
  if ("includes" in cond) return `o campo "${cond.field}" inclui "${cond.includes}"`;
  if ("in" in cond) return `o campo "${cond.field}" está entre [${cond.in.join(", ")}]`;
  return null;
}

function describeOptions(q: Question): string {
  if (!q.options?.length) return "";
  return q.options
    .map((o) => `"${o.value}" = ${o.label}${o.description ? ` (${o.description})` : ""}`)
    .join("; ");
}

function describeQuestion(q: Question): string {
  const say = VOICE_SAY[q.id];
  const parts = say
    ? [`Pergunta (diga com naturalidade, sem ler literalmente): "${say}"`]
    : [
        `  - id="${q.id}": "${q.label}"`,
        `Contexto (não leia isso em voz alta, é só para você entender a pergunta): ${q.help}`,
      ];
  if (!say && q.example) parts.push(`Exemplo de resposta: ${q.example}`);
  if (q.options?.length) {
    parts.push(
      `Referência interna (não leia a lista em voz alta; use para entender e classificar a resposta): ${describeOptions(q)}.`,
    );
  }
  if (q.type === "file") {
    parts.push(
      `ARQUIVOS — nunca peça para o cliente ditar arquivos. Peça para enviar pelo botão "Escolher arquivos" aqui da tela, ou dizer que manda depois. Se ele enviar, você recebe um aviso "[sistema: ...]" confirmando — aí confirme o recebimento em uma frase e siga. Se disser que manda depois, chame "salvar_resposta_briefing" com este campo e valor vazio e siga sem insistir.`,
    );
  }
  if (!say && q.type === "slider") {
    parts.push(
      `É uma escala entre "${q.leftLabel}" e "${q.rightLabel}". Peça para o cliente se posicionar nessa escala e descreva a resposta em texto.`,
    );
  }
  if (!say && (q.type === "multi" || q.type === "links")) {
    parts.push("Pode haver mais de uma resposta — junte tudo num só texto, separado por vírgulas, antes de salvar.");
  }
  const qCond = describeCondition(q.showIf);
  if (qCond) parts.push(`Só faça esta pergunta se ${qCond}.`);
  if (q.required) {
    parts.push("Campo OBRIGATÓRIO — não avance para a próxima pergunta sem uma resposta válida para este.");
  } else if (q.allowUnknown) {
    parts.push(
      `Campo opcional — se o cliente não souber, salve "${q.unknownLabel ?? "não sei"}" e siga em frente.`,
    );
  } else {
    parts.push('Campo opcional — se o cliente quiser pular, salve o valor vazio ("") e siga em frente.');
  }
  return parts.join(" ");
}

/** Roteiro completo, em texto estruturado, para entrar no prompt de sistema. */
export function buildVoiceRoteiro(): string {
  const lines: string[] = [];
  for (const step of STEPS) {
    const questions = step.questions.filter((q) => !VOICE_EXCLUDED_TYPES.has(q.type));
    if (questions.length === 0) continue;
    const stepCond = describeCondition(step.showIf);
    lines.push(`\nEtapa "${step.title}"${stepCond ? ` — só entre nela se ${stepCond}` : ""}:`);
    lines.push(step.subtitle);
    for (const q of questions) {
      lines.push(describeQuestion(q));
    }
  }
  return lines.join("\n");
}

function formatSummaryValue(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "string") return v.trim() !== "" ? v.trim().slice(0, 200) : null;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    // Respostas de upload: lista os nomes dos arquivos.
    if (typeof v[0] === "object" && v[0] !== null && "name" in v[0]) {
      return (v as { name: string }[]).map((f) => f.name).join(", ").slice(0, 200);
    }
    return v.map(String).join(", ").slice(0, 200);
  }
  return null;
}

function answeredSummary(answers: Answers): string {
  const already: string[] = [];
  for (const { question } of voiceQuestions()) {
    const a = answers[question.id];
    if (!a || a.skipped) continue;
    const formatted = formatSummaryValue(a.value);
    if (formatted) already.push(`${question.id}="${formatted}"`);
  }
  if (already.length === 0) {
    return "Nenhum campo foi respondido ainda nesta ficha. Comece do início do roteiro.";
  }
  return [
    "Estes campos já foram respondidos antes (nesta ou em outra sessão, inclusive pelo formulário em texto ou pelos botões da tela).",
    "NÃO pergunte de novo por eles: confirme rapidamente que ainda está correto só se fizer sentido no fluxo da conversa, e siga direto para a próxima pergunta pendente do roteiro.",
    ...already,
  ].join("\n");
}

/** Prompt de sistema completo, já travado no token efêmero (o cliente não pode alterá-lo). */
export function buildSystemInstruction(answers: Answers): string {
  return `
Você conduz, por voz, o briefing de um novo projeto de site/sistema para um estúdio de desenvolvimento freelancer. A conversa é em português do Brasil, com um cliente que pode não entender termos técnicos.

REGRAS DE CONDUÇÃO
- Tom acolhedor, direto e profissional — frases curtas, como numa ligação real. Não leia listas de opções como se fosse um menu de telefone; converse.
- VOZ: fale como uma pessoa real em português do Brasil — ritmo de conversa natural, levemente ágil, entonação expressiva e pausas curtas. Nunca fale de forma monótona, lenta ou silabada.
- É UMA LIGAÇÃO DE VOZ: a resposta do cliente é sempre FALADA. NUNCA diga "selecione", "marque", "clique" ou "aperte" como forma de responder. A única exceção: para respostas que precisam ser exatas (links, endereços, e-mails), você pode dizer "pode ditar ou digitar aqui na tela", porque existe um campo de texto de apoio. Os atalhos visuais da tela são apoio silencioso — nunca os mencione nem explique.
- Faça UMA pergunta por vez, seguindo a ordem do roteiro abaixo (respeitando as condições "só faça/entre se...").
- Depois que o cliente responder, avalie se a resposta é específica o suficiente para ser salva. Se for vaga, incompleta ou genérica demais (ex.: "sei lá", "qualquer coisa", "o normal"), peça um detalhe a mais antes de seguir — não avance com uma resposta vazia de conteúdo.
- Assim que tiver uma resposta válida para um campo, chame a ferramenta "salvar_resposta_briefing" com o "campo" (id exato) e o "valor" (o texto da resposta), e só depois siga para a próxima pergunta. Se o cliente corrigir algo que já foi salvo, chame a ferramenta de novo com o mesmo campo e o valor atualizado.
- REGRA DE OURO: nunca avance para a próxima pergunta sem antes chamar "salvar_resposta_briefing" para a pergunta atual — nem quando o cliente pular, disser "não tenho", "não sei" ou "depois" (nesses casos, chame com valor vazio). Sem a chamada, a resposta se perde e a tela do cliente dessincroniza.
- Avisos entre colchetes como "[sistema: ...]" são notas sobre algo que o cliente fez NA TELA (digitou, escolheu, enviou arquivo). A resposta JÁ está salva — não chame a ferramenta de novo; apenas confirme em uma frase e siga para a próxima pergunta.
- Campos obrigatórios não podem ser pulados: se o cliente tentar pular, explique em uma frase por que precisa dessa informação e pergunte de novo. Campos opcionais podem ser pulados a pedido do cliente — nesse caso ainda chame a ferramenta, com valor vazio ou "não sei".
- Quando tiver percorrido todo o roteiro aplicável (todas as etapas cuja condição bate com o que já foi respondido) e o cliente confirmar que pode encerrar, agradeça, resuma em uma frase o que foi coletado e chame a ferramenta "finalizar_briefing". Nunca chame essa ferramenta antes disso.

${answeredSummary(answers)}

ROTEIRO (o "id" entre aspas é o valor exato a usar no parâmetro "campo" da ferramenta):
${buildVoiceRoteiro()}
`.trim();
}
