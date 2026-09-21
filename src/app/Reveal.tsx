"use client";

import * as React from "react";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}

/** Após esse tempo, o conteúdo aparece mesmo se o observer falhar. */
const FALLBACK_MS = 2500;

// Layout effect só no cliente (evita warning no SSR).
const useLayoutEffectSafe =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

type Mode = "idle" | "armed" | "play";

/**
 * Fade-in com leve subida ao entrar na viewport; dispara uma única vez.
 *
 * Resiliente por construção:
 * - SSR e sem JS: sempre visível (nenhum estilo escondido no HTML).
 * - Com JS: abaixo da dobra, esconde pré-paint e revela com keyframes CSS
 *   (independe de requestAnimationFrame); timer de segurança garante que
 *   nada fica preso invisível.
 * - prefers-reduced-motion: o kill-switch global do CSS anula a animação e
 *   o conteúdo permanece visível.
 */
export function Reveal({ children, delay = 0, className, as = "div" }: RevealProps) {
  const ref = React.useRef<Element | null>(null);
  const [mode, setMode] = React.useState<Mode>("idle");

  // Pré-paint: decide esconder (abaixo da dobra) ou animar direto.
  useLayoutEffectSafe(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.9) {
      setMode("play");
      return;
    }
    setMode("armed");
    let done = false;
    const play = () => {
      if (done) return;
      done = true;
      setMode("play");
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          play();
          io.disconnect();
          clearTimeout(timer);
        }
      },
      { rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    const timer = setTimeout(() => {
      play();
      io.disconnect();
    }, FALLBACK_MS);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const setRef = (el: Element | null) => {
    ref.current = el;
  };

  const cls = [
    className ?? "",
    mode === "armed" ? "reveal-armed" : "",
    mode === "play" ? "reveal-play" : "",
  ]
    .join(" ")
    .trim();

  const style =
    mode === "play" && delay > 0 ? { animationDelay: `${delay}s` } : undefined;

  return as === "li" ? (
    <li ref={setRef as React.Ref<HTMLLIElement>} className={cls} style={style}>
      {children}
    </li>
  ) : (
    <div ref={setRef as React.Ref<HTMLDivElement>} className={cls} style={style}>
      {children}
    </div>
  );
}
