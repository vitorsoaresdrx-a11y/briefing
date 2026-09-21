"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await createClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="inline-flex min-h-[44px] items-center gap-2 text-sm text-muted hover:text-white"
    >
      <LogOut size={16} aria-hidden="true" />
      Sair
    </button>
  );
}
