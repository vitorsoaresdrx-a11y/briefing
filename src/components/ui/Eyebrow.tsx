/**
 * Sobretítulo editorial: marcador + texto técnico em mono + filete.
 * O número de índice dá propósito (navegação da página); o filete ancora
 * o rótulo no layout em vez de flutuar como etiqueta genérica.
 */
export function Eyebrow({ index, children }: { index?: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:text-xs">
      {index ? (
        <span aria-hidden="true" className="text-burgundy-glow">
          {index}
        </span>
      ) : (
        <span aria-hidden="true" className="text-burgundy-glow">
          ✦
        </span>
      )}
      <span>{children}</span>
      <span aria-hidden="true" className="h-px w-10 shrink-0 bg-line sm:w-16" />
    </p>
  );
}
