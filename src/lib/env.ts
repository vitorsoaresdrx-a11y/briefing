import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL válida (ex.: https://xyz.supabase.co)."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY está vazia. Copie a anon key em Supabase → Project Settings → API."),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY está vazia. Copie a service_role key em Supabase → Project Settings → API. SOMENTE servidor."),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_EMAILS: z
    .string()
    .min(1, "ADMIN_EMAILS está vazio. Preencha com os e-mails admin separados por vírgula.")
    .transform((v) =>
      v
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.string().array().min(1, "ADMIN_EMAILS precisa de ao menos um e-mail válido.")),
  TRANSCRIBE_PROVIDER: z.enum(["groq", "openai"]).default("groq"),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    TRANSCRIBE_PROVIDER: process.env.TRANSCRIBE_PROVIDER,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => ` - ${i.path.join(".") || "(raiz)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Variáveis de ambiente inválidas ou ausentes. Confira .env.local a partir de .env.example:\n${details}`,
    );
  }

  const provider = parsed.data.TRANSCRIBE_PROVIDER;
  if (provider === "groq" && !parsed.data.GROQ_API_KEY) {
    throw new Error(
      'TRANSCRIBE_PROVIDER="groq" mas GROQ_API_KEY está vazia. Preencha no .env.local.',
    );
  }
  if (provider === "openai" && !parsed.data.OPENAI_API_KEY) {
    throw new Error(
      'TRANSCRIBE_PROVIDER="openai" mas OPENAI_API_KEY está vazia. Preencha no .env.local.',
    );
  }

  return parsed.data;
}

export type Env = ReturnType<typeof loadEnv>;

/** Valida as variáveis e falha cedo com mensagem clara. Chame no servidor. */
export function getEnv(): Env {
  return loadEnv();
}

/** E-mails admin normalizados (minúsculos, sem espaços). */
export function getAdminEmails(): string[] {
  return getEnv().ADMIN_EMAILS;
}

/** true se o e-mail está na allowlist de admins. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}
