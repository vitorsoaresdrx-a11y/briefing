import type { Metadata } from "next";
import type * as React from "react";
import "./globals.css";
import { displayFont, monoFont, sansFont } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Briefing — Conte sua ideia, receba um projeto sob medida",
  description:
    "Responda um briefing guiado em poucos minutos e receba uma proposta sob medida para seu site, landing page ou SaaS.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">
        {children}
      </body>
    </html>
  );
}
