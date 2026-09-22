import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VoiceBriefing } from "@/components/voice/VoiceBriefing";

const TOKEN_RE = /^[0-9a-f]{48}$/i;

export const metadata: Metadata = {
  title: "Briefing por voz — converse em vez de digitar",
  description:
    "Sessão de voz guiada: você fala pelo microfone e a assistente conduz as perguntas do briefing.",
  robots: { index: false, follow: false },
};

export default async function VozPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();
  return <VoiceBriefing token={token} />;
}
