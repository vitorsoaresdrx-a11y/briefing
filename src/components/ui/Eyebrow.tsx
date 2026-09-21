/**
 * Sobretítulo editorial: marcador + texto técnico em mono + filete.
 * O número de índice dá propósito (navegação da página); o filete ancora
 * o rótulo no layout em vez de flutuar como etiqueta genérica.
 * Com `lines`, empilha as frases uma por linha (sem separador).
 */
export function Eyebrow({
  index,
  children,
  lines,
}: {
  index?: string;
  children?: React.ReactNode;
  lines?: [string, ...string[]];
}) {
  return (
    <p className="flex items-center gap-3 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:text-xs">
      {index ? (
        <span aria-hidden="true" className="shrink-0 text-burgundy-glow">
          {index}
        </span>
      ) : (
        <span aria-hidden="true" className="shrink-0 text-burgundy-glow">
          ✦
        </span>
      )}
      {lines ? (
        <span className="flex flex-col">
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      ) : (
        <span>{children}</span>
      )}
      <span aria-hidden="true" className="h-px w-10 shrink-0 bg-line sm:w-16" />
    </p>
  );
}
