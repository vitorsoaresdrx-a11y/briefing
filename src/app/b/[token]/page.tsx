import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Wizard } from "@/components/wizard/Wizard";

const TOKEN_RE = /^[0-9a-f]{48}$/i;

export const metadata: Metadata = {
  title: "Briefing — responda no seu ritmo",
  description: "Questionário guiado para o seu projeto. Seu progresso fica salvo no link.",
  robots: { index: false, follow: false },
};

export default async function BriefingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();
  return <Wizard token={token} />;
}
