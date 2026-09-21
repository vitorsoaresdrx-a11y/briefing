# SISTEMA DE BRIEFING — Especificação de construção

> **Instruções para o agente de IDE:** leia este documento inteiro antes de escrever qualquer código. Construa do zero, seguindo as **Fases** da seção 15, na ordem. Faça um commit ao final de cada fase. Não peça confirmação a cada passo; só pare se algo realmente bloquear (ex.: variável de ambiente ausente). Toda a interface do cliente e do painel é em **português do Brasil**. Código, nomes de variáveis e comentários técnicos em inglês.

---

## 1. Visão geral

Um site onde clientes de um desenvolvedor freelancer (que faz SaaS, landing pages e sites institucionais) preenchem um **briefing universal**, para qualquer nicho.

Requisitos centrais:

- Funciona para qualquer nicho e tipo de projeto, com **lógica condicional** (só aparece o que faz sentido para cada cliente).
- Parece leve para o cliente: **wizard com poucas perguntas por tela**, cliques antes de texto, barra de progresso e tempo estimado.
- Traz o máximo de informação para o desenvolvedor: saída **estruturada em JSON**, resumo copiável e pontuação de completude.
- O cliente pode **gravar áudio** nas perguntas abertas; o áudio chega **transcrito** ao desenvolvedor.
- **Salvamento automático** e link para retomar depois. O cliente não faz login.
- Painel administrativo protegido para o desenvolvedor ver, ouvir, exportar e copiar os briefings.
- Avisos **dentro do próprio painel** quando um cliente concluir (selo "Novo", contador, atualização automática). **Sem integração com Telegram, WhatsApp ou qualquer serviço externo de mensagens.**

---

## 2. Stack

- **Next.js** (App Router, versão estável mais recente) + **TypeScript** estrito
- **Tailwind CSS v4** (tokens via `@theme` no CSS)
- **Supabase**: Postgres, Storage e Auth (só para o admin)
- **Vercel** para hospedagem, com deploy automático via GitHub
- **zod** para validação, **framer-motion** para transições, **lucide-react** para ícones
- **@supabase/supabase-js** e **@supabase/ssr**
- Transcrição: **Groq (Whisper)** por padrão, trocável para **OpenAI** por variável de ambiente

---

## 3. Variáveis de ambiente

Criar `.env.example` (sem valores) e `.env.local` (o usuário preenche):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # SOMENTE servidor. Nunca importar em código client.

NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAILS=email1@exemplo.com   # lista separada por vírgula; só esses acessam /admin

TRANSCRIBE_PROVIDER=groq          # groq | openai
GROQ_API_KEY=
OPENAI_API_KEY=
```

Criar `src/lib/env.ts` que valida as variáveis com zod e falha cedo com mensagem clara.

---

## 4. Design system

### Direção visual

Escuro, cinematográfico, editorial. Headlines condensadas e enormes em caixa alta, pequenos rótulos técnicos em mono com espaçamento largo, detalhes em vinho e um pequeno **losango/estrela de 4 pontas** (✦) como ornamento. Fundo preto com uma leve textura de grão. Muito espaço negativo. Nada de cara de "template".

### Paleta (definida pelo cliente)

| Token | Valor | Uso |
|---|---|---|
| `black` | `#000000` | Fundo base |
| `ink` | `#0A0A0A` | Superfícies, cards |
| `ink-2` | `#141414` | Superfícies elevadas, inputs |
| `burgundy` | `#6D001A` | **Cor da marca.** Botão primário, fills, seleção, barra de progresso |
| `burgundy-hover` | `#8C0A28` | Hover do botão primário |
| `burgundy-glow` | `#E23A5B` | **Texto e ícones de destaque, focus ring** sobre fundo escuro |
| `white` | `#FFFFFF` | Texto principal, botão secundário |
| `muted` | `#A1A1A1` | Texto secundário |
| `line` | `rgba(255,255,255,0.10)` | Bordas |

**Regra de acessibilidade (importante):** `#6D001A` sobre preto tem contraste muito baixo (~1.5:1). **Nunca use o vinho como cor de texto** sobre fundo escuro; use-o apenas como preenchimento (com texto branco por cima, contraste alto). Para texto/ícone/foco em destaque use `burgundy-glow`.

### Tipografia

- **Display (headlines, títulos de etapa, números grandes):** `Neuhaus Headline` — fonte condensada de impacto, uso em **caixa alta**, `line-height: 1.05`, `letter-spacing: -0.01em`. **Não usar `line-height` abaixo de 1.0**: em pt-BR o til (Ã, Õ), o circunflexo (Ê, Ô) e a cedilha (Ç) colidem com as linhas vizinhas. Usar a classe `.headline` (ver `globals.css`) em todo título em Neuhaus. Se houver animação de máscara com `overflow: hidden`, aplicar `padding-block: 0.12em; margin-block: -0.12em` para não cortar acentos. Testar sempre com: `FRICÇÃO`, `AÇÕES`, `ÂNGULO`, `SÊNIOR`, `ÓRGÃO`. Confirmar que o arquivo da fonte tem glifos acentuados (Latin Extended); se não tiver, avisar o usuário em vez de deixar o navegador misturar fontes.
  - O arquivo da fonte será fornecido pelo usuário. Esperar em `src/fonts/NeuhausHeadline.woff2` (ou .otf/.ttf; converter para woff2 se necessário).
  - Carregar com `next/font/local`, expondo `--font-display`.
  - **Fallback enquanto o arquivo não existir:** usar `Anton` via `next/font/google` (mesma proporção condensada). Implementar de forma que basta soltar o arquivo em `src/fonts/` e trocar uma linha em `src/lib/fonts.ts`.
- **Texto, subtítulos, formulários:** `Instrument Sans` (pesos 400, 500, 600) via `next/font/google`, expondo `--font-sans`. Neutra e limpa, deixa a headline condensada ser a estrela.
- **Rótulos técnicos** (contador de etapa "03 / 12", tempo estimado, tags): `JetBrains Mono` 11–12px, caixa alta, `letter-spacing: 0.14em`, via `next/font/google`, expondo `--font-mono`.

### Tokens (src/app/globals.css)

