"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[48px] items-center gap-2 rounded-ctl bg-burgundy px-6 text-[15px] font-medium text-white print:hidden hover:bg-burgundy-hover"
    >
      <Printer size={18} aria-hidden="true" />
      Imprimir / salvar PDF
    </button>
  );
}
