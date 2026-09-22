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
| `GEMINI_API_KEY`              | servidor    | chave do AI Studio — liga o briefing por voz (sem ela, só o texto funciona) |
| `GEMINI_LIVE_MODEL`           | servidor    | modelo da Live API (padrão: `gemini-3.8-live`)                   |
| `GEMINI_LIVE_VOICE`           | servidor    | timbre da voz (vazio = padrão do Google; ex.: `Aoede`, `Puck`, `Kore` — voz rejeitada derruba a sessão, então teste uma por vez) |
| `GEMINI_LIVE_AFFECTIVE`       | servidor    | `1` liga entonação adaptativa (pode ser rejeitada conforme o modelo) |

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

## Briefing por voz (Gemini Live API)

Canal alternativo ao wizard em texto, gravando no **mesmo** `briefings.answers` (sem mudar o schema — só adiciona a tabela de auditoria `briefing_voice_sessions`; rode o `schema.sql` de novo, é idempotente):

1. Cliente abre `/b/<token>/voz` e toca em **Iniciar briefing por voz** (o pedido de microfone acontece dentro do clique, como o navegador exige).
2. `POST /api/briefing/[token]/voice-token` cria um token efêmero do Google com roteiro (`src/lib/briefing/voice-script.ts`, gerado do `steps.ts`), ferramentas e voz travados no servidor. A `GEMINI_API_KEY` nunca chega ao navegador.
3. O navegador conecta **direto** ao Google (sem proxy) e conversa por áudio. Cada resposta vira uma function call `salvar_resposta_briefing` → `POST .../voice-answer`, que usa o mesmo merge/completude do `PATCH` do texto. Ao fim, `finalizar_briefing` → `POST .../submit` (o mesmo do texto, com a mesma validação de obrigatórias).
4. A transcrição vai em snapshots para `POST .../voice-transcript` e fica visível no detalhe do admin, junto dos campos gravados por voz.
5. Na tela de voz, a pergunta atual também pode ser respondida por widgets (texto, opções, escala, envio de arquivos) gerados do mesmo `steps.ts` (`src/lib/voice/widgets.ts`). Tudo que entra por widget é salvo pela `voice-answer` e avisado à IA por mensagem de sistema, que confirma e segue. As frases faladas ficam em `src/lib/briefing/voice-say.ts` (sem "selecione/mar que/clique"). A tela mostra só o espectro de áudio + checklist "Registrado" (sem transcrição visível; ela vai só para a auditoria).

Como cada campo é salvo na hora, queda de conexão não perde nada: é só começar de novo que a assistente continua de onde parou (o roteiro injetado no token já lista o que foi respondido).