```css
@import "tailwindcss";

@theme {
  --color-black: #000000;
  --color-ink: #0a0a0a;
  --color-ink-2: #141414;
  --color-burgundy: #6d001a;
  --color-burgundy-hover: #8c0a28;
  --color-burgundy-glow: #e23a5b;
  --color-muted: #a1a1a1;
  --color-line: rgb(255 255 255 / 0.1);

  --font-display: var(--font-display), "Anton", "Impact", sans-serif;
  --font-sans: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono), ui-monospace, monospace;

  --radius-card: 14px;
  --radius-ctl: 10px;
}

html { background: var(--color-black); color: #fff; color-scheme: dark; }
body { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }

/* grão sutil por cima de tudo, sem interferir em cliques */
body::after {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 50;
  opacity: .06; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

:focus-visible { outline: 2px solid var(--color-burgundy-glow); outline-offset: 3px; }

/* Todo título em Neuhaus usa esta classe. line-height >= 1.0 evita colisão de acentos (Ã, Õ, Ê, Ç). */
.headline {
  font-family: var(--font-display);
  text-transform: uppercase;
  line-height: 1.05;
  letter-spacing: -0.01em;
  padding-block: 0.04em;
}
::selection { background: var(--color-burgundy); color: #fff; }

@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

### Componentes-base (criar em `src/components/ui/`)

- `Button` — variantes `primary` (fundo `burgundy`, hover `burgundy-hover`, texto branco), `secondary` (borda `line`, hover branco/10), `ghost`. Altura mínima 48px (mobile-friendly).
- `OptionCard` — card clicável para escolha única/múltipla: borda `line`, selecionado com borda `burgundy-glow` + fundo `burgundy/20` + check. Suporta ícone, título e descrição.
- `Input`, `Textarea`, `Slider` (com rótulos nas duas pontas), `Chips`, `LinkListInput` (até N URLs), `ColorPicker` (paleta + hex + "não tenho, me sugira").
- `ProgressBar` — fina, preenchida com `burgundy`, com contador mono "03 / 12" e "≈ 6 min restantes".
- `Ornament` — o ✦ pequeno em `burgundy-glow`, usado como detalhe nos cantos e separadores.
- Botões "Não sei" e "Pular por enquanto" sempre visíveis em toda pergunta (estilo ghost).
- Layout mobile-first; a maioria dos clientes vai responder pelo celular.

### Logo

O usuário colocará o arquivo do logo **na raiz do projeto** (`logo.svg` ou `logo.png`). O agente deve:
1. Localizar o arquivo na raiz e movê-lo para `public/` (mantendo o nome).
2. Usá-lo no cabeçalho (altura ~28–32px) e como `src/app/icon.png` (favicon), se for PNG.
3. Se não encontrar, usar um wordmark de texto provisório em `--font-display` e deixar um `TODO` visível.

---

## 5. Estrutura de pastas

```
src/
  app/
    page.tsx                         # landing + botão "Começar briefing"
    b/[token]/page.tsx               # wizard do cliente (retomável)
    b/[token]/obrigado/page.tsx
    admin/
      login/page.tsx
      page.tsx                       # lista de briefings
      briefings/[id]/page.tsx        # detalhe
      briefings/[id]/print/page.tsx  # versão para imprimir/PDF
    api/
      briefing/route.ts                          # POST cria rascunho
      briefing/[token]/route.ts                  # GET carrega, PATCH salva
      briefing/[token]/submit/route.ts           # POST conclui
      briefing/[token]/upload-url/route.ts       # POST devolve signed upload URL
      briefing/[token]/audio/route.ts            # POST registra áudio + dispara transcrição
      briefing/[token]/file/route.ts             # POST registra arquivo enviado
  components/
    ui/  wizard/  audio/  admin/
  lib/
    briefing/
      steps.ts          # configuração das etapas e perguntas (fonte da verdade)
      types.ts
      conditions.ts     # avaliação de showIf
      completeness.ts
      summary.ts        # gera resumo em markdown
    supabase/ (server.ts, admin.ts, browser.ts)
    transcribe.ts
    rate-limit.ts
    env.ts
    fonts.ts
  middleware.ts         # protege /admin
public/
  logo.*
supabase/
  schema.sql
```

---

## 6. Banco de dados (Supabase)

Salvar em `supabase/schema.sql` e instruir o usuário a rodar no SQL Editor.

```sql
create extension if not exists pgcrypto;

create type briefing_status as enum ('rascunho', 'em_andamento', 'concluido');
create type transcript_status as enum ('pendente', 'processando', 'concluido', 'erro');

create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  client_name text,
  client_email text,
  client_whatsapp text,
  company text,
  project_type text,
  niche text,
  status briefing_status not null default 'rascunho',
  current_step text,
  answers jsonb not null default '{}'::jsonb,
  completeness int not null default 0 check (completeness between 0 and 100),
  pending_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  viewed_at timestamptz             -- null = admin ainda não abriu (usado no selo "Novo")
);

