import "server-only";

const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    key: () => process.env.GROQ_API_KEY,
    // Modelo vigente (verificado na doc da Groq). Alternativa mais barata: "whisper-large-v3-turbo".
    model: "whisper-large-v3",
  },
  openai: {
    url: "https://api.openai.com/v1/audio/transcriptions",
    key: () => process.env.OPENAI_API_KEY,
    model: "gpt-4o-transcribe", // alternativa: "whisper-1"
  },
} as const;

export async function transcribe(file: Blob, filename: string): Promise<string> {
  const name = (process.env.TRANSCRIBE_PROVIDER ?? "groq") as keyof typeof PROVIDERS;
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Provedor de transcrição desconhecido: "${name}" (use groq | openai)`);
  const apiKey = p.key();
  if (!apiKey) throw new Error(`Chave ausente para o provedor "${name}"`);

  const form = new FormData();
  form.append("file", file, filename); // filename com extensão correta
  form.append("model", p.model);
  form.append("language", "pt");
  form.append("response_format", "json");

  const res = await fetch(p.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Transcrição falhou (${name}): ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
