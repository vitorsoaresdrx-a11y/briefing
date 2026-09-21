import "server-only";

export type CompletedBriefing = {
  id: string;
  token: string;
  clientName: string | null;
  company: string | null;
};

/**
 * Ponto de extensão: chamado quando um briefing é concluído.
 * Hoje não faz nada. Se no futuro quiser e-mail ou outro canal,
 * basta implementar aqui (sem mexer na rota de submit).
 */
export async function onBriefingCompleted(briefing: CompletedBriefing): Promise<void> {
  void briefing;
  return;
}
