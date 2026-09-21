import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { Ornament } from "@/components/ui/Ornament";
import { NewLinkForm } from "@/components/admin/NewLinkForm";

export default async function AdminNewPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        <Ornament className="mr-2" />
        Compartilhar
      </p>
      <h1 className="mt-4 font-display text-5xl uppercase leading-[0.9] sm:text-6xl">Novo link</h1>
      <p className="mt-4 max-w-xl leading-relaxed text-muted">
        Gere um link retomável para o cliente. Se souber nome e empresa, preencha para já vir identificado.
      </p>
      <div className="mt-10">
        <NewLinkForm siteUrl={siteUrl} />
      </div>
    </div>
  );
}
