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
      <Image src="/logoladoalado_fullscreen.png" alt="Logo" width={360} height={61} className="h-auto w-56 sm:w-64" />
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        <Ornament className="mr-2" />
        Área restrita
      </p>
      <h1 className="mt-4 font-display text-5xl uppercase leading-[1.05]">Painel</h1>
      <div className="mt-10 w-full max-w-sm">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
