interface ProgressBarProps {
  current: number;
  total: number;
  minutesLeft?: number;
}

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function ProgressBar({ current, total, minutesLeft }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        <span aria-label={`Etapa ${current} de ${total}`}>
          {pad(current)} / {pad(total)}
        </span>
        {typeof minutesLeft === "number" ? (
          <span>≈ {minutesLeft} min restantes</span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        className="h-[3px] w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-burgundy transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
