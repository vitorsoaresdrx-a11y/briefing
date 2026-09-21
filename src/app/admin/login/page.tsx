import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Ornament } from "@/components/ui/Ornament";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Entrar — Painel",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-full flex-col items-center bg-black px-6 py-16 text-white">
      <Image src="/logoladoalado.png" alt="Logo" width={180} height={32} className="h-8 w-auto" />
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        <Ornament className="mr-2" />
        Área restrita
      </p>
      <h1 className="mt-4 font-display text-5xl uppercase leading-[0.9]">Painel</h1>
      <div className="mt-10 w-full max-w-sm">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
