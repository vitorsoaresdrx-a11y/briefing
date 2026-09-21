/** Pequeno losango/estrela de 4 pontas (✦) em burgundy-glow. Decorativo. */
export function Ornament({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`text-burgundy-glow ${className}`.trim()}>
      ✦
    </span>
  );
}
