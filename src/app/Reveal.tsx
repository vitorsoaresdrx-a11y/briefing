"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}

/**
 * Fade-in com leve subida ao entrar na viewport; dispara uma única vez.
 * Seguro sem JS: o HTML sai visível do servidor e o estado escondido só
 * existe após a hidratação (sem JS, nada some).
 */
export function Reveal({ children, delay = 0, className, as = "div" }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const ref = React.useRef<Element | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [mounted, setMounted] = React.useState(false);
  // Mount-gate proposital: o HTML do servidor sai visível (seguro sem JS) e
  // só após hidratar o estado escondido passa a existir.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);

  if (reduceMotion || !mounted) {
    return as === "li" ? <li className={className}>{children}</li> : <div className={className}>{children}</div>;
  }

  const Comp = as === "li" ? motion.li : motion.div;
  const setRef = (el: Element | null) => {
    ref.current = el;
  };
  return (
    <Comp
      ref={setRef}
      className={className}
      initial={false}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
    >
      {children}
    </Comp>
  );
}
