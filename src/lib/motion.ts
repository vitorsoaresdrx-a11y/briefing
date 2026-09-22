"use client";

import * as React from "react";
import { useReducedMotion, type Variants } from "framer-motion";

/**
 * Tokens centrais de movimento (identidade: cinema, não startup).
 * Toda duração/easing dos componentes vem daqui — sem números soltos.
 */

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const DURATION = {
  micro: 0.18,
  ui: 0.35,
  step: 0.35,
  reveal: 0.9,
  draw: 1.0,
} as const;

export const STAGGER = {
  tight: 0.06,
  base: 0.1,
} as const;

/** Sobe suave com fade. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.reveal, ease: EASE_OUT } },
};

/** Linha de headline deslizando de dentro da máscara. */
export const maskLine: Variants = {
  hidden: { y: "110%" },
  show: { y: "0%", transition: { duration: DURATION.reveal, ease: EASE_OUT } },
};

/** Pai que escalona os filhos com fadeUp. */
export function staggerParent(staggerChildren: number = STAGGER.base, delayChildren: number = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  };
}

/** Linha fina que se desenha (scaleX, origem à esquerda). */
export const drawLine: Variants = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: DURATION.draw, ease: EASE_OUT } },
};

type Direction = 1 | -1;

/** Transição direcional do wizard (custom = direção). */
export function slideStepVariants(): Variants {
  return {
    enter: (dir: Direction) => ({
      opacity: 0,
      x: 32 * dir,
      transition: { duration: DURATION.step, ease: EASE_OUT },
    }),
    center: { opacity: 1, x: 0, transition: { duration: DURATION.step, ease: EASE_OUT } },
    exit: (dir: Direction) => ({
      opacity: 0,
      x: -32 * dir,
      transition: { duration: 0.25, ease: EASE_OUT },
    }),
  };
}

/** Troca curta vertical (rolling number do progresso). */
export const rollSwap: Variants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: EASE_OUT } },
};

const reducedFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

function reducedSlideStep(): Variants {
  return {
    enter: { opacity: 0, transition: { duration: 0.15 } },
    center: { opacity: 1, transition: { duration: 0.15 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  };
}

export type MotionSet = {
  reduce: boolean;
  fadeUp: Variants;
  maskLine: Variants;
  drawLine: Variants;
  rollSwap: Variants;
  staggerParent: (staggerChildren?: number, delayChildren?: number) => Variants;
  slideStep: () => Variants;
};

/**
 * Retorna os variants reduzidos (fade simples, sem deslocamento) quando
 * prefers-reduced-motion está ativo. Animações ambientes devem ser
 * desligadas pelo chamador quando `reduce` for true.
 */
export function useMotionSafe(): MotionSet {
  const reduce = useReducedMotion() ?? false;
  return React.useMemo(
    () =>
      reduce
        ? {
            reduce: true,
            fadeUp: reducedFade,
            maskLine: reducedFade,
            drawLine: reducedFade,
            rollSwap: reducedFade,
            staggerParent: () => ({ hidden: {}, show: {} }),
            slideStep: reducedSlideStep,
          }
        : {
            reduce: false,
            fadeUp,
            maskLine,
            drawLine,
            rollSwap,
            staggerParent,
            slideStep: slideStepVariants,
          },
    [reduce],
  );
}

/** true após hidratar (HTML do servidor sempre sai visível/estático). */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  // Mount-gate proposital: sem JS, nada some.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

/** true em telas pequenas (movimento reduzido: distâncias menores, sem peso). */
export function useIsMobile(breakpoint = 640): boolean {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return mobile;
}

/** true só com ponteiro fino (mouse) — desliga magnético em touch. */
export function useFinePointer(): boolean {
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return fine;
}
