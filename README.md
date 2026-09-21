# Sistema de Briefing

Site onde clientes preenchem um **briefing guiado** (wizard com poucas perguntas por tela, áudio com transcrição e salvamento automático por link) e o desenvolvedor acompanha tudo num **painel admin** (lista, detalhe, exportar JSON, copiar resumo, impressão e avisos de novos briefings — sem integração externa).

Stack: Next.js (App Router) + TypeScript estrito, Tailwind CSS v4, Supabase (Postgres, Storage, Auth), zod, framer-motion, lucide-react. Transcrição via **Groq (Whisper)** por padrão, trocável para **OpenAI**.

## Rodar local

Pré-requisitos: Node 20+ e um projeto no Supabase.

```bash
npm install
cp .env.example .env.local   # e preencha as variáveis abaixo
npm run dev                  # http://localhost:3000
```

> Se o `npm install` falhar com `EALLOWSCRIPTS` (política de `allow-scripts` do seu `.npmrc`), instale com `npm install --ignore-scripts`.

| Script          | O que faz                      |
| --------------- | ------------------------------ |
| `npm run dev`   | Servidor de desenvolvimento    |
| `npm run build` | Build de produção (+ typecheck)|
| `npm start`     | Serve o build                   |
| `npm run lint`  | ESLint                          |

## Banco de dados (Supabase)

1. No Supabase Dashboard, abra **SQL Editor → New query**.
2. Cole o conteúdo de `supabase/schema.sql` e rode (**Run**). Pode rodar de novo após atualizações — é idempotente.
3. Isso cria as tabelas (`briefings`, `briefing_files`, `briefing_audios`), o trigger de `updated_at`, o RLS ligado **sem policies** (só o servidor acessa, via service role) e os buckets privados `briefing-audios` (25 MB) e `briefing-files` (20 MB).

## Criar o usuário admin

O painel (`/admin`) usa Supabase Auth + allowlist de e-mails:

1. **Authentication → Users → Add user → Create new user**: cadastre seu e-mail com senha (confirme o e-mail se necessário).
2. No `.env.local` (e depois na Vercel), defina `ADMIN_EMAILS` com esse e-mail (vários, separados por vírgula).
3. Acesse `/admin/login`. E-mails fora da lista são barrados mesmo logados.

## Variáveis de ambiente

| Variável                     | Onde        | Descrição                                                        |
| ---------------------------- | ----------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`    | tudo        | URL do projeto Supabase                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tudo      | anon key (Project Settings → API)                                |
| `SUPABASE_SERVICE_ROLE_KEY`   | só servidor | service_role key — **nunca** em código client                    |
| `NEXT_PUBLIC_SITE_URL`        | tudo        | URL pública (local: `http://localhost:3000`)                     |
| `ADMIN_EMAILS`                | servidor    | e-mails do painel, separados por vírgula                         |
| `TRANSCRIBE_PROVIDER`         | servidor    | `groq` (padrão) ou `openai`                                      |
| `GROQ_API_KEY`                | servidor    | chave da Groq (se `TRANSCRIBE_PROVIDER=groq`)                    |
| `OPENAI_API_KEY`              | servidor    | chave da OpenAI (se `TRANSCRIBE_PROVIDER=openai`)                |

`src/lib/env.ts` valida tudo com zod e falha cedo com mensagem em pt-BR.

## Deploy na Vercel

1. Suba o repo no GitHub e importe na Vercel (**Add New → Project**).
2. Em **Settings → Environment Variables**, cadastre as mesmas variáveis do `.env.local` (com `NEXT_PUBLIC_SITE_URL` apontando para o domínio final).
3. Deploy automático a cada push na branch principal. Limites a saber: uploads vão direto ao Storage (signed URLs, fora do limite de ~4,5 MB); transcrição roda em função com `maxDuration = 60`.

## Fonte Neuhaus

Enquanto o arquivo oficial não chega, os títulos usam **Anton** (Google Fonts, mesma proporção condensada). Para trocar:

1. Solte o arquivo em `src/fonts/NeuhausHeadline.woff2`.
2. Em `src/lib/fonts.ts`, troque o `displayFont` pelo bloco comentado no próprio arquivo (uma linha, via `next/font/local`).

## Trocar o provedor de transcrição

Basta definir no ambiente:

```bash
TRANSCRIBE_PROVIDER=openai
OPENAI_API_KEY=sua-chave
```

Modelos em `src/lib/transcribe.ts`: `whisper-large-v3` na Groq (alternativa barata: `whisper-large-v3-turbo`), `gpt-4o-transcribe` na OpenAI (alternativa: `whisper-1`).

## Como o projeto está organizado

- `src/app/` — landing `/`, wizard `/b/[token]`, `/obrigado`, painel `/admin`, rotas `/api/...`
- `src/lib/briefing/` — `steps.ts` (fonte da verdade do questionário — **adicionar pergunta é editar este arquivo, sem migração**), `conditions.ts`, `completeness.ts`, `summary.ts`, `format.ts`, `media.ts`
- `src/components/` — `ui/` (design system), `wizard/`, `audio/`, `admin/`, `landing/`
- `supabase/schema.sql` — tabelas, RLS e buckets

Fluxo: landing → `POST /api/briefing` cria o rascunho → wizard salva com `PATCH` (debounce) → revisão → `POST .../submit` conclui → admin é avisado no painel (selo **Novo**, contador, polling de 30 s com toast). Notificações externas (e-mail, WhatsApp etc.) entram pelo ponto de extensão `onBriefingCompleted` (`src/lib/briefing/completed.ts`), hoje no-op.
