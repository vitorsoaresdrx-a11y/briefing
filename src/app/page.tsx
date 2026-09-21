import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./Reveal";
import { StartCta } from "@/components/landing/StartCta";
import { Eyebrow } from "@/components/ui/Eyebrow";

const STEPS = [
  {
    n: "01",
    title: "Responda no seu ritmo",
    text: "Poucas perguntas por tela, na maioria em cliques. Pode sair e voltar pelo mesmo link — nada se perde.",
  },
  {
    n: "02",
    title: "Fale em vez de escrever",
    text: "Nas perguntas abertas, grave um áudio se preferir. Ele chega transcrito e você confere o texto antes de enviar.",
  },
  {
    n: "03",
    title: "Receba uma proposta precisa",
    text: "Com o briefing completo, a proposta vem com escopo, prazo e investimento alinhados à sua realidade.",
  },
];

const FACTS = [
  "Uns 10 minutos, no seu ritmo — pode parar e voltar depois.",
  "Quase tudo se resolve no toque; texto só onde faz falta.",
  "Prefere falar? Grave as respostas em áudio pelo celular.",
  "Sem conta e sem senha: um link seu guarda todo o progresso.",
];

const TOPICS = [
  "Seu negócio e seu público",
  "Objetivo do projeto",
  "Visual e referências",
  "Conteúdo e funcionalidades",
  "Domínio e hospedagem",
  "Prazo e investimento",
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-black text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-start px-6 py-6 sm:px-10">
        <Image
          src="/logoladoalado.png"
          alt="Logo"
          width={300}
          height={100}
          priority
          className="block h-auto w-56 sm:w-80"
        />
        <p className="ml-auto hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:block">
          ≈ 10 min · sem cadastro
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 sm:px-10">
        <section className="grid gap-12 pb-24 pt-10 sm:pt-16 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          <Reveal>
            <Eyebrow lines={["Briefing guiado", "qualquer nicho"]} />
            <h1 className="mt-6 font-display text-[13vw] uppercase leading-[1.05] tracking-[-0.01em] text-balance sm:text-7xl lg:text-8xl">
              Conte sua ideia. Receba um projeto sob medida.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Um questionário direto que transforma o que você conta — em texto
              ou áudio — em um briefing completo para o seu site, landing page
              ou sistema.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <StartCta />
              <Link
                href="#como-funciona"
                className="inline-flex min-h-[48px] items-center justify-center rounded-ctl border border-line px-6 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-white/10"
              >
                Como funciona
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.12} className="lg:pt-24">
            <ol className="flex flex-col border-t border-line">
              {FACTS.map((fact, i) => (
                <li
                  key={fact}
                  className="flex items-baseline gap-5 border-b border-line py-5"
                >
                  <span
                    aria-hidden="true"
                    className="font-mono text-[11px] tracking-[0.14em] text-muted"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[16px] leading-relaxed text-white">{fact}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        <section id="como-funciona" className="scroll-mt-8 border-t border-line py-16 sm:py-20">
          <Reveal>
            <Eyebrow index="01">Como funciona</Eyebrow>
            <h2 className="mt-4 font-display text-5xl uppercase leading-[1.05] tracking-[-0.01em] sm:text-6xl">
              Três passos, <span className="block sm:inline">e somente isso</span>
            </h2>
          </Reveal>
          <ol className="mt-10 flex flex-col">
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.n} delay={i * 0.08}>
                <div className="grid gap-2 border-t border-line py-8 sm:grid-cols-[80px_1fr_1.4fr] sm:gap-8">
                  <span className="font-display text-4xl text-burgundy-glow">
                    {step.n}
                  </span>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                  <p className="leading-relaxed text-muted">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        <section className="border-t border-line py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2">
            <Reveal>
              <Eyebrow index="02">O que vamos perguntar</Eyebrow>
              <h2 className="mt-4 font-display text-5xl uppercase leading-[1.05] tracking-[-0.01em] sm:text-6xl">
                Responda só <span className="block sm:inline">o que faz sentido</span>
              </h2>
              <p className="mt-6 max-w-md leading-relaxed text-muted">
                As perguntas se adaptam às suas respostas: quem precisa de loja
                virtual vê perguntas de loja; quem precisa de site institucional,
                não.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <ul className="flex flex-col border-t border-line">
                {TOPICS.map((topic, i) => (
                  <li
                    key={topic}
                    className="flex items-baseline gap-4 border-b border-line py-4 text-[15px]"
                  >
                    <span aria-hidden="true" className="font-mono text-[11px] tracking-[0.14em] text-burgundy-glow">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {topic}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-line py-16 sm:py-24">
          <Reveal>
            <h2 className="max-w-3xl font-display text-5xl uppercase leading-[1.05] tracking-[-0.01em] sm:text-7xl">
              Pronto quando você estiver.
            </h2>
            <p className="mt-6 max-w-xl leading-relaxed text-muted">
              Leva cerca de 10 minutos. Você pode pular o que não souber e
              voltar depois pelo mesmo link.
            </p>
            <div className="mt-10">
              <StartCta label="Começar o briefing" />
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p>Briefing · site, landing page e SaaS</p>
          <p>Suas respostas ficam salvas no seu link privado</p>
        </div>
      </footer>
    </div>
  );
}
