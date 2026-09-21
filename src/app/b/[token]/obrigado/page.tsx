import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Ornament } from "@/components/ui/Ornament";

export const metadata: Metadata = {
  title: "Briefing enviado — obrigado!",
  description: "Seu briefing foi recebido. Veja os próximos passos.",
  robots: { index: false, follow: false },
};

const NEXT_STEPS = [
  {
    n: "01",
    title: "Análise",
    text: "Vou ler tudo com calma — respostas, referências e arquivos.",
  },
  {
    n: "02",
    title: "Proposta",
    text: "Você recebe escopo, prazo e investimento alinhados ao que contou.",
  },
  {
    n: "03",
    title: "Conversa",
    text: "Ajustamos os detalhes pelo WhatsApp e fechamos o plano.",
  },
];

export default async function ObrigadoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="flex min-h-full flex-col bg-black text-white">
      <header className="mx-auto w-full max-w-3xl px-6 py-6 sm:px-10">
        <Image src="/logoladoalado.png" alt="Logo" width={150} height={28} className="h-7 w-auto" />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 sm:px-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-burgundy-glow sm:text-xs">
          <Ornament className="mr-2" />
          Briefing enviado
        </p>
        <h1 className="mt-4 flex items-center gap-4 font-display text-6xl uppercase leading-[1.05] tracking-[-0.01em] sm:text-7xl">
          Obrigado! <Check size={48} aria-hidden="true" className="shrink-0 text-burgundy-glow" />
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Suas respostas foram recebidas. O que acontece agora:
        </p>

        <ol className="mt-10 flex flex-col">
          {NEXT_STEPS.map((step) => (
            <li key={step.n} className="grid gap-2 border-t border-line py-8 sm:grid-cols-[80px_1fr_1.4fr] sm:gap-8">
              <span className="font-display text-4xl text-burgundy-glow">{step.n}</span>
              <h2 className="text-xl font-semibold">{step.title}</h2>
              <p className="leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link href={`/b/${token}`}>
            <Button variant="secondary">Rever minhas respostas</Button>
          </Link>
        </div>
        <p className="mt-8 text-sm leading-relaxed text-muted">
          Guarde este link: ele continua valendo como registro do que você enviou.
        </p>
      </main>
    </div>
  );
}
