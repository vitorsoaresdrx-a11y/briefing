"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";

const POLL_MS = 30_000;

type Latest = { id: string; client_name: string | null; company: string | null } | null;

/**
 * Monitor de briefings não lidos: selo de contagem no cabeçalho, título da
 * aba e toast quando um briefing novo chega com o painel aberto.
 */
export function UnreadMonitor() {
  const [count, setCount] = React.useState(0);
  const [toast, setToast] = React.useState<Latest>(null);
  const [notifyReady, setNotifyReady] = React.useState(false);
  const prevCount = React.useRef(0);
  const baseline = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/admin/briefings/unread-count", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { count: number; latest: Latest };
        if (cancelled) return;
        if (baseline.current && data.count > prevCount.current && data.latest) {
          const arrived = data.latest;
          setToast(arrived);
          if (notifyReady && typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Novo briefing recebido", {
              body: arrived.client_name ?? "Um cliente concluiu o briefing.",
            });
          }
        }
        prevCount.current = data.count;
        baseline.current = true;
        setCount(data.count);
      } catch {
        // Silencioso: tenta de novo no próximo ciclo.
      }
    }
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [notifyReady]);

  React.useEffect(() => {
    document.title = count > 0 ? `(${count}) Briefings` : "Painel — Briefings";
  }, [count]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifyReady(perm === "granted");
  }

  const showNotifyButton =
    toast && typeof Notification !== "undefined" && Notification.permission === "default" && !notifyReady;

  return (
    <>
      <span
        className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-line px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted"
        role="status"
        aria-label={count === 0 ? "Nenhum briefing não lido" : `${count} briefing(s) não lido(s)`}
      >
        <Bell size={14} aria-hidden="true" className={count > 0 ? "text-burgundy-glow" : ""} />
        {count > 0 ? <span className="text-burgundy-glow">{count} novo{count === 1 ? "" : "s"}</span> : "em dia"}
      </span>

      {toast ? (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-[60] w-[calc(100%-3rem)] max-w-md -translate-x-1/2 rounded-card border border-burgundy-glow bg-ink-2 p-5 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-burgundy-glow">
                Novo briefing recebido
              </p>
              <p className="mt-2 text-[15px] font-medium">
                {toast.client_name || "Cliente"}
                {toast.company ? <span className="font-normal text-muted"> · {toast.company}</span> : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Fechar aviso"
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-ctl text-muted hover:bg-white/5 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/admin/briefings/${toast.id}`}
              onClick={() => setToast(null)}
              className="inline-flex min-h-[44px] items-center rounded-ctl bg-burgundy px-5 text-sm font-medium text-white hover:bg-burgundy-hover"
            >
              Ver briefing
            </Link>
            {showNotifyButton ? (
              <button
                type="button"
                onClick={() => void enableNotifications()}
                className="inline-flex min-h-[44px] items-center rounded-ctl border border-line px-5 text-sm text-muted hover:text-white"
              >
                Ativar notificações
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
