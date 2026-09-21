import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { UnreadMonitor } from "@/components/admin/UnreadMonitor";

export const metadata: Metadata = {
  title: "Painel — Briefings",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Defesa em profundidade (o middleware já barra não-admins).
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex min-h-full flex-col bg-black text-white">
      <header className="border-b border-line print:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <Link href="/admin" className="flex items-center gap-4">
            <Image src="/logoladoalado.png" alt="Logo" width={150} height={28} className="h-7 w-auto" />
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:inline">
              Painel
            </span>
          </Link>
          <nav className="flex items-center gap-5" aria-label="Painel">
            <UnreadMonitor />
            <Link href="/admin" className="text-sm text-muted hover:text-white">
              Briefings
            </Link>
            <Link href="/admin/novo" className="text-sm text-muted hover:text-white">
              Novo link
            </Link>
            <span className="hidden max-w-[220px] truncate font-mono text-[11px] text-muted md:inline">
              {session.email}
            </span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-10">{children}</div>
    </div>
  );
}