create table public.briefing_files (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  kind text not null default 'outro',          -- logo | foto | documento | outro
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.briefing_audios (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.briefings(id) on delete cascade,
  question_id text not null,
  storage_path text not null,
  mime_type text,
  duration_seconds int,
  transcript text,
  transcript_status transcript_status not null default 'pendente',
  transcript_error text,
  created_at timestamptz not null default now()
);

create index on public.briefings (status, created_at desc);
create index on public.briefing_files (briefing_id);
create index on public.briefing_audios (briefing_id, question_id);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger briefings_updated_at before update on public.briefings
for each row execute function public.set_updated_at();

-- RLS: ligado e SEM policies = anon/authenticated não acessam nada.
-- Todo acesso passa por rotas do servidor com a service role (que ignora RLS).
alter table public.briefings enable row level security;
alter table public.briefing_files enable row level security;
alter table public.briefing_audios enable row level security;

-- Buckets privados
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('briefing-audios', 'briefing-audios', false, 26214400),  -- 25 MB
  ('briefing-files',  'briefing-files',  false, 20971520)   -- 20 MB
on conflict (id) do nothing;
```

**Modelo de segurança:**
- O cliente não tem login; o acesso é pelo `token` (48 caracteres hex, aleatório). Nunca exponha `id` interno na URL do cliente.
- Nenhum acesso direto do navegador às tabelas. Tudo passa por rotas `/api/briefing/[token]/...`, que validam o token e usam a service role.
- `SUPABASE_SERVICE_ROLE_KEY` só é importada em `src/lib/supabase/admin.ts`, marcado com `import "server-only"`.
- Uploads: o servidor gera **signed upload URLs** (`createSignedUploadUrl`) para caminho `${briefing_id}/${question_id}/${uuid}.${ext}`; o navegador envia direto ao Storage (`uploadToSignedUrl`), contornando o limite de ~4,5 MB da Vercel. Buckets continuam privados; o admin vê arquivos via signed URLs de leitura curtas.
- Validar tipo (allowlist de MIME) e tamanho antes de emitir a URL.
- Rate limit simples por IP nas rotas de criação e upload (em memória/`Map` para começar; deixar interface pronta para trocar por Upstash).
- Campo honeypot oculto no formulário inicial contra bots.
- `robots: noindex, nofollow` em `/b/*` e `/admin/*`.

---

## 7. Modelo de perguntas (orientado a configuração)

Toda pergunta vive em `src/lib/briefing/steps.ts`. O wizard, a lógica condicional, a completude e o resumo leem daqui. **Adicionar pergunta = editar esse arquivo, sem migração de banco** (as respostas ficam em `answers` JSONB, chaveadas por `question.id`).

```ts
// src/lib/briefing/types.ts
export type Option = { value: string; label: string; description?: string; icon?: string };

export type Condition =
  | { field: string; equals: string | boolean }
  | { field: string; includes: string }      // para respostas multi
  | { field: string; in: string[] }
  | { all: Condition[] }
  | { any: Condition[] };

export type QuestionType =
  | "text" | "textarea" | "email" | "phone" | "url"
  | "single" | "multi" | "cards"
  | "slider" | "links" | "colors" | "file";

export type Question = {
  id: string;
  type: QuestionType;
  label: string;
  help: string;               // OBRIGATÓRIO: explicação curta (1–2 frases) exibida abaixo da pergunta
  example?: string;           // opcional: exemplo concreto, exibido como "Ex.: ..." em itálico
  placeholder?: string;
  options?: Option[];
  required?: boolean;         // bloqueia "Continuar"
  weight?: 1 | 2 | 3;         // peso na completude (padrão 1; obrigatórias = 3)
  allowAudio?: boolean;       // mostra gravador (textarea)
  allowUnknown?: boolean;     // botão "Não sei"
  unknownLabel?: string;      // ex.: "Não tenho, me sugira"
  maxItems?: number;          // links / files
  leftLabel?: string; rightLabel?: string; // slider
  fileKind?: "logo" | "foto" | "documento" | "outro";
  showIf?: Condition;
};

export type Step = {
  id: string;
  title: string;            // exibido em Neuhaus, caixa alta
  subtitle: string;         // OBRIGATÓRIO: por que estamos perguntando isso (ver 7.1)
  estimatedMinutes: number;
  questions: Question[];    // 1–3 por tela
  showIf?: Condition;
};

// Formato de uma resposta salva em answers[question.id]:
// { value: any, skipped?: boolean, unknown?: boolean, audioId?: string }
```

### Conteúdo das etapas (implementar em pt-BR, com textos amigáveis e curtos)

**Núcleo fixo — todos respondem:**

| # | Etapa (`id`) | Perguntas (`id` · tipo) |
|---|---|---|
| 1 | `contato` — "Vamos nos conhecer" | `name` · text (obrig.) · `company` · text (obrig.) · `whatsapp` · phone (obrig.) · `email` · email (obrig.) · `current_site` · url · `socials` · links (máx. 5) |
| 2 | `tipo` — "O que vamos construir?" | `project_type` · cards (obrig.): `landing` Landing page · `institucional` Site institucional · `saas` SaaS / sistema web · `ecommerce` E-commerce · `redesign` Redesign de site existente · `outro` Outro |
| 3 | `negocio` — "Sobre o seu negócio" | `niche` · single: saúde, jurídico, financeiro, educação, tecnologia, alimentação, varejo, serviços locais, imobiliário, outro · `business_description` · textarea + áudio · `differentiator` · textarea + áudio · `problem_solved` · textarea + áudio |
| 4 | `objetivo` — "Qual o objetivo principal?" | `main_goal` · cards, **escolha única** (obrig.): vender, captar leads, agendar atendimentos, apresentar a empresa, validar uma ideia, outro |
| 5 | `publico` — "Para quem é?" | `audience_type` · single (B2B / B2C / ambos) · `audience_profile` · textarea + áudio · `age_range` · multi · `region` · single (local, estadual, nacional, internacional) |
| 6 | `visual` — "Identidade visual" | `has_logo` · single (tenho / não tenho / preciso criar) · `brand_colors` · colors (com "Não tenho, me sugira") · `brand_fonts` · text (allowUnknown) · `refs_liked` · links (máx. 3) + `refs_liked_why` · textarea + áudio · `ref_disliked` · links (máx. 1) + `ref_disliked_why` · textarea + áudio |
| 7 | `tom` — "Como a marca fala?" | `tone_formality` · slider (Formal ↔ Descontraído) · `tone_seriousness` · slider (Sério ↔ Divertido) · `tone_price` · slider (Luxo ↔ Acessível) |
| 8 | `conteudo` — "Conteúdo do site" | `sections` · multi: sobre, serviços, preços, depoimentos, portfólio, FAQ, blog, contato, equipe · `has_copy` · single (tenho os textos / tenho parte / preciso de copywriting) · `has_photos` · single (tenho / preciso de banco de imagens / vou fotografar) |
| 9 | `funcionalidades` — "Funcionalidades" | `features` · multi: botão WhatsApp, formulário de contato, agendamento, pagamento online, CRM, analytics, chat, blog, multi-idioma, área de membros · `integrations` · textarea + áudio |
| 10 | `infra` — "Domínio e hospedagem" | `has_domain` · single (sim / não / não sei) · `domain_registrar` · text (showIf `has_domain = sim`) · `has_hosting` · single · `who_maintains` · single (eu mesmo / preciso de manutenção mensal / não sei) |
| 11 | `prazo` — "Prazo e investimento" | `deadline` · single (urgente < 2 semanas · até 1 mês · 2–3 meses · flexível) · `deadline_date` · text (opcional) · `budget` · cards com faixas (allowUnknown "Prefiro conversar") |
| 12 | `concorrentes` — "Referências de mercado" | `competitors` · links (máx. 5) · `final_notes` · textarea + áudio |
| 13 | `uploads` — "Arquivos (opcional)" | `files_logo` · file (kind logo) · `files_photos` · file (kind foto, múltiplos) · `files_docs` · file (kind documento, múltiplos) |

**Blocos condicionais — só aparecem quando relevantes:**

| Bloco | Condição (`showIf`) | Perguntas |
|---|---|---|
| SaaS | `project_type = saas` | `saas_core_features` (textarea + áudio) · `saas_user_types` (textarea) · `saas_plans` (single: grátis / freemium / assinatura / uso / não definido) · `saas_social_login` (single) · `saas_integrations` (textarea) · `saas_stack_pref` (text, allowUnknown) |
| E-commerce | `project_type = ecommerce` | `ecom_product_count` (single em faixas) · `ecom_gateway` (multi) · `ecom_shipping` (single) · `ecom_stock` (single) |
| Serviço local | `region = local` **ou** `niche = servicos_locais` | `local_address` (text) · `local_hours` (text) · `local_area` (text) · `local_gmb` (single) |
| Redesign | `project_type = redesign` | `redesign_problems` (textarea + áudio) · `redesign_analytics` (single: sim / não / não sei) |
| Nicho regulado | `niche in [saude, juridico, financeiro]` | Aviso curto sobre exigências legais (CFM/OAB/CVM, LGPD) + `legal_notes` (textarea, allowUnknown) |

Regras gerais de UX das perguntas:
- Preferir `cards`, `single`, `multi`, `slider` a texto livre. Texto livre só onde indispensável.
- **Toda** pergunta tem "Pular por enquanto"; perguntas não obrigatórias e de conhecimento ("tem domínio?") têm "Não sei". Respostas puladas/desconhecidas entram em `pending_fields`.
- Só os campos de contato e `project_type` e `main_goal` são obrigatórios (peso 3).
- **Toda pergunta tem texto de ajuda (`help`) escrito para a pessoa mais leiga possível.** Ver seção 7.1. O agente não pode inventar textos mais técnicos nem omitir o `help`; o TypeScript deve falhar o build se uma pergunta não tiver `help`.

### 7.1 Textos de ajuda (usar exatamente estes, em pt-BR)

**Regras de escrita:** linguagem de conversa, sem jargão; se um termo técnico for inevitável (domínio, hospedagem, CRM, B2B), explicar com uma comparação simples na própria ajuda. Dizer **o que fazer** ("Cole o link...") e **para que serve** ("...isso nos ajuda a..."). Máximo de 2 frases; exemplos vão em `example`. Nas opções de cards e múltipla escolha, usar `description` para explicar cada opção em uma frase curta.

**Regras de exibição:** `help` aparece logo abaixo do título da pergunta, em `muted`, 14–15px, `line-height` 1.5. `example` aparece abaixo, em itálico, prefixado por "Ex.:". Perguntas de links usam placeholder `www.exemplo.com.br` e deixam claro que é para **colar o endereço** do site. O `subtitle` de cada etapa explica por que estamos perguntando aquilo.

#### Subtítulos das etapas

| Etapa | `subtitle` |
|---|---|
| `contato` | Só o básico para começarmos. Leva menos de 1 minuto. |
| `tipo` | Escolha o que mais se parece com o que você imagina. Se ficar na dúvida, a gente ajuda depois. |
| `negocio` | Quanto melhor entendermos o seu negócio, melhor o site vai conversar com os seus clientes. Pode escrever ou falar. |
| `objetivo` | Todo site precisa de um foco principal. Isso guia o design inteiro. |
| `publico` | Um site bom é feito para uma pessoa específica, não para todo mundo. |
| `visual` | Aqui entendemos o visual da sua marca. Se ainda não tem nada definido, sem problema: a gente cuida disso. |
| `tom` | Imagine que a sua marca é uma pessoa falando com o cliente. Como ela fala? |
| `conteudo` | O que vai aparecer no site e quem vai preparar esse material. |
| `funcionalidades` | O que o site precisa fazer, além de mostrar informações. Não precisa entender de tecnologia: marque o que fizer sentido. |
| `infra` | Onde o site vai morar na internet. Se você não sabe nada disso, tudo bem: é só marcar "Não sei". |
| `prazo` | Ajuda a planejarmos o projeto de forma realista. Sem compromisso. |
| `concorrentes` | Conhecer o mercado nos ajuda a fazer o seu site se destacar. |
| `uploads` | Opcional. Se não tiver nada agora, você pode enviar depois pelo mesmo link. |

#### Núcleo

| `id` | Pergunta (`label`) | Ajuda (`help`) · Exemplo (`example`) |
|---|---|---|
| `name` | Qual é o seu nome? | Para sabermos como te chamar durante o projeto. |
| `company` | Qual o nome da sua empresa ou marca? | Se ainda não tem um nome definido, escreva o que pretende usar ou o seu próprio nome. |
| `whatsapp` | Qual o seu WhatsApp? | É por onde vamos falar com você sobre o projeto. Coloque com DDD. |
| `email` | Qual o seu e-mail? | Vamos usar para enviar propostas e arquivos. Prefira um que você olha com frequência. |
| `current_site` | Você já tem um site? Qual o endereço? | Se já tem, cole o link para vermos como está hoje. Se não tem, é só pular. · Ex.: www.suaempresa.com.br |
| `socials` | Quais são as suas redes sociais? | Cole os links do seu Instagram, LinkedIn, etc. Isso nos ajuda a entender o estilo da sua marca e a colocar esses links no site. |
| `project_type` | Que tipo de projeto você precisa? | Escolha o que mais se parece com o que você tem em mente. Se estiver em dúvida, escolha "Outro" e explique nas próximas telas. |
| `niche` | Em qual segmento você atua? | Escolha a área do seu negócio. Isso muda algumas perguntas que faremos em seguida. |
| `business_description` | O que a sua empresa faz? | Explique como se estivesse contando para um amigo: o que você vende ou oferece. Pode escrever ou gravar um áudio. · Ex.: Somos uma clínica de fisioterapia que atende idosos em casa. |
| `differentiator` | O que te diferencia dos concorrentes? | O que faz alguém escolher você e não outra empresa? Pode ser preço, atendimento, qualidade, rapidez, experiência... · Ex.: Entregamos em até 2 horas e temos atendimento humano 24h. |
| `problem_solved` | Que problema você resolve para o seu cliente? | Qual dificuldade a pessoa tem antes de te procurar, e como você ajuda a resolver? · Ex.: Pessoas sem tempo para cozinhar, que recebem refeições saudáveis prontas. |
| `main_goal` | Qual o principal objetivo do projeto? | Escolha só uma. É a coisa mais importante que você quer que o site faça. Isso deixa o design muito mais eficiente. |
| `audience_type` | Você vende para empresas, para pessoas ou para os dois? | "Empresas" quer dizer que seu cliente é outro negócio (o famoso B2B). "Pessoas" é o consumidor final (B2C). |
| `audience_profile` | Como é o seu cliente ideal? | Descreva quem mais compra de você: profissão, idade, o que gosta, onde mora. Quanto mais detalhes, melhor. · Ex.: Mulheres de 30 a 45 anos, mães, que trabalham fora e valorizam praticidade. |
| `age_range` | Qual a faixa de idade dele? | Você pode marcar mais de uma. |
| `region` | Onde estão os seus clientes? | Só na sua cidade, no estado, no país inteiro ou no mundo todo? Isso muda como o site é pensado. |
| `has_logo` | Você já tem um logo? | O logo é o símbolo ou o nome estilizado da sua marca. Se você tem, poderá enviar mais adiante. |
| `brand_colors` | Quais são as cores da sua marca? | Se o seu logo já tem cores, escolha-as aqui. Se não tem nada definido, marque "Não tenho, me sugira" que a gente escolhe combinações para você. |
| `brand_fonts` | Quais fontes (tipos de letra) a sua marca usa? | Se você não sabe o que é isso, sem problema: marque "Não sei" e escolhemos letras que combinem com a sua marca. |
| `refs_liked` | Cole até 3 sites que você acha bonitos | Podem ser de qualquer área, até de concorrentes. Servem de inspiração para entendermos o seu gosto. Não vamos copiar nenhum deles. · Ex.: www.exemplo.com.br |
| `refs_liked_why` | O que você gosta nesses sites? | Pode ser as cores, o jeito de organizar, as fotos, o clima... Qualquer coisa que tenha chamado a sua atenção. |
| `ref_disliked` | Tem algum site de que você NÃO gosta? Cole o link | Saber o que evitar ajuda tanto quanto saber o que você curte. Escolha um site que você acha feio, confuso ou que não tem nada a ver com você. Se não lembrar de nenhum, é só pular. |
| `ref_disliked_why` | O que te incomoda nesse site? | Ex.: muita informação junta, cores fortes demais, difícil de achar as coisas, parece antigo. |
| `tone_formality` | A sua marca é mais formal ou mais descontraída? | Formal soa assim: "Prezado cliente, temos o prazer de apresentar...". Descontraído soa assim: "Oi! Bora conhecer a gente?". |
| `tone_seriousness` | Mais séria ou mais divertida? | Séria passa credibilidade e calma. Divertida usa leveza e humor. |
| `tone_price` | Mais luxo ou mais acessível? | Luxo passa exclusividade e sofisticação. Acessível passa proximidade e preço justo. |
| `sections` | Quais seções você imagina no site? | Seções são os "blocos" que o visitante vai ver ao rolar a página. Marque as que fizerem sentido. Se tiver dúvida, sugerimos depois. |
| `has_copy` | Você já tem os textos do site? | "Copywriting" é escrever os textos de forma que convençam quem está visitando. Se você não tem nada pronto, podemos escrever junto com você. |
| `has_photos` | E as fotos e imagens? | Fotos reais da sua empresa, produtos e equipe deixam o site mais confiável. "Banco de imagens" são fotos profissionais prontas para usar. |
| `features` | O que o site precisa ter? | Marque as funções que você quer. Se não entender alguma, deixe em branco que explicamos depois. |
| `integrations` | Precisa se conectar com alguma ferramenta que você já usa? | Por exemplo: sistema de e-mail marketing, agenda, meio de pagamento, planilhas. Se não usa nenhuma, pode pular. · Ex.: Mailchimp, Google Agenda, Mercado Pago. |
| `has_domain` | Você já tem um domínio? | Domínio é o endereço do seu site na internet, como "suaempresa.com.br". Se você já comprou um, marque "Sim". |
| `domain_registrar` | Onde você registrou esse domínio? | É o site em que você comprou o endereço. Se não lembra, procure no e-mail da compra ou marque "Não sei". · Ex.: Registro.br, GoDaddy, Hostinger. |
| `has_hosting` | Você já tem hospedagem? | Hospedagem é o "terreno" onde o site fica guardado para ficar disponível na internet. Se você não sabe, marque "Não sei" e nós cuidamos disso. |
| `who_maintains` | Quem vai cuidar do site depois de pronto? | Depois de publicado, o site precisa de pequenas atualizações e cuidados. Você pode fazer por conta própria ou contratar uma manutenção mensal. |
| `deadline` | Para quando você precisa do projeto? | Seja sincero: prazos muito curtos exigem mais dedicação e podem custar mais. Se não tem pressa, escolha "Flexível". |
| `deadline_date` | Existe alguma data específica? | Por exemplo, um lançamento, evento ou campanha. Se não tem uma data, é só pular. |
| `budget` | Quanto você pretende investir? | Só uma faixa aproximada, sem nenhum compromisso. Ajuda a indicarmos a solução certa para o seu bolso. Se preferir não dizer agora, escolha "Prefiro conversar". |
| `competitors` | Quem são os seus principais concorrentes? | São empresas que oferecem algo parecido com o que você faz. Cole os links dos sites delas. Não é para copiar: é para fazer você se destacar. |
| `final_notes` | Tem mais alguma coisa que devemos saber? | Espaço livre para ideias, dúvidas, preferências ou restrições. Qualquer coisa que não coube nas perguntas anteriores. |
| `files_logo` | Envie o seu logo | Se puder, envie em PNG ou SVG com fundo transparente. Se só tiver uma foto ou print, serve também. |
| `files_photos` | Envie fotos | Da sua empresa, produtos, equipe ou local. Não precisa escolher as melhores: mande as que tiver. |
| `files_docs` | Envie documentos | Manual da marca, apresentações, textos, tabelas de preços... Tudo o que ajude a entendermos o seu negócio. |

**Descrições das opções (`description`) — cards e múltipla escolha:**

- `project_type`: Landing page = "Uma página única, focada em uma ação, como vender ou captar contatos." · Site institucional = "Um site com várias páginas apresentando a sua empresa." · SaaS / sistema web = "Um sistema online com login, onde as pessoas usam uma ferramenta sua pelo navegador." · E-commerce = "Uma loja virtual para vender produtos pela internet." · Redesign = "Você já tem um site e quer refazê-lo." · Outro = "Algo diferente. Você explica nas próximas telas."
- `main_goal`: Vender = "As pessoas comprando direto pelo site." · Captar leads = "As pessoas deixando nome e contato para você falar depois." · Agendar atendimentos = "As pessoas marcando horário ou consulta." · Apresentar a empresa = "Mostrar quem você é e passar confiança." · Validar uma ideia = "Testar se a sua ideia interessa ao mercado antes de investir mais." · Outro = "Você explica melhor mais adiante."
- `sections`: Sobre = "Sua história e quem você é." · Serviços = "O que você oferece." · Preços = "Valores ou planos." · Depoimentos = "O que os clientes falam de você." · Portfólio = "Trabalhos que você já fez." · FAQ = "Perguntas frequentes, já respondidas." · Blog = "Artigos e novidades." · Contato = "Formulário, telefone e mapa." · Equipe = "Apresentação das pessoas do seu time."
- `features`: Botão de WhatsApp = "Um botão que abre uma conversa com você." · Formulário de contato = "O visitante preenche e você recebe no e-mail." · Agendamento = "O cliente escolhe dia e horário." · Pagamento online = "Cartão, Pix ou boleto direto no site." · CRM = "Um sistema que organiza seus contatos e vendas." · Analytics = "Números de quantas pessoas visitam o site." · Chat = "Uma janelinha de conversa no site." · Blog = "Espaço para você publicar artigos." · Multi-idioma = "Site disponível em mais de um idioma." · Área de membros = "Uma parte do site com login, só para clientes."

#### Blocos condicionais

| `id` | Pergunta (`label`) | Ajuda (`help`) · Exemplo (`example`) |
|---|---|---|
| `saas_core_features` | Quais as principais funções do sistema? | Conte o que a pessoa vai poder fazer lá dentro. Não precisa ser técnico. · Ex.: Cadastrar clientes, emitir relatórios e receber lembretes. |
| `saas_user_types` | Quais tipos de usuário vão usar? | Cada tipo de usuário pode ver e fazer coisas diferentes. · Ex.: Administrador, funcionário, cliente. |
| `saas_plans` | Como você pretende cobrar? | Grátis: ninguém paga. Freemium: uma versão grátis e outra paga com mais recursos. Assinatura: mensalidade. Por uso: paga conforme utiliza. |
| `saas_social_login` | Quer que as pessoas possam entrar com a conta do Google ou outra? | Permite entrar com 1 clique, sem criar senha nova. Deixa o cadastro bem mais fácil. |
| `saas_integrations` | Precisa se conectar com outros sistemas? | Por exemplo, para emitir nota fiscal, cobrar no cartão ou enviar e-mails automáticos. |
| `saas_stack_pref` | Tem preferência de tecnologia? | Só responda se você já sabe (por exemplo, se tem um time técnico). Se não, marque "Não sei" que escolhemos a melhor opção para o seu caso. |
| `ecom_product_count` | Quantos produtos você vai vender? | Uma estimativa já serve. Isso ajuda a definir como organizar a loja. |
| `ecom_gateway` | Como você quer receber os pagamentos? | "Gateway" é o serviço que processa o pagamento (como Mercado Pago ou Stripe). Se você não sabe, marque "Não sei". |
| `ecom_shipping` | Como vai ser a entrega? | Correios, transportadora, retirada no local, entrega própria... Marque o que pretende usar. |
| `ecom_stock` | Como você controla o estoque? | Se já usa planilha ou algum sistema, conte qual. Se não controla, tudo bem. |
| `local_address` | Qual o endereço do seu negócio? | Vai aparecer no site e no mapa para o cliente te encontrar. |
| `local_hours` | Quais os horários de funcionamento? | · Ex.: Segunda a sexta, das 8h às 18h. |
| `local_area` | Quais regiões você atende? | Cidade, bairros ou até quantos quilômetros você atende. · Ex.: Sorocaba e região. |
| `local_gmb` | Você tem perfil no Google Meu Negócio? | É a ficha da sua empresa que aparece no Google e no Google Maps quando alguém pesquisa por você. Ajuda a ser encontrado perto de você. |
| `redesign_problems` | O que não funciona no seu site atual? | Conte o que te incomoda. · Ex.: Parece antigo, é lento, é difícil de usar no celular, ninguém entra em contato. |
| `redesign_analytics` | Você tem acesso ao Google Analytics do site? | É a ferramenta que mostra quantas pessoas visitam o site e o que fazem nele. Se tem, ajuda muito a melhorarmos o que já funciona. |
| `legal_notice` (aviso) | — | Na sua área existem regras sobre como se pode divulgar serviços na internet. Vamos cuidar disso junto com você. |
| `legal_notes` | Existe alguma regra ou restrição da sua área que precisamos respeitar? | Algumas profissões são fiscalizadas por conselhos (como CFM, OAB ou CVM) e têm regras sobre o que pode aparecer em site e propaganda. Conte se você conhece alguma. Se não, marque "Não sei" e verificamos. |

**Botões padrão (também precisam de explicação curta, em tooltip ou texto pequeno):**
- "Pular por enquanto" → "Você poderá responder depois pelo mesmo link."
- "Não sei" → "Sem problema, nós ajudamos com isso."
- "🎙 Prefiro falar" → "Grave um áudio e nós transformamos em texto para você conferir."

**Mensagens de erro em português claro:** por exemplo, "Esse e-mail parece incompleto. Confira se tem o @." e "Esse link não parece um endereço de site. Ex.: www.suaempresa.com.br". Nada de mensagens técnicas como "invalid input".

---

## 8. Wizard do cliente (`/b/[token]`)

- **Uma etapa por tela** (1–3 perguntas). Transição com framer-motion (slide + fade curtos, respeitando `prefers-reduced-motion`).
- Cabeçalho: logo à esquerda; à direita, contador mono "03 / 12" e "≈ 6 min restantes" (somar `estimatedMinutes` das etapas visíveis restantes).
- `ProgressBar` fina no topo, preenchida em `burgundy`.
- Título da etapa em **Neuhaus** grande, caixa alta, com `Ornament` ✦; subtítulo em Instrument Sans, `muted`.
- Botões: **Voltar** (secondary), **Continuar** (primary). Enter avança em campos simples. Botão "Continuar" só desabilita se houver obrigatória vazia.
- A lista de etapas visíveis é recalculada a cada resposta (lógica condicional). Ao mudar `project_type`/`niche`, descartar visualmente etapas que deixaram de valer, mas **não apagar** as respostas do banco.
- **Autosave:** debounce de ~800 ms, `PATCH /api/briefing/[token]` com `{ answers, current_step }`. Indicador discreto "Salvo ✓" / "Salvando…" / "Sem conexão, tentando de novo". Salvar também ao trocar de etapa e em `visibilitychange`.
- Ao abrir `/b/[token]`, carregar o estado salvo e **retomar de onde parou**. Mostrar, na primeira etapa, o texto "Você pode sair e voltar quando quiser — este link guarda tudo."
- Ao final: **tela de revisão** (resumo por etapa, editável clicando) e botão "Enviar briefing". Depois, página `/b/[token]/obrigado` com próximos passos.
- Após concluir, o link continua abrindo em modo somente leitura (ou permitindo edição enquanto o status for `concluido` e o admin permitir, deixar como flag simples).
- Acessibilidade: labels reais, foco gerenciado ao trocar de etapa, navegação por teclado, contraste conforme regra da seção 4.

---

## 9. Áudio

Componente `AudioRecorder` usado nas perguntas com `allowAudio`.

1. Botão "🎙 Prefiro falar" abaixo do textarea. Pede permissão do microfone; tratar negação com mensagem amigável.
2. Gravar com `MediaRecorder`. Escolher o `mimeType` dinamicamente:
   ```ts
   const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
   const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
   ```
   Chrome/Android gravam `webm`; **Safari/iPhone grava `mp4`**. A extensão do arquivo enviado deve refletir o formato real (`.webm`, `.m4a`/`.mp4`), porque os provedores de transcrição usam a extensão para identificar o formato.
3. UI: timer, indicador de gravação pulsante em `burgundy-glow`, **limite de 3 minutos** (para automaticamente), botões pausar/parar.
4. Após parar: **prévia** com `<audio controls>`, opções "Regravar" e "Usar este áudio".
5. Upload: `POST /api/briefing/[token]/upload-url` → recebe `{ path, token }` → `supabase.storage.from("briefing-audios").uploadToSignedUrl(path, token, blob)` direto do navegador.
6. Registrar: `POST /api/briefing/[token]/audio` com `{ question_id, storage_path, mime_type, duration_seconds }`. A rota cria o registro (`transcript_status = 'processando'`), baixa o arquivo do Storage e chama `transcribe()`. Usar `export const maxDuration = 60;`.
7. Ao concluir, gravar o texto em `briefing_audios.transcript` e também em `answers[question_id] = { value: transcript, audioId }`, preenchendo o textarea para o cliente **conferir e corrigir** a transcrição antes de continuar. Em caso de erro, `transcript_status = 'erro'`, mantendo o áudio salvo, e mostrar "Não consegui transcrever, mas seu áudio foi salvo".
8. Estados de carregamento claros ("Transcrevendo…").

### Transcrição (`src/lib/transcribe.ts`)

Provedor trocável por `TRANSCRIBE_PROVIDER`. As duas APIs são compatíveis com o formato OpenAI.

```ts
import "server-only";

const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    key: () => process.env.GROQ_API_KEY,
    model: "whisper-large-v3",          // conferir nome vigente na doc da Groq
  },
  openai: {
    url: "https://api.openai.com/v1/audio/transcriptions",
    key: () => process.env.OPENAI_API_KEY,
    model: "gpt-4o-transcribe",         // alternativa: "whisper-1"
  },
} as const;

export async function transcribe(file: Blob, filename: string): Promise<string> {
  const name = (process.env.TRANSCRIBE_PROVIDER ?? "groq") as keyof typeof PROVIDERS;
  const p = PROVIDERS[name];
  const apiKey = p.key();
  if (!apiKey) throw new Error(`Chave ausente para o provedor "${name}"`);

  const form = new FormData();
  form.append("file", file, filename);          // filename com extensão correta
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
```

---

## 10. Completude e resumo

**`completeness.ts`:** considerar apenas perguntas **visíveis** (após lógica condicional). Cada uma vale seu `weight` (padrão 1; obrigatórias 3). Pergunta "respondida" = valor não vazio e não `skipped`/`unknown`. `completeness = round(respondido / total * 100)`. `pending_fields` = ids das visíveis não respondidas (com o rótulo legível resolvido a partir de `steps.ts`). Recalcular a cada `PATCH` e no submit.

**`summary.ts`:** gera um **markdown organizado por etapa** com todas as respostas legíveis, incluindo transcrições de áudio e a lista de pendências ao final. Este texto alimenta o botão "Copiar resumo" do painel (para colar direto em uma IA/IDE como briefing do projeto) e a versão de impressão.

---

## 11. Painel admin (`/admin`)

- **Autenticação:** Supabase Auth (e-mail + magic link ou senha). `middleware.ts` protege `/admin/*` e as rotas de dados do admin, verificando sessão **e** se o e-mail está em `ADMIN_EMAILS`. Quem não estiver na lista é deslogado.
- **Lista:** tabela/cards com cliente, empresa, tipo de projeto, status (badge), % de completude, data, ordenação por mais recente, filtro por status e tipo, busca por nome/empresa. Botão "Copiar link do cliente".
- **Avisos de novos briefings (substitui qualquer notificação externa):**
  - Briefing com `status = concluido` e `viewed_at IS NULL` mostra selo **"Novo"** em `burgundy-glow` e fica destacado na lista.
  - Filtro rápido **"Não lidos"** e contador de não lidos no menu/cabeçalho do painel.
  - O título da aba do navegador reflete o contador, ex.: `(2) Briefings`.
  - **Atualização automática:** a lista consulta `GET /api/admin/briefings/unread-count` a cada 30 s (polling, sem Realtime, para não precisar abrir policies de RLS). Quando o contador aumenta com o painel aberto, mostrar um toast "Novo briefing recebido" com link para ele.
  - Ao abrir o detalhe de um briefing, gravar `viewed_at = now()` (se ainda nulo).
  - Opcional: usar a Notification API do navegador (pedir permissão de forma explícita, sem insistir) para avisar mesmo com a aba em segundo plano.
- **Detalhe:** respostas agrupadas por etapa; para perguntas com áudio, mostrar **transcrição + player do áudio original**; lista de arquivos com download via signed URL (expira em ~60 s); barra de completude e lista de **pendências**; seletor de status.
- **Ações:** "Copiar resumo (markdown)", "Baixar JSON", "Imprimir / PDF" (rota `/print` com CSS `@media print`, fundo branco), "Reenviar transcrição" para áudios com erro, "Criar novo link de briefing" (gera rascunho pré-preenchendo nome/empresa).
- Visual consistente com o design system (preto, vinho, Neuhaus nos títulos).

---

## 12. Avisos de novos briefings

**Não integrar Telegram, WhatsApp, e-mail ou qualquer serviço externo de mensagens.** Os avisos acontecem só dentro do painel (ver seção 11): selo "Novo", contador de não lidos, filtro "Não lidos", título da aba e polling a cada 30 s.

Rota necessária: `GET /api/admin/briefings/unread-count` (protegida por sessão admin) → `{ count: number, latest: { id, client_name, company } | null }`, contando `status = 'concluido' AND viewed_at IS NULL`.

Deixar o ponto de extensão preparado, sem implementar: no `submit`, chamar uma função `onBriefingCompleted(briefing)` que hoje não faz nada. Se no futuro quiser e-mail ou outro canal, basta implementar ali.

---

## 13. Rotas da API — contratos

Todas validam entrada com zod, respondem JSON e nunca vazam a service role.

| Rota | Método | Descrição |
|---|---|---|
| `/api/briefing` | POST | Cria rascunho (checa honeypot + rate limit). Retorna `{ token }` |
| `/api/briefing/[token]` | GET | Retorna estado salvo (`answers`, `current_step`, `status`, áudios/arquivos existentes) |
| `/api/briefing/[token]` | PATCH | `{ answers, current_step }` → faz merge das respostas, atualiza colunas desnormalizadas (`client_name`, `company`, `project_type`, `niche`…), recalcula completude, status `em_andamento` |
| `/api/briefing/[token]/upload-url` | POST | `{ bucket, question_id, file_name, mime_type, size }` → valida e devolve `{ path, token }` do signed upload |
| `/api/briefing/[token]/audio` | POST | Registra áudio e transcreve (seção 9) |
| `/api/briefing/[token]/file` | POST | Registra arquivo já enviado em `briefing_files` |
| `/api/briefing/[token]/submit` | POST | Valida obrigatórias, `status = concluido`, `completed_at`, `viewed_at = null`, chama `onBriefingCompleted` (no-op) |

Token inexistente → 404 genérico (sem confirmar se existe).

---

## 14. Qualidade

- TypeScript `strict`, ESLint e Prettier configurados.
- Nenhum `any` sem justificativa. Erros tratados e mensagens amigáveis em pt-BR para o cliente.
- Lighthouse mobile ≥ 90 em performance e acessibilidade na landing e no wizard.
- `README.md` com: como rodar local, como aplicar `schema.sql`, como criar o usuário admin no Supabase Auth, como configurar variáveis na Vercel, como soltar a fonte Neuhaus em `src/fonts/`, como trocar o provedor de transcrição.

---

## 15. Fases de entrega

**Fase 1 — Fundação**
Projeto Next.js + Tailwind v4 + TS, tokens e fontes (Neuhaus com fallback Anton, Instrument Sans, JetBrains Mono), logo movido para `public/`, componentes `ui/` base, `schema.sql`, clientes Supabase, `env.ts`, landing `/` com CTA. *Aceite:* `npm run dev` abre a landing já no visual final; build passa.

**Fase 2 — Wizard**
`steps.ts` completo, `conditions.ts`, wizard com progresso/tempo estimado, todos os tipos de pergunta, criação de rascunho, GET/PATCH, autosave, retomada por link, revisão final, submit, página de obrigado, completude. *Aceite:* preencher, fechar a aba, reabrir o link e continuar do mesmo ponto; blocos condicionais aparecem/somem corretamente.

**Fase 3 — Áudio e uploads**
`AudioRecorder`, signed upload URLs, rota de áudio, `transcribe()`, edição da transcrição pelo cliente, upload de logo/fotos/documentos. *Aceite:* gravar no Chrome e no Safari iOS, ver o texto transcrito no campo; arquivo original salvo no bucket.

**Fase 4 — Painel admin**
Auth, middleware, lista, detalhe com player + transcrição, exportar JSON, copiar resumo markdown, versão de impressão, reprocessar transcrição. *Aceite:* apenas e-mails em `ADMIN_EMAILS` acessam; todos os dados de um briefing são visíveis e exportáveis.

**Fase 5 — Avisos no painel e acabamento**
Selo "Novo", contador de não lidos, filtro, título da aba, polling de 30 s com toast, rate limit, honeypot, metadados/noindex, README, revisão de acessibilidade, deploy na Vercel com as variáveis configuradas. *Aceite:* com o painel aberto, concluir um briefing em outra aba faz o contador subir e o toast aparecer em até 30 s; abrir o briefing remove o selo.

---

## 16. Fora do escopo (por enquanto)

Login de cliente, múltiplos administradores com permissões, pagamento, envio de e-mail transacional e qualquer notificação externa (Telegram, WhatsApp, e-mail). Podem entrar depois pelo ponto de extensão `onBriefingCompleted`.
