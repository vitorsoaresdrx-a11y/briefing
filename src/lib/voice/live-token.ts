import "server-only";
import { GoogleGenAI, Modality, Type, type FunctionDeclaration } from "@google/genai";
import type { Answers } from "@/lib/briefing/types";
import { buildSystemInstruction, voiceFieldIds } from "@/lib/briefing/voice-script";

/**
 * Modelo padrão da Live API. Se a conta não tiver acesso a este modelo,
 * defina GEMINI_LIVE_MODEL no ambiente com o id liberado para a sua chave
 * (veja https://ai.google.dev/gemini-api/docs/models).
 */
const DEFAULT_MODEL = "gemini-3.8-live";

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada no servidor. Preencha no .env.local (veja .env.example).",
    );
  }
  // Tokens efêmeros só existem na v1alpha da API.
  return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
}

/**
 * As duas únicas ferramentas que a IA pode chamar durante o briefing por voz.
 * O enum de "campo" trava os ids aceitos aos das perguntas do próprio
 * steps.ts — a mesma fonte usada pelo wizard em texto.
 */
function buildFunctionDeclarations(): FunctionDeclaration[] {
  return [
    {
      name: "salvar_resposta_briefing",
      description:
        "Salva a resposta do cliente para um campo do briefing assim que ela for coletada com clareza suficiente. Pode ser chamada de novo com o mesmo campo se o cliente corrigir uma resposta.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          campo: {
            type: Type.STRING,
            description: "Id exato do campo do briefing sendo respondido.",
            enum: voiceFieldIds(),
          },
          valor: {
            type: Type.STRING,
            description:
              "Texto da resposta do cliente, já limpo e em português. Vazio ou 'não sei' se o cliente pulou um campo opcional.",
          },
        },
        required: ["campo", "valor"],
      },
    },
    {
      name: "finalizar_briefing",
      description:
        "Marca o briefing como concluído. Só chame depois de percorrer todo o roteiro aplicável e o cliente confirmar que pode encerrar.",
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    },
  ];
}

function buildTools() {
  return [{ functionDeclarations: buildFunctionDeclarations() }];
}

export type VoiceTokenResult = {
  ephemeralToken: string;
  expireTime: string;
  model: string;
};

/**
 * Cria um token efêmero do Gemini Live API com a sessão inteira travada
 * server-side: modelo, prompt de sistema, ferramentas e modalidade de
 * resposta. Como passamos `liveConnectConstraints`, o navegador não consegue
 * sobrescrever nada disso ao conectar — só pode usar o token como está.
 * A GEMINI_API_KEY nunca é enviada ao navegador; só este token de curta duração.
 */
export async function createLiveEphemeralToken(answers: Answers): Promise<VoiceTokenResult> {
  const ai = client();
  const model = process.env.GEMINI_LIVE_MODEL?.trim() || DEFAULT_MODEL;
  // Voz vazia = voz padrão do Google (a que já funcionava antes).
  const voiceName = process.env.GEMINI_LIVE_VOICE?.trim() || "";

  const now = Date.now();
  // Duração total da sessão (pedida pelo produto: ~30 min é de sobra para um
  // briefing de 8-10 min, com folga para hesitações e reconexões).
  const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
  // Prazo para o navegador efetivamente abrir a conexão após receber o token
  // (o default da API é só 60s; damos mais folga para redes móveis lentas).
  const newSessionExpireTime = new Date(now + 3 * 60 * 1000).toISOString();

  const token = await ai.authTokens.create({
    config: {
      // "Resumir" uma sessão (mesma aba, queda breve de conexão) não consome
      // usos — mas deixamos folga porque esse comportamento ainda é preview.
      uses: 5,
      expireTime,
      newSessionExpireTime,
      liveConnectConstraints: {
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            languageCode: "pt-BR",
            // Timbre trocável sem mexer no código (ex.: Aoede, Puck, Kore).
            // Só entra se GEMINI_LIVE_VOICE estiver preenchida: nem toda voz
            // da lista de TTS é aceita pela Live API, e voz inválida aqui
            // derruba a sessão na hora (o servidor fecha a conexão).
            ...(voiceName ? { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } : {}),
          },
          // Diálogo afetivo (entonação adaptativa): também derruba a sessão
          // em modelos que não suportam — só liga com GEMINI_LIVE_AFFECTIVE=1.
          ...(process.env.GEMINI_LIVE_AFFECTIVE === "1"
            ? { enableAffectiveDialog: true }
            : {}),
          systemInstruction: buildSystemInstruction(answers),
          tools: buildTools(),
          // Transcrição de entrada/saída = nossa trilha de auditoria em texto.
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // Deixa a sessão sobreviver a quedas de conexão de ~10 min típicas.
          sessionResumption: {},
          contextWindowCompression: { slidingWindow: {} },
        },
      },
    },
  });

  if (!token.name) {
    throw new Error("O Gemini não retornou um token válido.");
  }

  return { ephemeralToken: token.name, expireTime, model };
}
